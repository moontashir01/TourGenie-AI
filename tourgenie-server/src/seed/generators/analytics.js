// FR-24 — rolls the platform's real records up into daily and monthly
// AnalyticsSnapshot documents.
//
// Every figure here is an aggregation over what is actually in the database.
// Nothing is invented: if only three trips were created in a month, the
// chart shows three.

import User from "../../models/User.js";
import Trip from "../../models/Trip.js";
import Booking from "../../models/Booking.js";
import Expense from "../../models/Expense.js";
import CommunityPost from "../../models/CommunityPost.js";
import Review from "../../models/Review.js";
import Document from "../../models/Document.js";
import ItineraryItem from "../../models/ItineraryItem.js";
import ChatSession from "../../models/ChatSession.js";
import AnalyticsSnapshot from "../../models/AnalyticsSnapshot.js";

const DAY_MS = 86400000;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
function monthKey(date) {
  return date.toISOString().slice(0, 7);
}
function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Count documents grouped by the UTC day of `field`.
async function countByDay(Model, field, since, extraMatch = {}) {
  const rows = await Model.aggregate([
    { $match: { [field]: { $gte: since }, ...extraMatch } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.count]));
}

async function sumByDay(Model, field, sumField, since) {
  const rows = await Model.aggregate([
    { $match: { [field]: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } }, total: { $sum: `$${sumField}` } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.total]));
}

/**
 * Builds one snapshot per day for the last `days` days, plus one per month
 * covering the same span. Returns both arrays.
 */
