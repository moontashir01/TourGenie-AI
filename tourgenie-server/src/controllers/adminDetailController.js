// Phase 2 of the admin portal — the screens that answer a question rather
// than change something.
//
// Most admin work is lookup: who is this person, what did they book, why does
// their itinerary look like that. These endpoints assemble one subject's
// whole picture server-side so the client makes one request instead of six.
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
import AuditLog from "../models/AuditLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseListQuery, paginate } from "../utils/adminList.js";
import { recordAudit } from "../services/auditLog.js";
import { releaseBooking } from "../services/bookingCancellation.js";
import { getVirtualExpenses } from "./expenseController.js";

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

// ── one traveller, entire ────────────────────────────────────────────
// The single highest-value screen in the portal: it turns a support question
// into a ten-second answer.
export const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password_hash").lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const trips = await Trip.find({ user_id: user._id })
    .select("destination origin status start_date end_date budget travelers created_at itinerary_source")
    .sort({ created_at: -1 })
    .limit(25)
    .lean();
  const tripIds = trips.map((t) => t._id);
  const owned = { $or: [{ user_id: user._id }, { trip_id: { $in: tripIds } }] };

  const [bookings, hotelBookings, expenseTotals, documents, posts, reviews, audit] = await Promise.all([
    Booking.find(owned).select("reference status total_fare travel_date journey seats").sort({ created_at: -1 }).limit(25).lean(),
    HotelBooking.find(owned).select("reference status total_amount check_in check_out nights property").sort({ created_at: -1 }).limit(25).lean(),
    Expense.aggregate([
      { $match: { trip_id: { $in: tripIds } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $ifNull: ["$amount_bdt", "$amount"] } } } },
    ]),
    // Metadata only. These are passport and visa scans: an admin needs to
    // know a document exists and when it expires, never to open it.
    Document.find({ user_id: user._id }).select("type title expiry_date created_at").sort({ created_at: -1 }).lean(),
    CommunityPost.find({ user_id: user._id }).select("place content is_hidden likes created_at").sort({ created_at: -1 }).limit(25).lean(),
    Review.find({ user_id: user._id }).select("rating comment is_hidden created_at").populate("attraction_id", "name").sort({ created_at: -1 }).limit(25).lean(),
    AuditLog.find({ entity_type: "User", entity_id: user._id }).sort({ created_at: -1 }).limit(20).lean(),
  ]);

  res.json({
    user,
    trips,
    bookings,
    hotel_bookings: hotelBookings,
    expenses: { count: expenseTotals[0]?.count || 0, total_bdt: Math.round(expenseTotals[0]?.total || 0) },
    documents,
    posts,
    reviews,
    audit,
  });
});

// ── one trip, entire ─────────────────────────────────────────────────
export const getTripDetail = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id)
    .populate("user_id", "name email role")
    .populate("hotel_id", "name city price_per_night")
    .populate("hotel_selections.hotel_id", "name city price_per_night")
    .lean();
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const [items, expenses, bookings, hotelBookings] = await Promise.all([
    ItineraryItem.find({ trip_id: trip._id }).sort({ day: 1, time: 1 }).lean(),
    Expense.find({ trip_id: trip._id }).sort({ date: -1 }).lean(),
    Booking.find({ trip_id: trip._id }).sort({ created_at: -1 }).lean(),
    HotelBooking.find({ trip_id: trip._id }).sort({ created_at: -1 }).lean(),
  ]);

  // The estimated side of the budget, assembled exactly the way the
  // traveller's own Budget page assembles it.
  let estimated = [];
  try {
    estimated = await getVirtualExpenses(await Trip.findById(trip._id).populate("hotel_id").populate("hotel_selections.hotel_id"));
  } catch (err) {
    console.warn("[admin] could not price trip", trip._id, "-", err.message);
  }

  const loggedTotal = expenses.reduce((sum, e) => sum + (e.amount_bdt ?? e.amount ?? 0), 0);
  const estimatedTotal = estimated
    .filter((e) => e.counts_toward_budget !== false)
    .reduce((sum, e) => sum + e.amount, 0);

  // Where this plan came from. When a traveller reports a bad itinerary this
  // is the first question, and it was previously unanswerable from the admin
  // side even though the trip records it.
  const provenance = {
    itinerary_source: trip.itinerary_source || (items.length ? "unknown" : "none"),
    itinerary_generated_at: trip.itinerary_generated_at || null,
    item_sources: items.reduce((acc, item) => {
      const key = item.source || "template";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    flight: trip.selected_flight
      ? {
          airline: trip.selected_flight.airline || "",
          price: trip.selected_flight.price ?? null,
          currency: trip.selected_flight.currency || "BDT",
          // Seeded schedules and live fares look identical on the page; the
          // difference matters when a price is disputed.
          is_real: trip.selected_flight.is_real ?? trip.selected_flight.isReal ?? null,
          source: trip.selected_flight.source || trip.selected_flight.provider || "",
        }
      : null,
  };

  res.json({
    trip,
    items,
    expenses,
    bookings,
    hotel_bookings: hotelBookings,
    totals: {
      budget: trip.budget || 0,
      logged: Math.round(loggedTotal),
      estimated: Math.round(estimatedTotal),
      over_budget: Math.round(loggedTotal + estimatedTotal) > (trip.budget || 0),
    },
    provenance,
  });
});

