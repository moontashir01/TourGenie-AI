// FR-18 — Smart Notifications, the part that was missing.
//
// The seed loads NotificationTemplate rules and this sweep is what turns
// them into rows: it runs when a user reads their notifications (or polls
// the badge), works out which triggers have fired since last time, and
// inserts what is due.
//
// Idempotency comes from the partial unique index on
// {user_id, trip_id, template_code} — inserting the same trigger twice is a
// duplicate-key error, which is caught and ignored rather than guarded with
// a read-then-write race.
//
// That index is also why several rules write a *composite* code
// (`weather_rain:2026-09-14`, `budget_90:80000`, `content_held:<id>`): the
// bare code fires once per trip and then never again, so a three-week
// monsoon trip got exactly one rain warning and a second storm the following
// week produced nothing. Suffixing the code with the thing the notification
// is actually about makes each distinct occurrence its own row while
// re-running the sweep stays idempotent.
//
// Deliberately not real-time, matching the SRS: departure reminders and
// weather advisories off stored data, no live traffic or disruption feed.
import Notification from "../models/Notification.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import Expense from "../models/Expense.js";
import Document from "../models/Document.js";
import Booking from "../models/Booking.js";
import HotelBooking from "../models/HotelBooking.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import ItineraryItem from "../models/ItineraryItem.js";
import WeatherForecast from "../models/WeatherForecast.js";

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

// How long a "how was it?" prompt stays relevant. Without an upper bound the
// trip_completed rule matches every trip that ever ended, so a traveller
// with ten finished trips met ten review prompts on their first sweep.
const COMPLETED_WINDOW_DAYS = 14;

// Which preference switch governs which template type. The three that exist
// on the User model are the three listed here; every other type (documents,
// bookings, moderation, the itinerary-ready note) has no switch and is
// always delivered, because none of them is chatter — each one is the app
// telling you about something that already happened to your own data.
const PREFERENCE_BY_TYPE = {
  departure: "notify_departure",
  review: "notify_departure", // trip_completed rides the departure switch
  weather: "notify_weather",
  budget: "notify_budget",
};

function utcDay(value) {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isoDay(value) {
  return new Date(value).toISOString().slice(0, 10);
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
    date: trip.start_date ? isoDay(trip.start_date) : "",
  };
}

function makeNotification(template, { userId, tripId, code, vars, deliverAt }) {
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
    // Unread notifications are kept for six months; markAsRead shortens this.
    expires_at: new Date(Date.now() + 180 * DAY_MS),
    deliver_at: deliverAt || new Date(),
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
      // Bounded at both ends: past the offset, but not so far past that the
      // trip is ancient history.
      const hoursSinceEnd = -hoursToEnd;
      if (hoursSinceEnd > offset_hours && hoursSinceEnd <= COMPLETED_WINDOW_DAYS * 24) {
        out.push(makeNotification(template, { userId: trip.user_id, tripId: trip._id, vars }));
      }
    }
  }
}

// Weather advisories, read from the same WeatherForecast rows FR-11 serves.
// Only the days still ahead are considered — warning someone about rain that
// already fell is noise.
//
// One row per matching *day* rather than per trip: the code carries the date,
// so a second storm later in the trip is a second notification. `deliver_at`
// holds it until the template's offset before that day, which is what the
// 24-hour offset on these templates was always supposed to mean.
function scheduleWeather(templates, trip, now, forecastsByCity, citiesByTrip, out) {
  const relevant = templates.filter((t) => t.trigger.event === "daily_weather_check");
  if (relevant.length === 0) return;

  const from = utcDay(Math.max(now.getTime(), new Date(trip.start_date).getTime()));
  const to = utcDay(trip.end_date);
  if (from > to) return;

  const cities = citiesByTrip.get(String(trip._id)) || [];
  const forecasts = cities
    .flatMap((city) => forecastsByCity.get(city) || [])
    .filter((f) => new Date(f.date) >= from && new Date(f.date) <= to)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (forecasts.length === 0) return;

  const vars = baseVars(trip);
  for (const template of relevant) {
    const { weather_conditions = [], threshold, offset_hours = 0 } = template.trigger;

    const hits = forecasts.filter((f) => {
      if (weather_conditions.length > 0) return weather_conditions.includes(f.condition);
      if (threshold == null) return false;
      // A heat rule and a cold rule share the threshold field; which side of
      // it matters is implied by the template's own code.
      return template.code.includes("cold") ? f.temp_min_c <= threshold : f.temp_max_c >= threshold;
    });

    for (const hit of hits) {
      const day = isoDay(hit.date);
      // Warn `offset_hours` before the day itself, never in the past.
      const deliverAt = new Date(Math.max(now.getTime(), new Date(hit.date).getTime() - offset_hours * HOUR_MS));
      out.push(makeNotification(template, {
        userId: trip.user_id,
        tripId: trip._id,
        code: `${template.code}:${day}`,
        deliverAt,
        vars: {
          ...vars,
          date: day,
          condition: hit.description || hit.condition,
          temp: template.code.includes("cold") ? hit.temp_min_c : hit.temp_max_c,
        },
      }));
    }
  }
}

