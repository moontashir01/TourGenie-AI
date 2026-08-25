// FR-05 × FR-11 × FR-12 — the rainy-day rewrite.
//
// "What if it rains?" used to be routed to the AI planner, which meant it
// needed a provider key and rewrote the whole itinerary to answer a narrow
// question. This does it from the database instead: read the forecast for
// each day, find the activities that day which the weather would spoil, and
// deal with each one of two ways.
//
//   substitute — put an indoor attraction that isn't on the plan yet into
//                the wet slot.
//   reschedule — trade slots with an indoor activity already booked for a
//                dry day, so the museum moves to the wet morning and the
//                beach moves to the dry one.
//
// Reschedule matters more than it looks. On a well-planned trip the good
// indoor options are usually already on the itinerary, so substitution has
// nothing left to offer and the honest answer is "move things around", not
// "there are no indoor alternatives here".
//
// Fully deterministic and explainable — every change traces to a forecast
// row and an `is_indoor` flag, which is a far better answer to "why did it
// choose that" than "the model decided".
import ItineraryItem from "../models/ItineraryItem.js";
import Attraction from "../models/Attraction.js";
import { resolveTripDays, isWet, SEVERE_CONDITIONS } from "./tripWeather.js";

const DAY_MS = 86400000;

// Categories worth protecting. A meal or a hotel check-in is unaffected by
// rain; sightseeing and outdoor activities are the point of the exercise.
const EXPOSED_CATEGORIES = new Set(["sightseeing", "activity"]);

// An item is exposed if the data says so. No guessing from the activity
// text — a substring match on "beach" would also catch "Beach View
// Restaurant", and a wrong swap is worse than a missed one.
function isExposed(item) {
  if (item.is_locked) return false;
  if (item.weather_dependent) return true;

  const attraction = item.attraction_id;
  if (attraction) {
    if (attraction.weather_dependent) return true;
    if (attraction.is_indoor) return false;
    return EXPOSED_CATEGORIES.has(item.category);
  }
  return false;
}

