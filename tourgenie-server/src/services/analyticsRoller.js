// FR-24 — keeping AnalyticsSnapshot current between seeds.
//
// The seeder builds 180 days of history once (seed/generators/analytics.js)
// and then it goes stale: every trip, booking and post created after the seed
// is missing from the trend charts. This rolls the two periods that can still
// change — today, and the month today is in — and upserts them.
//
// There is no cron on free-tier hosting, and the app already has an answer to
// that: notificationController sweeps the rules when someone reads their
// notifications, with a per-user cooldown. Same pattern here — reading the
// dashboard rolls the snapshot, at most once every few minutes, and never
// blocks the response it was triggered from.
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Expense from "../models/Expense.js";
import Document from "../models/Document.js";
import ChatSession from "../models/ChatSession.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import AnalyticsSnapshot from "../models/AnalyticsSnapshot.js";

const ROLL_COOLDOWN_MS = 5 * 60_000;
let lastRoll = 0;

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(date = new Date()) {
  const d = startOfDay(date);
  d.setUTCDate(1);
  return d;
}

const countSince = (Model, field, since, extra = {}) =>
  Model.countDocuments({ [field]: { $gte: since }, ...extra });

async function sumSince(Model, field, since, expression) {
  const [row] = await Model.aggregate([
    { $match: { [field]: { $gte: since } } },
    { $group: { _id: null, total: { $sum: expression } } },
  ]);
  return Math.round(row?.total || 0);
}

/**
 * The metric block for everything created on or after `since` — plus the
 * running totals and breakdowns, which are point-in-time by nature.
 */
async function metricsSince(since) {
  const [
    usersTotal, usersNew, tripsTotal, tripsCreated, bookingsCreated, bookingsValue,
    itineraries, chats, posts, reviews, documents, expensesLogged, expenseValue,
    pendingPosts, pendingReviews, statusRows, destinationRows, interestRows, carbonRow,
  ] = await Promise.all([
    User.countDocuments(),
    countSince(User, "created_at", since),
    Trip.countDocuments(),
    countSince(Trip, "created_at", since),
    countSince(Booking, "created_at", since),
    sumSince(Booking, "created_at", since, "$total_fare"),
    countSince(Trip, "itinerary_generated_at", since),
    countSince(ChatSession, "created_at", since),
    countSince(CommunityPost, "created_at", since),
    countSince(Review, "created_at", since),
    countSince(Document, "created_at", since),
    countSince(Expense, "created_at", since),
    // Expenses are stored in BDT, but older rows only have `amount`.
    sumSince(Expense, "created_at", since, { $ifNull: ["$amount_bdt", "$amount"] }),
    CommunityPost.countDocuments({ moderation_status: "pending" }),
    Review.countDocuments({ moderation_status: "pending" }),
    Trip.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Trip.aggregate([
      { $group: { _id: "$destination", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Trip.aggregate([
      { $unwind: "$interests" },
      { $group: { _id: "$interests", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Trip.aggregate([{ $group: { _id: null, total: { $sum: "$carbon.total_kg" } } }]),
  ]);

  const tripsByStatus = { draft: 0, planned: 0, active: 0, completed: 0 };
  for (const row of statusRows) if (row._id in tripsByStatus) tripsByStatus[row._id] = row.count;

  return {
    metrics: {
      users_total: usersTotal,
      users_new: usersNew,
      // The only activity signal the schema records: someone who created a
      // trip, post, review or booking in the window.
      users_active: tripsCreated + posts + reviews + bookingsCreated,
      trips_total: tripsTotal,
      trips_created: tripsCreated,
      trips_by_status: tripsByStatus,
      bookings_created: bookingsCreated,
      bookings_value_bdt: bookingsValue,
      itineraries_generated: itineraries,
      chat_messages: chats,
      posts_created: posts,
      reviews_created: reviews,
      pending_moderation: pendingPosts + pendingReviews,
      documents_uploaded: documents,
      expenses_logged: expensesLogged,
      total_expense_bdt: expenseValue,
      carbon_kg_total: Math.round(carbonRow[0]?.total || 0),
    },
    top_destinations: destinationRows.map((r) => ({ city: r._id || "—", count: r.count })),
    top_interests: interestRows.map((r) => ({ interest: r._id, count: r.count })),
  };
}

/**
 * Upserts today's daily snapshot and the current month's. Earlier periods are
 * finished and are left exactly as the seeder wrote them.
 */
export async function rollSnapshots({ force = false } = {}) {
  if (!force && Date.now() - lastRoll < ROLL_COOLDOWN_MS) return { rolled: false };
  lastRoll = Date.now();

  const day = startOfDay();
  const month = startOfMonth();
  const [today, thisMonth] = await Promise.all([metricsSince(day), metricsSince(month)]);
  const computed_at = new Date();

  await Promise.all([
    AnalyticsSnapshot.updateOne(
      { period: "day", period_key: day.toISOString().slice(0, 10) },
      { $set: { date: day, ...today, computed_at } },
      { upsert: true }
    ),
    AnalyticsSnapshot.updateOne(
      { period: "month", period_key: month.toISOString().slice(0, 7) },
      { $set: { date: month, ...thisMonth, computed_at } },
      { upsert: true }
    ),
  ]);

  return { rolled: true, computed_at };
}

/** Never lets a failed roll take the dashboard down with it. */
export async function maybeRoll(options) {
  try {
    return await rollSnapshots(options);
  } catch (err) {
    console.warn("[analytics] snapshot roll failed:", err.message);
    return { rolled: false, error: err.message };
  }
}

/**
 * The most recent `limit` snapshots for a period, oldest first — the order a
 * chart draws them in.
 */
export async function getTrend({ period = "day", limit = 30 } = {}) {
  const rows = await AnalyticsSnapshot.find({ period: period === "month" ? "month" : "day" })
    .sort({ date: -1 })
    .limit(Math.min(Math.max(Number(limit) || 30, 1), 365))
    .lean();
  return rows.reverse();
}

export default { rollSnapshots, maybeRoll, getTrend };
