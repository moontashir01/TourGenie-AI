// FR-18 — Smart Notifications, the part that was missing.
//
// The seed loads 17 NotificationTemplate rules and then nothing ever
// evaluated them, so notifications existed only for seeded trips and never
// appeared again. This sweep is what turns those rules into rows: it runs
// when a user reads their notifications, works out which triggers have
// fired since last time, and inserts what is due.
//
// Idempotency comes from the partial unique index on
// {user_id, trip_id, template_code} — inserting the same trigger twice is a
// duplicate-key error, which is caught and ignored rather than guarded with
// a read-then-write race.
//
// Deliberately not real-time, matching the SRS: departure reminders and
// weather advisories off stored data, no live traffic or disruption feed.
import Notification from "../models/Notification.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import Trip from "../models/Trip.js";
import Expense from "../models/Expense.js";
import Document from "../models/Document.js";
import Booking from "../models/Booking.js";
import ItineraryItem from "../models/ItineraryItem.js";
import WeatherForecast from "../models/WeatherForecast.js";

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

function utcDay(value) {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function render(template, vars) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ""
  );
}

function baseVars(trip) {
  return {
    destination: trip.destination,
    origin: trip.origin,
    trip_title: trip.title || `${trip.origin} → ${trip.destination}`,
    trip_id: trip._id.toString(),
    days: trip.duration_days || "",
    date: trip.start_date ? new Date(trip.start_date).toISOString().slice(0, 10) : "",
  };
}

function makeNotification(template, { userId, tripId, code, vars }) {
  return {
    user_id: userId,
    trip_id: tripId,
    template_code: code || template.code,
    type: template.type,
    title: render(template.title_template, vars),
    message: render(template.message_template, vars),
    severity: template.severity,
    icon: template.icon,
    action_url: render(template.action_url, vars),
    is_read: false,
    created_at: new Date(),
    deliver_at: new Date(),
  };
}

// Departure and arrival reminders. A template with a 24-hour offset should
// fire once the trip is inside 24 hours — and stay fired, which the unique
// index handles — but not fire at all for a trip that has already left.
function scheduleReminders(templates, trip, now, out) {
  const hoursToStart = (new Date(trip.start_date) - now) / HOUR_MS;
  const hoursToEnd = (new Date(trip.end_date) - now) / HOUR_MS;
  const vars = baseVars(trip);

  for (const template of templates) {
    const { event, offset_hours } = template.trigger;
    if (event === "trip_start_approaching") {
      if (hoursToStart > 0 && hoursToStart <= offset_hours) {
        out.push(makeNotification(template, {
          userId: trip.user_id, tripId: trip._id,
          vars: { ...vars, hours: Math.round(hoursToStart) },
        }));
      }
    } else if (event === "trip_end_approaching") {
      if (hoursToEnd > 0 && hoursToEnd <= offset_hours) {
        out.push(makeNotification(template, { userId: trip.user_id, tripId: trip._id, vars }));
      }
    } else if (event === "trip_completed") {
      if (hoursToEnd < -offset_hours) {
        out.push(makeNotification(template, { userId: trip.user_id, tripId: trip._id, vars }));
      }
    }
  }
}

// Weather advisories, read from the same WeatherForecast rows FR-11 serves.
// Only the days still ahead are considered — warning someone about rain that
// already fell is noise — and only the first matching day per template, so a
// three-week monsoon trip doesn't produce twenty rows.
async function scheduleWeather(templates, trip, now, out) {
  const relevant = templates.filter((t) => t.trigger.event === "daily_weather_check");
  if (relevant.length === 0) return;

  const from = utcDay(Math.max(now.getTime(), new Date(trip.start_date).getTime()));
  const to = utcDay(trip.end_date);
  if (from > to) return;

  // Which city each day happens in, so a multi-city trip is warned about the
  // place it will actually be.
  const items = await ItineraryItem.find({ trip_id: trip._id }).select("day city").lean();
  const cities = [...new Set(items.map((i) => i.city).filter(Boolean))];
  if (cities.length === 0) cities.push(trip.multi_city ? trip.entry_city : trip.destination);

  const forecasts = await WeatherForecast.find({
    city: { $in: cities.filter(Boolean) },
    date: { $gte: from, $lte: to },
  })
    .sort({ date: 1 })
    .lean();
  if (forecasts.length === 0) return;

  const vars = baseVars(trip);
  for (const template of relevant) {
    const { weather_conditions = [], threshold } = template.trigger;

    const hit = forecasts.find((f) => {
      if (weather_conditions.length > 0) return weather_conditions.includes(f.condition);
      if (threshold == null) return false;
      // A heat rule and a cold rule share the threshold field; which side of
      // it matters is implied by the template's own type.
      return template.code.includes("cold") ? f.temp_min_c <= threshold : f.temp_max_c >= threshold;
    });
    if (!hit) continue;

    out.push(makeNotification(template, {
      userId: trip.user_id,
      tripId: trip._id,
      vars: {
        ...vars,
        date: new Date(hit.date).toISOString().slice(0, 10),
        condition: hit.description || hit.condition,
        temp: template.code.includes("cold") ? hit.temp_min_c : hit.temp_max_c,
      },
    }));
  }
}