// A swap has to make sense at the time it lands on. Morning, afternoon
// and evening are coarse enough to allow useful trades and strict enough
// that a beach visit never gets moved to 21:00.
function timeBand(time) {
  const hour = Number(String(time || "").slice(0, 2));
  if (!Number.isFinite(hour)) return "any";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function isIndoorItem(item) {
  return Boolean(item.attraction_id?.is_indoor) && !item.is_locked;
}

function describe(attraction) {
  const fee = attraction.entry_fee > 0 ? `৳${attraction.entry_fee} entry` : "free";
  return `${attraction.category} · ${fee}`;
}

function dateForDay(trip, day) {
  const start = new Date(trip.start_date);
  start.setUTCHours(0, 0, 0, 0);
  return new Date(start.getTime() + (day - 1) * DAY_MS);
}

/**
 * Work out what would change if the forecast held.
 *
 * @param {object} trip  Trip document
 * @param {object} opts  { apply } — false returns a preview and touches nothing
 */
export async function planWeatherSwaps(trip, { apply = false } = {}) {
  const days = await resolveTripDays(trip);
  const wetDays = days.filter((d) => isWet(d.forecast));

  if (wetDays.length === 0) {
    return emptyResult(
      `No rain is forecast for any of your ${days.length} days in ${trip.destination}. Nothing needs changing.`
    );
  }

  const wetDayNumbers = new Set(wetDays.map((d) => d.day));
  // resolveTripDays already worked out which city each day happens in,
  // including the fallback for items that carry no city of their own.
  const cityOfDay = new Map(days.map((d) => [d.day, d.city]));
  const cityOf = (item) => item.city || cityOfDay.get(item.day) || trip.destination;
  const allItems = await ItineraryItem.find({ trip_id: trip._id })
    .populate("attraction_id", "name city category entry_fee is_indoor weather_dependent open_hours popularity rating")
    .sort({ day: 1, time: 1 })
    .lean();

  const exposed = allItems.filter((i) => wetDayNumbers.has(i.day) && isExposed(i));
  if (exposed.length === 0) {
    return {
      ...emptyResult(
        `Rain is forecast on ${wetDays.length} of your days, but nothing on those days depends on the weather — your plan already holds up.`
      ),
      rainy_days: wetDays.map(summariseDay),
    };
  }

  // ── Candidates for substitution: indoor attractions not already planned ──
  const cities = [...new Set(exposed.map(cityOf).filter(Boolean))];
  const plannedAttractionIds = new Set(
    allItems.map((i) => String(i.attraction_id?._id || i.attraction_id)).filter((id) => id && id !== "null")
  );

  const indoorInCity = await Attraction.find({
    city: { $in: cities },
    is_indoor: true,
    is_active: true,
  })
    .sort({ popularity: -1, rating: -1 })
    .lean();

  const unplannedByCity = new Map();
  const indoorCountByCity = new Map();
  for (const a of indoorInCity) {
    indoorCountByCity.set(a.city, (indoorCountByCity.get(a.city) || 0) + 1);
    if (plannedAttractionIds.has(String(a._id))) continue;
    if (!unplannedByCity.has(a.city)) unplannedByCity.set(a.city, []);
    unplannedByCity.get(a.city).push(a);
  }

  // ── Candidates for rescheduling: indoor items already on dry days ──
  const dryIndoorByCity = new Map();
  for (const item of allItems) {
    if (wetDayNumbers.has(item.day) || !isIndoorItem(item)) continue;
    const city = cityOf(item);
    if (!dryIndoorByCity.has(city)) dryIndoorByCity.set(city, []);
    dryIndoorByCity.get(city).push(item);
  }

  const swaps = [];
  const unmatched = [];
  const claimedAttractions = new Set();
  const claimedItems = new Set();

  for (const item of exposed) {
    const city = cityOf(item);
    const day = wetDays.find((d) => d.day === item.day);
    const reason =
      `${day?.forecast?.description || "Rain"} forecast in ${city || trip.destination} on ` +
      `${day ? new Date(day.date).toISOString().slice(0, 10) : "that day"}` +
      `${day?.forecast?.rain_chance_pct != null ? ` (${day.forecast.rain_chance_pct}% chance)` : ""}.`;

    // Strategy A — an indoor attraction that isn't on the plan yet.
    const substitute = (unplannedByCity.get(city) || []).find((a) => !claimedAttractions.has(String(a._id)));
    if (substitute) {
      claimedAttractions.add(String(substitute._id));
      swaps.push({
        kind: "substitute",
        item_id: item._id,
        day: item.day,
        time: item.time,
        city,
        from: { activity: item.activity, location: item.location, est_cost: item.est_cost },
        to: {
          activity: `Visit ${substitute.name}`,
          location: substitute.name,
          est_cost: substitute.entry_fee || 0,
          attraction_id: substitute._id,
          detail: describe(substitute),
          open_hours: substitute.open_hours || "",
        },
        reason,
        cost_delta: (substitute.entry_fee || 0) - (item.est_cost || 0),
      });
      continue;
    }

    // Strategy B — trade slots with an indoor activity on a dry day.
    const band = timeBand(item.time);
    const partner = (dryIndoorByCity.get(city) || []).find(
      (p) => !claimedItems.has(String(p._id)) && timeBand(p.time) === band
    );
    if (partner) {
      claimedItems.add(String(partner._id));
      swaps.push({
        kind: "reschedule",
        item_id: item._id,
        partner_id: partner._id,
        day: item.day,
        time: item.time,
        city,
        from: { activity: item.activity, location: item.location, est_cost: item.est_cost },
        to: {
          activity: partner.activity,
          location: partner.location,
          est_cost: partner.est_cost,
          attraction_id: partner.attraction_id?._id || partner.attraction_id || null,
          detail: `already on day ${partner.day} at ${partner.time} — indoor`,
          open_hours: partner.attraction_id?.open_hours || "",
        },
        moves_to: { day: partner.day, time: partner.time },
        reason: `${reason} Day ${partner.day} is dry, so the two trade places.`,
        cost_delta: 0, // nothing is added or removed, only reordered
      });
      continue;
    }

    // Nothing available — say precisely why, since the two cases call for
    // different action from the traveller.
    const indoorTotal = indoorCountByCity.get(city) || 0;
    unmatched.push({
      item_id: item._id,
      day: item.day,
      time: item.time,
      activity: item.activity,
      city,
      reason:
        indoorTotal === 0
          ? `No indoor attraction is recorded in ${city || "that city"} to move to.`
          : `Every indoor option in ${city} is already on your plan, and none of them sits on a dry day at a similar time — there is nothing sensible to trade with.`,
    });
  }

  if (apply && swaps.length > 0) {
    await applySwaps(trip, swaps);
  }

  const costDelta = swaps.reduce((sum, s) => sum + s.cost_delta, 0);
  const severe = wetDays.some((d) => SEVERE_CONDITIONS.includes(d.forecast?.condition));

  return {
    rainy_days: wetDays.map(summariseDay),
    swaps,
    unmatched,
    applied: Boolean(apply && swaps.length > 0),
    cost_delta: costDelta,
    summary: buildSummary({ trip, wetDays, swaps, unmatched, applied: apply, costDelta, severe }),
  };
}

async function applySwaps(trip, swaps) {
  for (const swap of swaps) {
    if (swap.kind === "substitute") {
      await ItineraryItem.updateOne(
        { _id: swap.item_id },
        {
          activity: swap.to.activity,
          location: swap.to.location,
          est_cost: swap.to.est_cost,
          attraction_id: swap.to.attraction_id,
          weather_dependent: false,
          source: "weather-swap",
          // The original stays in plain sight rather than being silently
          // overwritten — this is reversible by eye.
          notes: `Swapped from "${swap.from.activity}" — ${swap.reason}`,
        }
      );
      continue;
    }

    // Reschedule: the two items exchange day and time. Nothing else about
    // either changes, so the plan keeps the same content in a better order.
    await ItineraryItem.updateOne(
      { _id: swap.item_id },
      {
        day: swap.moves_to.day,
        time: swap.moves_to.time,
        date: dateForDay(trip, swap.moves_to.day),
        source: "weather-swap",
        notes: `Moved off day ${swap.day} — ${swap.reason}`,
      }
    );
    await ItineraryItem.updateOne(
      { _id: swap.partner_id },
      {
        day: swap.day,
        time: swap.time,
        date: dateForDay(trip, swap.day),
        source: "weather-swap",
        notes: `Moved onto day ${swap.day} because it is indoor and that day is wet.`,
      }
    );
  }
}

function emptyResult(summary) {
  return { rainy_days: [], swaps: [], unmatched: [], applied: false, cost_delta: 0, summary };
}

function summariseDay(d) {
  return {
    day: d.day,
    date: d.date,
    city: d.city,
    condition: d.forecast?.condition,
    description: d.forecast?.description,
    rain_chance_pct: d.forecast?.rain_chance_pct ?? null,
    rain_mm: d.forecast?.rain_mm ?? null,
    source: d.forecast?.source,
    severe: SEVERE_CONDITIONS.includes(d.forecast?.condition),
  };
}

function buildSummary({ trip, wetDays, swaps, unmatched, applied, costDelta, severe }) {
  const dayList = wetDays.map((d) => `day ${d.day}`).join(", ");
  const lines = [
    `Rain is forecast on ${wetDays.length} of your days in ${trip.destination} (${dayList})` +
      (severe ? ", including heavy rain or thunderstorms" : "") + ".",
  ];

  const substitutions = swaps.filter((s) => s.kind === "substitute").length;
  const reschedules = swaps.filter((s) => s.kind === "reschedule").length;

  if (swaps.length === 0) {
    lines.push("I couldn't find anything to move those activities to.");
  } else {
    const parts = [];
    if (substitutions) parts.push(`${substitutions} swapped for an indoor alternative`);
    if (reschedules) parts.push(`${reschedules} traded with an indoor activity on a dry day`);
    lines.push(
      applied
        ? `I've reworked ${swaps.length} ${swaps.length === 1 ? "activity" : "activities"}: ${parts.join(", ")}.`
        : `${swaps.length} ${swaps.length === 1 ? "activity" : "activities"} could be reworked: ${parts.join(", ")}.`
    );
  }

  if (costDelta !== 0 && swaps.length > 0) {
    lines.push(
      costDelta > 0
        ? `That adds about ৳${Math.abs(Math.round(costDelta)).toLocaleString()} per traveller in entry fees.`
        : `That saves about ৳${Math.abs(Math.round(costDelta)).toLocaleString()} per traveller.`
    );
  }

  if (unmatched.length > 0) {
    lines.push(
      `${unmatched.length} ${unmatched.length === 1 ? "activity has" : "activities have"} nowhere to go — worth a backup plan of your own.`
    );
  }

  if (!applied && swaps.length > 0) {
    lines.push('Say "swap the rainy days now" and I\'ll apply it.');
  }

  return lines.join(" ");
}

export default { planWeatherSwaps };
