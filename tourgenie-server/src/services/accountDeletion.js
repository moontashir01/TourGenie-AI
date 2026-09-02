// Removing an account, and everything hanging off it.
//
// `User.findByIdAndDelete` on its own left the login record gone and all of
// the person's content behind: trips with a dangling user_id, their bookings,
// expenses, documents, posts, reviews and notifications — invisible in the
// app, unreachable by the person who owned them, and still counted by every
// admin total. The cascade lives here, in one place, so the admin route and
// any future "delete my account" both do the same complete thing.
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
import Notification from "../models/Notification.js";
import ChatSession from "../models/ChatSession.js";
import PackingList from "../models/PackingList.js";
import PasswordReset from "../models/PasswordReset.js";

/** What deleting this account would take with it — shown before confirming. */
export async function summariseAccountFootprint(userId) {
  const trips = await Trip.find({ user_id: userId }).select("_id").lean();
  const tripIds = trips.map((t) => t._id);

  const [bookings, hotelBookings, expenses, documents, posts, reviews, notifications, items] =
    await Promise.all([
      Booking.countDocuments({ $or: [{ user_id: userId }, { trip_id: { $in: tripIds } }] }),
      HotelBooking.countDocuments({ $or: [{ user_id: userId }, { trip_id: { $in: tripIds } }] }),
      Expense.countDocuments({ trip_id: { $in: tripIds } }),
      Document.countDocuments({ user_id: userId }),
      CommunityPost.countDocuments({ user_id: userId }),
      Review.countDocuments({ user_id: userId }),
      Notification.countDocuments({ user_id: userId }),
      ItineraryItem.countDocuments({ trip_id: { $in: tripIds } }),
    ]);

  return {
    trips: trips.length,
    itinerary_items: items,
    bookings,
    hotel_bookings: hotelBookings,
    expenses,
    documents,
    posts,
    reviews,
    notifications,
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

  const [items, bookings, hotelBookings, expenses, packing, chats, documents, posts, reviews, notifications, resets] =
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
      Notification.deleteMany({ user_id: id }),
      PasswordReset.deleteMany({ user_id: id }),
    ]);

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
    notifications: notifications.deletedCount,
    password_resets: resets.deletedCount,
    likes_withdrawn: likedPosts.length,
  };
}
