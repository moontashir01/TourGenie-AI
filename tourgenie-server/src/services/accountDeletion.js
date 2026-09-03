// Removing an account, and everything hanging off it.
//
// `User.findByIdAndDelete` on its own left the login record gone and all of
// the person's content behind: trips with a dangling user_id, their bookings,
// expenses, documents, posts, reviews and notifications — invisible in the
// app, unreachable by the person who owned them, and still counted by every
// admin total. The cascade lives here, in one place, so the admin route and
// any future "delete my account" both do the same complete thing.
import crypto from "node:crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Booking from "../models/Booking.js";
import HotelBooking from "../models/HotelBooking.js";
import Expense from "../models/Expense.js";
import Document from "../models/Document.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";
import ChatSession from "../models/ChatSession.js";
import PackingList from "../models/PackingList.js";
import PasswordReset from "../models/PasswordReset.js";
import AdminNote from "../models/AdminNote.js";

/** What deleting this account would take with it — shown before confirming. */
export async function summariseAccountFootprint(userId) {
  const trips = await Trip.find({ user_id: userId }).select("_id").lean();
  const tripIds = trips.map((t) => t._id);

  const [bookings, hotelBookings, expenses, documents, posts, reviews, reports, notifications, items] =
    await Promise.all([
      Booking.countDocuments({ $or: [{ user_id: userId }, { trip_id: { $in: tripIds } }] }),
      HotelBooking.countDocuments({ $or: [{ user_id: userId }, { trip_id: { $in: tripIds } }] }),
      Expense.countDocuments({ trip_id: { $in: tripIds } }),
      Document.countDocuments({ user_id: userId }),
      CommunityPost.countDocuments({ user_id: userId }),
      Review.countDocuments({ user_id: userId }),
      Report.countDocuments({ $or: [{ reporter_id: userId }, { target_author_id: userId }] }),
      Notification.countDocuments({ user_id: userId }),
      ItineraryItem.countDocuments({ trip_id: { $in: tripIds } }),
    ]);

  const notes = await AdminNote.countDocuments({
    $or: [
      { target_type: "user", target_id: userId },
      { target_type: "trip", target_id: { $in: tripIds } },
    ],
  });

  return {
    trips: trips.length,
    itinerary_items: items,
    bookings,
    hotel_bookings: hotelBookings,
    expenses,
    documents,
    posts,
    reviews,
    reports,
    notifications,
    admin_notes: notes,
  };
}

/**
 * Deletes the account and everything it owns. Returns the per-collection
 * counts, which the caller records in the audit trail — "removed 1 user"
 * hides the fact that 40 other documents went with it.
 *
 * Trip-scoped collections are cleared by trip id first, because that is how
 * they are keyed; several of them have no user_id at all.
 */
export async function deleteAccountAndContent(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const trips = await Trip.find({ user_id: id }).select("_id").lean();
  const tripIds = trips.map((t) => t._id);
  const byTrip = { trip_id: { $in: tripIds } };
  const byOwner = { $or: [{ user_id: id }, { trip_id: { $in: tripIds } }] };

  const [items, bookings, hotelBookings, expenses, packing, chats, documents, posts, reviews, reports, notifications, resets] =
    await Promise.all([
      ItineraryItem.deleteMany(byTrip),
      Booking.deleteMany(byOwner),
      HotelBooking.deleteMany(byOwner),
      Expense.deleteMany(byOwner),
      PackingList.deleteMany(byOwner),
      ChatSession.deleteMany(byOwner),
      Document.deleteMany({ user_id: id }),
      CommunityPost.deleteMany({ user_id: id }),
      Review.deleteMany({ user_id: id }),
      // Reports this person raised, and reports about what they wrote — the
      // content behind them is going too, so an open report would otherwise
      // sit in the moderation queue pointing at nothing.
      Report.deleteMany({ $or: [{ reporter_id: id }, { target_author_id: id }] }),
      Notification.deleteMany({ user_id: id }),
      PasswordReset.deleteMany({ user_id: id }),
    ]);

  // Support notes about this account and its trips. They are context, not a
  // record of what was done — the audit trail keeps that — and leaving them
  // behind would strand notes about a traveller who no longer exists.
  const notes = await AdminNote.deleteMany({
    $or: [
      { target_type: "user", target_id: id },
      { target_type: "trip", target_id: { $in: tripIds } },
    ],
  });

  // Trips last: they are the key everything above was found by.
  const removedTrips = await Trip.deleteMany({ user_id: id });
  const removedUser = await User.deleteOne({ _id: id });

  // A like is a reference to this user held on someone else's post; the
  // counter is derived from that list, so both have to be repaired.
  const likedPosts = await CommunityPost.find({ liked_by: id }).select("_id liked_by").lean();
  for (const post of likedPosts) {
    const remaining = (post.liked_by || []).filter((liker) => String(liker) !== String(id));
    await CommunityPost.updateOne({ _id: post._id }, { $set: { liked_by: remaining, likes: remaining.length } });
  }

  return {
    users: removedUser.deletedCount,
    trips: removedTrips.deletedCount,
    itinerary_items: items.deletedCount,
    bookings: bookings.deletedCount,
    hotel_bookings: hotelBookings.deletedCount,
    expenses: expenses.deletedCount,
    packing_lists: packing.deletedCount,
    chat_sessions: chats.deletedCount,
    documents: documents.deletedCount,
    posts: posts.deletedCount,
    reviews: reviews.deletedCount,
    reports: reports.deletedCount,
    notifications: notifications.deletedCount,
    password_resets: resets.deletedCount,
    admin_notes: notes.deletedCount,
    likes_withdrawn: likedPosts.length,
  };
}