// Budget thresholds, against logged expenses — which is what the templates
// say ("Logged expenses ... now total"), not the planned estimate.
async function scheduleBudget(templates, trip, out) {
  const relevant = templates.filter((t) => t.trigger.event === "budget_threshold");
  if (relevant.length === 0 || !trip.budget) return;

  const [agg] = await Expense.aggregate([
    { $match: { trip_id: trip._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const spent = agg?.total || 0;
  if (spent === 0) return;

  const percent = Math.round((spent / trip.budget) * 100);

  // Only the highest threshold that has been crossed. Firing all of them
  // meant someone 268% over budget was told "still on track" by the 75%
  // rule, immediately above the warning that they had blown it.
  const template = relevant
    .filter((t) => percent >= t.trigger.threshold)
    .sort((a, b) => b.trigger.threshold - a.trigger.threshold)[0];
  if (!template) return;

  // Over-budget reports the overspend; the others report the total.
  const amount = template.trigger.threshold >= 100 ? Math.max(0, spent - trip.budget) : spent;
  out.push(makeNotification(template, {
    userId: trip.user_id,
    tripId: trip._id,
    vars: { ...baseVars(trip), percent, amount: Math.round(amount).toLocaleString() },
  }));
}

// Lifecycle events that are simply true or not.
async function scheduleLifecycle(templates, trip, out) {
  for (const template of templates) {
    if (template.trigger.event === "itinerary_generated" && trip.itinerary_generated_at) {
      out.push(makeNotification(template, { userId: trip.user_id, tripId: trip._id, vars: baseVars(trip) }));
    }
  }

  const bookingTemplate = templates.find((t) => t.trigger.event === "booking_confirmed");
  if (bookingTemplate) {
    const confirmed = await Booking.countDocuments({ trip_id: trip._id, status: "confirmed" });
    if (confirmed > 0) {
      out.push(makeNotification(bookingTemplate, { userId: trip.user_id, tripId: trip._id, vars: baseVars(trip) }));
    }
  }
}

// Document expiry is user-scoped rather than trip-scoped, so the template
// code carries the document id to keep one row per document per rule.
async function scheduleDocuments(templates, userId, now, out) {
  const relevant = templates
    .filter((t) => t.trigger.event === "document_expiring")
    .sort((a, b) => a.trigger.threshold - b.trigger.threshold); // tightest first
  if (relevant.length === 0) return;

  const widest = Math.max(...relevant.map((t) => t.trigger.threshold));
  const documents = await Document.find({
    user_id: userId,
    is_archived: false,
    expiry_date: { $ne: null, $lte: new Date(now.getTime() + widest * DAY_MS) },
  }).lean();

  for (const doc of documents) {
    const daysLeft = Math.round((new Date(doc.expiry_date) - now) / DAY_MS);
    // Only the tightest rule that applies — a passport 20 days out should
    // read "expires this month", not that plus the 90-day warning.
    const template = relevant.find((t) => daysLeft <= t.trigger.threshold);
    if (!template) continue;

    out.push(makeNotification(template, {
      userId,
      tripId: null,
      code: `${template.code}:${doc._id}`,
      vars: {
        document_type: doc.title || doc.type,
        days: daysLeft,
        date: new Date(doc.expiry_date).toISOString().slice(0, 10),
      },
    }));
  }
}

/**
 * Evaluate every active rule for one user and insert whatever is now due.
 * Returns the number of notifications actually created.
 */
export async function sweepNotifications(userId, { now = new Date() } = {}) {
  const templates = await NotificationTemplate.find({ is_active: true }).lean();
  if (templates.length === 0) return 0;

  const trips = await Trip.find({ user_id: userId, is_archived: { $ne: true } }).lean();
  const pending = [];

  for (const trip of trips) {
    scheduleReminders(templates, trip, now, pending);
    await scheduleWeather(templates, trip, now, pending);
    await scheduleBudget(templates, trip, pending);
    await scheduleLifecycle(templates, trip, pending);
  }
  await scheduleDocuments(templates, userId, now, pending);

  if (pending.length === 0) return 0;

  // insertMany with ordered:false inserts everything that isn't a duplicate
  // and reports the rest as errors, which is exactly the behaviour wanted:
  // already-delivered notifications collide with the unique index and are
  // skipped without touching the ones that are genuinely new.
  try {
    const created = await Notification.insertMany(pending, { ordered: false });
    return created.length;
  } catch (err) {
    if (err?.writeErrors) {
      const duplicates = err.writeErrors.filter((e) => e.err?.code === 11000).length;
      const failed = err.writeErrors.length - duplicates;
      if (failed > 0) console.warn(`Notification sweep: ${failed} row(s) failed for reasons other than duplication`);
      return pending.length - err.writeErrors.length;
    }
    throw err;
  }
}

export default { sweepNotifications };