export async function buildAnalyticsSnapshots({ days = 180 } = {}) {
  const today = startOfDay(new Date());
  const since = new Date(today.getTime() - days * DAY_MS);

  const [
    usersByDay, tripsByDay, bookingsByDay, bookingValueByDay,
    postsByDay, reviewsByDay, documentsByDay, expensesByDay, expenseValueByDay,
    itinerariesByDay, chatsByDay,
  ] = await Promise.all([
    countByDay(User, "created_at", since),
    countByDay(Trip, "created_at", since),
    countByDay(Booking, "created_at", since),
    sumByDay(Booking, "created_at", "total_fare", since),
    countByDay(CommunityPost, "created_at", since),
    countByDay(Review, "created_at", since),
    countByDay(Document, "created_at", since),
    countByDay(Expense, "created_at", since),
    sumByDay(Expense, "created_at", "amount", since),
    countByDay(Trip, "itinerary_generated_at", since),
    countByDay(ChatSession, "created_at", since),
  ]);

  // Running totals need the counts that predate the window too.
  const [usersBefore, tripsBefore] = await Promise.all([
    User.countDocuments({ created_at: { $lt: since } }),
    Trip.countDocuments({ created_at: { $lt: since } }),
  ]);

  // Status and destination breakdowns are point-in-time, taken from the
  // current state rather than reconstructed per day — a trip's status
  // history isn't recorded, so pretending otherwise would be fiction.
  const [statusRows, destinationRows, interestRows, pendingModeration, carbonRow] = await Promise.all([
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
    CommunityPost.countDocuments({ moderation_status: "pending" }).then(async (p) =>
      p + (await Review.countDocuments({ moderation_status: "pending" }))
    ),
    Trip.aggregate([{ $group: { _id: null, total: { $sum: "$carbon.total_kg" } } }]),
  ]);

  const tripsByStatus = { draft: 0, planned: 0, active: 0, completed: 0 };
  for (const r of statusRows) if (r._id in tripsByStatus) tripsByStatus[r._id] = r.count;

  const topDestinations = destinationRows.map((r) => ({ city: r._id, count: r.count }));
  const topInterests = interestRows.map((r) => ({ interest: r._id, count: r.count }));
  const carbonTotal = Math.round(carbonRow[0]?.total || 0);

  const daily = [];
  let runningUsers = usersBefore;
  let runningTrips = tripsBefore;

  for (let i = 0; i <= days; i++) {
    const date = new Date(since.getTime() + i * DAY_MS);
    const key = dayKey(date);

    const newUsers = usersByDay.get(key) || 0;
    const newTrips = tripsByDay.get(key) || 0;
    runningUsers += newUsers;
    runningTrips += newTrips;

    // "Active" here means a user who created a trip, post, review or
    // booking that day — the only activity signal the schema records.
    const activeSignal =
      newTrips + (postsByDay.get(key) || 0) + (reviewsByDay.get(key) || 0) + (bookingsByDay.get(key) || 0);

    daily.push({
      date,
      period: "day",
      period_key: key,
      metrics: {
        users_total: runningUsers,
        users_new: newUsers,
        users_active: activeSignal,
        trips_total: runningTrips,
        trips_created: newTrips,
        trips_by_status: tripsByStatus,
        bookings_created: bookingsByDay.get(key) || 0,
        bookings_value_bdt: Math.round(bookingValueByDay.get(key) || 0),
        itineraries_generated: itinerariesByDay.get(key) || 0,
        chat_messages: chatsByDay.get(key) || 0,
        posts_created: postsByDay.get(key) || 0,
        reviews_created: reviewsByDay.get(key) || 0,
        pending_moderation: pendingModeration,
        documents_uploaded: documentsByDay.get(key) || 0,
        expenses_logged: expensesByDay.get(key) || 0,
        total_expense_bdt: Math.round(expenseValueByDay.get(key) || 0),
        carbon_kg_total: carbonTotal,
      },
      top_destinations: topDestinations,
      top_interests: topInterests,
      computed_at: new Date(),
    });
  }

  // Monthly roll-up — this is what the admin "Trips Created" bar chart reads.
  const monthly = [];
  const byMonth = new Map();
  for (const d of daily) {
    const mk = monthKey(d.date);
    if (!byMonth.has(mk)) {
      byMonth.set(mk, {
        date: new Date(`${mk}-01T00:00:00.000Z`),
        period: "month",
        period_key: mk,
        metrics: {
          users_total: 0, users_new: 0, users_active: 0,
          trips_total: 0, trips_created: 0, trips_by_status: tripsByStatus,
          bookings_created: 0, bookings_value_bdt: 0,
          itineraries_generated: 0, chat_messages: 0,
          posts_created: 0, reviews_created: 0, pending_moderation: pendingModeration,
          documents_uploaded: 0, expenses_logged: 0, total_expense_bdt: 0,
          carbon_kg_total: carbonTotal,
        },
        top_destinations: topDestinations,
        top_interests: topInterests,
        computed_at: new Date(),
      });
    }
    const m = byMonth.get(mk);
    const s = d.metrics;
    m.metrics.users_new += s.users_new;
    m.metrics.users_active += s.users_active;
    m.metrics.trips_created += s.trips_created;
    m.metrics.bookings_created += s.bookings_created;
    m.metrics.bookings_value_bdt += s.bookings_value_bdt;
    m.metrics.itineraries_generated += s.itineraries_generated;
    m.metrics.chat_messages += s.chat_messages;
    m.metrics.posts_created += s.posts_created;
    m.metrics.reviews_created += s.reviews_created;
    m.metrics.documents_uploaded += s.documents_uploaded;
    m.metrics.expenses_logged += s.expenses_logged;
    m.metrics.total_expense_bdt += s.total_expense_bdt;
    // Running totals: carry the last day of the month.
    m.metrics.users_total = s.users_total;
    m.metrics.trips_total = s.trips_total;
  }
  monthly.push(...byMonth.values());

  return { daily, monthly };
}

export async function writeAnalyticsSnapshots(opts) {
  const { daily, monthly } = await buildAnalyticsSnapshots(opts);
  await AnalyticsSnapshot.deleteMany({});
  await AnalyticsSnapshot.insertMany([...daily, ...monthly]);
  return { daily: daily.length, monthly: monthly.length };
}

export default { buildAnalyticsSnapshots, writeAnalyticsSnapshots };