/**
 * The middle answer, for "delete me" from someone whose trips still matter.
 *
 * Deleting the account takes 213 trips' worth of history out of every
 * average, every destination ranking and every budget comparison the app
 * makes — which punishes the analytics for a request that was only ever
 * about the person. Anonymising keeps what the trips say and removes who
 * said it.
 *
 * What goes: name, email, phone, avatar, city, date of birth, the password,
 * every stored document (passport and visa scans — the whole point), the
 * notifications and chat sessions, and any admin note about them, since a
 * support note about a traveller who no longer exists is only personal data
 * with nobody to serve.
 *
 * What stays: trips, itineraries, bookings, expenses, posts and reviews,
 * now attached to an account with no identity. Country is kept and city
 * dropped, because "trips from Bangladesh" is a statistic and a street
 * address is a person.
 *
 * This is not reversible: nothing is stored that could put the name back.
 */
export async function anonymiseAccount(userId, actorId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const user = await User.findById(id).select("+password_hash");
  if (!user) return null;

  const trips = await Trip.find({ user_id: id }).select("_id").lean();
  const tripIds = trips.map((t) => t._id);

  const [documents, notifications, chats, resets, notes] = await Promise.all([
    Document.deleteMany({ user_id: id }),
    Notification.deleteMany({ user_id: id }),
    ChatSession.deleteMany({ $or: [{ user_id: id }, { trip_id: { $in: tripIds } }] }),
    PasswordReset.deleteMany({ user_id: id }),
    AdminNote.deleteMany({
      $or: [
        { target_type: "user", target_id: id },
        { target_type: "trip", target_id: { $in: tripIds } },
      ],
    }),
  ]);

  // The email is unique and indexed, so it cannot simply be blanked. A
  // random local part keeps the index happy; `.invalid` is the reserved TLD
  // that can never resolve, so nothing will ever try to mail it.
  const token = crypto.randomBytes(6).toString("hex");
  user.name = "Deleted traveller";
  user.email = `anonymised-${token}@removed.invalid`;
  user.phone = "";
  user.avatar_url = null;
  user.city = "";
  user.date_of_birth = null;
  user.email_verified = false;
  // A random hash rather than an empty one: `password_hash` is required, and
  // an empty string would be a password bcrypt could be asked to match.
  user.password_hash = crypto.randomBytes(32).toString("hex");
  user.is_active = false;
  user.deleted_at = new Date();
  user.deleted_by = actorId || null;
  await user.save();

  return {
    trips_kept: trips.length,
    documents: documents.deletedCount,
    notifications: notifications.deletedCount,
    chat_sessions: chats.deletedCount,
    password_resets: resets.deletedCount,
    admin_notes: notes.deletedCount,
    placeholder_email: user.email,
  };
}