// Budget thresholds, against logged expenses — which is what the templates
// say ("Logged expenses ... now total"), not the planned estimate.
function scheduleBudget(templates, trip, spentByTrip, out) {
  const relevant = templates.filter((t) => t.trigger.event === "budget_threshold");
  if (relevant.length === 0 || !trip.budget) return;

  const spent = spentByTrip.get(String(trip._id)) || 0;
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
    // Keyed on the budget the warning was measured against, so raising the
    // budget and spending past the threshold again is a new warning rather
    // than silence. Lowering it works the same way.
    code: `${template.code}:${Math.round(trip.budget)}`,
    vars: { ...baseVars(trip), percent, amount: Math.round(amount).toLocaleString() },
  }));
}

// Lifecycle events that are simply true or not.
function scheduleLifecycle(templates, trip, confirmedByTrip, out) {
  for (const template of templates) {
    if (template.trigger.event === "itinerary_generated" && trip.itinerary_generated_at) {
      out.push(makeNotification(template, { userId: trip.user_id, tripId: trip._id, vars: baseVars(trip) }));
    }
  }

  const bookingTemplate = templates.find((t) => t.trigger.event === "booking_confirmed");
  if (bookingTemplate && (confirmedByTrip.get(String(trip._id)) || 0) > 0) {
    out.push(makeNotification(bookingTemplate, { userId: trip.user_id, tripId: trip._id, vars: baseVars(trip) }));
  }
}

// A booking that was cancelled — usually by an admin acting for a traveller
// who phoned in, which is the one thing that changes a trip's bookings
// without the traveller doing anything. Keyed per booking, so two cancelled
// bookings are two rows.
function scheduleCancelledBookings(templates, cancelled, tripsById, out) {
  const template = templates.find((t) => t.trigger.event === "booking_cancelled");
  if (!template) return;

  for (const booking of cancelled) {
    const trip = tripsById.get(String(booking.trip_id));
    out.push(makeNotification(template, {
      userId: booking.user_id,
      tripId: booking.trip_id,
      code: `${template.code}:${booking._id}`,
      vars: {
        ...(trip ? baseVars(trip) : {}),
        reference: booking.reference || "",
        trip_id: booking.trip_id ? String(booking.trip_id) : "",
        date: booking.cancelled_at ? isoDay(booking.cancelled_at) : "",
      },
    }));
  }
}

// FR-23 — something you wrote is held for a moderator. The Community page
// says so inline, but only if you happen to still be on it; this is how you
// find out otherwise. Keyed per post/review.
function scheduleHeldContent(templates, held, out) {
  const template = templates.find((t) => t.trigger.event === "content_held");
  if (!template) return;

  for (const item of held) {
    out.push(makeNotification(template, {
      userId: item.user_id,
      tripId: null,
      code: `${template.code}:${item._id}`,
      vars: {
        content_kind: item.kind,
        excerpt: String(item.content || "").slice(0, 60),
        date: isoDay(item.created_at || Date.now()),
      },
    }));
  }
}

// Document expiry is user-scoped rather than trip-scoped, so the template
// code carries the document id to keep one row per document per rule.
function scheduleDocuments(templates, userId, now, documents, out) {
  const relevant = templates
    .filter((t) => t.trigger.event === "document_expiring")
    .sort((a, b) => a.trigger.threshold - b.trigger.threshold); // tightest first
  if (relevant.length === 0) return;

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
        date: isoDay(doc.expiry_date),
      },
    }));
  }
}

/**
 * Every read the rules need, as one query per collection rather than a
 * handful per trip. A traveller with twenty trips was costing sixty round
 * trips to Atlas on a single bell click.
 */