// ── bookings oversight ───────────────────────────────────────────────
// Absent before: there was no way to look up TG-8F3K2A when a traveller asked
// about it.
export const listBookings = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["reference", "journey.operator", "journey.from_city", "journey.to_city", "passengers"],
    allowedSort: ["created_at", "travel_date", "total_fare", "status"],
  });
  if (req.query.status) options.filter.status = req.query.status;

  res.json(
    await paginate(Booking, options, (q) =>
      q.populate("user_id", "name email").populate("trip_id", "destination origin")
    )
  );
});

export const listHotelBookings = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["reference", "property.name", "property.city", "room_type"],
    allowedSort: ["created_at", "check_in", "total_amount", "status"],
  });
  if (req.query.status) options.filter.status = req.query.status;

  res.json(
    await paginate(HotelBooking, options, (q) =>
      q.populate("user_id", "name email").populate("trip_id", "destination")
    )
  );
});

// Cancelling for someone who cannot — through the same seat accounting the
// traveller's own cancel uses, never a raw status write.
export const cancelBookingForTraveller = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (booking.status === "cancelled") {
    return res.status(409).json({ message: "That booking is already cancelled" });
  }

  const released = await releaseBooking(booking);

  await recordAudit(req, {
    action: "booking.cancel",
    entity_type: "Booking",
    entity_id: booking._id,
    entity_label: `${booking.reference} — ${booking.journey?.from_city || ""}→${booking.journey?.to_city || ""}`,
    before: { status: "confirmed" },
    after: { status: "cancelled", seats_released: released },
    reason: req.body?.reason,
  });

  res.json({ booking, released, message: `Booking cancelled on the traveller's behalf; ${released} seat(s) released.` });
});

export const cancelHotelBookingForTraveller = asyncHandler(async (req, res) => {
  const booking = await HotelBooking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reservation not found" });
  if (booking.status === "cancelled") {
    return res.status(409).json({ message: "That reservation is already cancelled" });
  }

  booking.status = "cancelled";
  booking.cancelled_at = new Date();
  await booking.save();

  await recordAudit(req, {
    action: "hotel_booking.cancel",
    entity_type: "HotelBooking",
    entity_id: booking._id,
    entity_label: `${booking.reference || ""} — ${booking.property?.name || ""}`,
    before: { status: "confirmed" },
    after: { status: "cancelled" },
    reason: req.body?.reason,
  });

  res.json({ booking, message: "Reservation cancelled on the traveller's behalf." });
});

// Who is holding which seat on one departure.
export const getDepartureSeatMap = asyncHandler(async (req, res) => {
  const { transport_id, date } = req.query;
  if (!isObjectId(transport_id)) return res.status(400).json({ message: "A transport_id is required" });

  const day = date ? new Date(date) : null;
  const filter = { transport_id, status: { $in: ["pending", "confirmed"] } };
  if (day && !Number.isNaN(day.getTime())) {
    day.setUTCHours(0, 0, 0, 0);
    filter.travel_date = { $gte: day, $lt: new Date(day.getTime() + 86400000) };
  }

  const bookings = await Booking.find(filter)
    .select("reference seats passengers user_id travel_date")
    .populate("user_id", "name email")
    .lean();

  const held = bookings.flatMap((b) =>
    (b.seats || []).map((seat, i) => ({
      seat,
      reference: b.reference,
      passenger: b.passengers?.[i] || "",
      traveller: b.user_id?.name || "",
      travel_date: b.travel_date,
    }))
  );

  res.json({ held: held.sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true })) });
});

// ── one box, every subject ───────────────────────────────────────────
// "Who is rahim@example.com", "what is TG-8F3K2A" — most admin work starts
// as a lookup, and it should not begin by choosing which tab to search in.
export const globalSearch = asyncHandler(async (req, res) => {
  const term = String(req.query.q || "").trim();
  if (term.length < 2) return res.json({ users: [], trips: [], bookings: [], posts: [] });

  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const LIMIT = 5;

  const [users, trips, bookings, posts] = await Promise.all([
    // Deleted accounts stay out of the search box; they are reachable
    // through the Users list's Deleted filter, which is where restoring
    // one happens.
    User.find({ deleted_at: null, $or: [{ name: rx }, { email: rx }, { phone: rx }] })
      .select("name email role is_active")
      .limit(LIMIT)
      .lean(),
    Trip.find({ $or: [{ destination: rx }, { origin: rx }] })
      .select("destination origin status start_date")
      .populate("user_id", "name")
      .limit(LIMIT)
      .lean(),
    Booking.find({ $or: [{ reference: rx }, { passengers: rx }] })
      .select("reference status journey travel_date")
      .populate("user_id", "name")
      .limit(LIMIT)
      .lean(),
    CommunityPost.find({ $or: [{ content: rx }, { place: rx }] })
      .select("place content is_hidden")
      .populate("user_id", "name")
      .limit(LIMIT)
      .lean(),
  ]);

  res.json({ users, trips, bookings, posts });
});