async function loadContext(userId, trips, templates, now) {
  const tripIds = trips.map((t) => t._id);
  const wantsWeather = templates.some((t) => t.trigger.event === "daily_weather_check");
  const documentThresholds = templates
    .filter((t) => t.trigger.event === "document_expiring")
    .map((t) => t.trigger.threshold)
    .filter((n) => n != null);

  const [items, expenses, bookings, hotelBookings, documents, posts, reviews] = await Promise.all([
    wantsWeather && tripIds.length
      ? ItineraryItem.find({ trip_id: { $in: tripIds } }).select("trip_id day city").lean()
      : [],
    tripIds.length
      ? Expense.aggregate([
          { $match: { trip_id: { $in: tripIds } } },
          { $group: { _id: "$trip_id", total: { $sum: "$amount" } } },
        ])
      : [],
    tripIds.length
      ? Booking.find({ trip_id: { $in: tripIds } }).select("trip_id user_id status reference cancelled_at").lean()
      : [],
    tripIds.length
      ? HotelBooking.find({ trip_id: { $in: tripIds } }).select("trip_id user_id status reference cancelled_at").lean()
      : [],
    documentThresholds.length
      ? Document.find({
          user_id: userId,
          is_archived: false,
          expiry_date: { $ne: null, $lte: new Date(now.getTime() + Math.max(...documentThresholds) * DAY_MS) },
        }).lean()
      : [],
    // user_id is projected explicitly: the notification is keyed on it, and
    // a projection that leaves it out produces documents that fail required
    // validation and disappear inside insertMany's error list.
    templates.some((t) => t.trigger.event === "content_held")
      ? CommunityPost.find({ user_id: userId, moderation_status: "pending" })
          .select("user_id content created_at")
          .lean()
      : [],
    templates.some((t) => t.trigger.event === "content_held")
      ? Review.find({ user_id: userId, moderation_status: "pending" })
          .select("user_id comment created_at")
          .lean()
      : [],
  ]);

  // Which city each day happens in, so a multi-city trip is warned about the
  // place it will actually be.
  const citiesByTrip = new Map();
  for (const trip of trips) {
    const own = items.filter((i) => String(i.trip_id) === String(trip._id));
    const cities = [...new Set(own.map((i) => i.city).filter(Boolean))];
    if (cities.length === 0) {
      const fallback = trip.multi_city ? trip.entry_city : trip.destination;
      if (fallback) cities.push(fallback);
    }
    citiesByTrip.set(String(trip._id), cities);
  }

  const allCities = [...new Set([...citiesByTrip.values()].flat())];
  const forecastsByCity = new Map();
  if (wantsWeather && allCities.length) {
    const forecasts = await WeatherForecast.find({
      city: { $in: allCities },
      date: { $gte: utcDay(now) },
    })
      .sort({ date: 1 })
      .lean();
    for (const f of forecasts) {
      if (!forecastsByCity.has(f.city)) forecastsByCity.set(f.city, []);
      forecastsByCity.get(f.city).push(f);
    }
  }

  const spentByTrip = new Map(expenses.map((row) => [String(row._id), row.total]));

  const confirmedByTrip = new Map();
  for (const b of [...bookings, ...hotelBookings]) {
    if (b.status !== "confirmed") continue;
    const key = String(b.trip_id);
    confirmedByTrip.set(key, (confirmedByTrip.get(key) || 0) + 1);
  }

  const cancelled = [...bookings, ...hotelBookings].filter((b) => b.status === "cancelled");

  const held = [
    ...posts.map((p) => ({ ...p, kind: "community post", content: p.content })),
    ...reviews.map((r) => ({ ...r, kind: "review", content: r.comment })),
  ];

  return { citiesByTrip, forecastsByCity, spentByTrip, confirmedByTrip, cancelled, documents, held };
}

/**
 * Evaluate every active rule for one user and insert whatever is now due.
 * Returns the number of notifications actually created.
 */
export async function sweepNotifications(userId, { now = new Date() } = {}) {
  const [allTemplates, user] = await Promise.all([
    NotificationTemplate.find({ is_active: true }).lean(),
    User.findById(userId).select("preferences").lean(),
  ]);
  if (allTemplates.length === 0) return 0;

  // The three switches on the settings page were saved, shaped by
  // publicUser() and then read by nobody — turning weather alerts off left
  // the weather alerts coming. This is where they take effect.
  const preferences = user?.preferences || {};
  const templates = allTemplates.filter((t) => {
    const key = PREFERENCE_BY_TYPE[t.type];
    return !key || preferences[key] !== false;
  });
  if (templates.length === 0) return 0;

  const trips = await Trip.find({ user_id: userId, is_archived: { $ne: true } }).lean();
  const tripsById = new Map(trips.map((t) => [String(t._id), t]));
  const context = await loadContext(userId, trips, templates, now);
  const pending = [];

  for (const trip of trips) {
    scheduleReminders(templates, trip, now, pending);
    scheduleWeather(templates, trip, now, context.forecastsByCity, context.citiesByTrip, pending);
    scheduleBudget(templates, trip, context.spentByTrip, pending);
    scheduleLifecycle(templates, trip, context.confirmedByTrip, pending);
  }
  scheduleCancelledBookings(templates, context.cancelled, tripsById, pending);
  scheduleHeldContent(templates, context.held, pending);
  scheduleDocuments(templates, userId, now, context.documents, pending);

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
      // Say *why* a row failed, not just how many did. The count-only
      // version hid a rule quietly emitting documents that could never
      // validate — the sweep reported them as created and nothing existed.
      const others = err.writeErrors.filter((e) => e.err?.code !== 11000);
      for (const e of others) {
        console.warn(`Notification sweep rejected a row: ${e.err?.errmsg || e.message || "unknown reason"}`);
      }
      // insertedDocs is what actually landed; the subtraction below is only
      // a fallback, and it is wrong whenever a document fails validation
      // client-side rather than reaching the server at all.
      return err.insertedDocs?.length ?? Math.max(0, pending.length - err.writeErrors.length);
    }
    throw err;
  }
}

export default { sweepNotifications };
