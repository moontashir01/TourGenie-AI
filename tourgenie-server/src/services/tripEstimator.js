// FR-05 × FR-09 — answering "I want to go to Sajek for 3 days" with a real
// number, for a user who has no trip yet.
//
// The assistant used to route this to the itinerary planner, because
// "i want to go to…" matched the add-an-activity pattern. With no trip of
// their own it edited whichever trip was last open — the reported bug where
// asking about Sajek rewrote 45 items of an unrelated Thailand itinerary.
//
// The division of labour here is deliberate:
//   · every figure comes from MongoDB, through the same budgetEstimator the
//     Plan Trip form and the Budget page use, so the chat cannot quote a
//     number the rest of the app disagrees with;
//   · the language model, when one is configured, writes only the prose
//     around those figures and is told in the system prompt not to state
//     any of its own.
import Destination from "../models/Destination.js";
import Hotel from "../models/Hotel.js";
import Attraction from "../models/Attraction.js";
import ItineraryTemplate from "../models/ItineraryTemplate.js";
import ClimateNormal from "../models/ClimateNormal.js";
import CostBenchmark from "../models/CostBenchmark.js";
import { estimateTripBudget } from "./budgetEstimator.js";
import { findJourney } from "./journeyFinder.js";
import { askForText } from "./aiText.js";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Parsing ──────────────────────────────────────────────────────────
// Small, explicit patterns rather than an NLU layer. Everything unmatched
// falls back to a stated default, and the reply always says what it assumed
// so a wrong guess is visible rather than silent.

function parseDays(message) {
  const nights = message.match(/(\d+)\s*nights?\b/i);
  if (nights) return Math.min(30, Number(nights[1]) + 1); // 2 nights = 3 days
  const days = message.match(/(\d+)\s*days?\b/i);
  if (days) return Math.min(30, Number(days[1]));
  if (/\bweekend\b/i.test(message)) return 2;
  if (/\b(a|one)\s+week\b/i.test(message)) return 7;
  return null;
}

function parseTravelers(message) {
  const explicit = message.match(/(\d+)\s*(?:people|persons?|travell?ers?|pax|adults?|friends|of us)\b/i);
  if (explicit) return Math.min(20, Math.max(1, Number(explicit[1])));
  if (/\b(solo|alone|by myself|just me)\b/i.test(message)) return 1;
  if (/\b(couple|two of us|me and my (?:wife|husband|partner|girlfriend|boyfriend))\b/i.test(message)) return 2;
  if (/\bfamily\b/i.test(message)) return 4;
  return null;
}

function parseTier(message) {
  if (/\b(cheap(est|ly)?|budget|backpack|low cost|affordable|student)\b/i.test(message)) return "budget";
  if (/\b(luxury|luxurious|premium|five[- ]star|5[- ]star|resort)\b/i.test(message)) return "luxury";
  return null;
}

// Travellers type "coxs bazar" and "saint martins". Matching has to survive
// the missing apostrophe, curly quotes and doubled spaces.
function normalise(text) {
  return String(text)
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOrigin(message, destinations) {
  const from = message.match(/\bfrom\s+([A-Za-z'’\s]{3,30}?)(?:\s+(?:to|for|with|on|in)\b|[,.?!]|$)/i);
  if (!from) return null;
  const text = normalise(from[1]);
  const hit = destinations.find(
    (d) => normalise(d.name) === text || (d.aliases || []).some((a) => normalise(a) === text)
  );
  // The matched span is returned too, so the destination scan can ignore it.
  return { name: hit ? hit.name : from[1].trim(), span: from[0] };
}

/**
 * Longest name or alias mentioned anywhere in the message wins, so
 * "Saint Martin's Island" is not beaten by a stray match on a shorter name.
 */
export function matchDestination(message, destinations) {
  const haystack = ` ${normalise(message)} `;
  let best = null;
  let bestLength = 0;

  for (const destination of destinations) {
    const candidates = [destination.name, ...(destination.aliases || [])];
    for (const candidate of candidates) {
      const needle = normalise(candidate);
      if (needle.length < 3) continue;
      // Loose word boundaries: apostrophes and spaces inside names mean \b
      // is unreliable ("Cox's Bazar"), so bracket with non-letters instead.
      const pattern = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
      if (pattern.test(haystack) && needle.length > bestLength) {
        best = destination;
        bestLength = needle.length;
      }
    }
  }
  return best;
}

export async function parseTripQuery(message, { defaultOrigin = "Dhaka" } = {}) {
  const destinations = await Destination.find({ is_active: true })
    .select("slug name aliases country country_code type summary description highlights avg_daily_cost recommended_days best_months peak_season tags lat_lng")
    .lean();

  const origin = parseOrigin(message, destinations);
  // Blank the "from …" clause before looking for the destination.
  const withoutOrigin = origin?.span ? message.replace(origin.span, " ") : message;
  const destination = matchDestination(withoutOrigin, destinations);

  return {
    destination,
    days: parseDays(message),
    travelers: parseTravelers(message),
    tier: parseTier(message),
    origin: origin?.name || defaultOrigin,
    known_destinations: destinations,
  };
}

// ── Estimate ─────────────────────────────────────────────────────────

export async function buildTripEstimate({ destination, days, travelers, tier, origin, month }) {
  const resolvedDays = days || destination.recommended_days || 3;
  const resolvedTravelers = travelers || 2;
  const resolvedTier = tier || "mid";
  const resolvedMonth = month || new Date().getUTCMonth() + 1;

  const [journey, hotels, attractions, template, climate, tiers] = await Promise.all([
    findJourney(origin, destination.name),
    Hotel.find({ destination_id: destination._id, is_active: true })
      .sort({ price_per_night: 1 })
      .select("name price_per_night rating budget_tier area")
      .lean(),
    Attraction.find({ destination_id: destination._id, is_active: true })
      .sort({ popularity: -1 })
      .limit(4)
      .select("name category entry_fee is_free")
      .lean(),
    ItineraryTemplate.findOne({ destination_id: destination._id, is_active: true })
      .sort({ popularity: -1 })
      .select("title duration_days est_total_cost_per_person summary")
      .lean(),
    ClimateNormal.findOne({ destination_id: destination._id, month: resolvedMonth }).lean(),
    CostBenchmark.find({ destination_id: destination._id }).lean(),
  ]);

  // A hotel in the requested tier prices the stay more honestly than the
  // generic per-person accommodation figure.
  const tierHotel = hotels.find((h) => h.budget_tier === resolvedTier) || hotels[0] || null;

  const budget = await estimateTripBudget({
    destinations: [destination],
    days: resolvedDays,
    travelers: resolvedTravelers,
    tier: resolvedTier,
    hotelPricePerNight: tierHotel?.price_per_night ?? null,
    transportFare: journey?.est_fare_bdt || null,
  });

  const perDayByTier = {};
  for (const t of tiers) {
    perDayByTier[t.tier] = Object.values(t.per_person_per_day).reduce((a, b) => a + b, 0);
  }

  return {
    destination,
    origin,
    days: resolvedDays,
    travelers: resolvedTravelers,
    tier: resolvedTier,
    month: resolvedMonth,
    month_name: MONTHS[resolvedMonth - 1],
    assumed: {
      days: !days,
      travelers: !travelers,
      tier: !tier,
    },
    budget,
    per_day_by_tier: perDayByTier,
    journey,
    hotels: { cheapest: hotels[0] || null, in_tier: tierHotel, count: hotels.length },
    attractions,
    template,
    climate,
  };
}

// ── Wording ──────────────────────────────────────────────────────────

const money = (n) => `৳${Math.round(n).toLocaleString()}`;

function duration(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/** The factual block. Always rendered, never written by a model. */
export function formatEstimateFacts(e) {
  const lines = [];
  const { budget, destination } = e;

  const who = e.travelers === 1 ? "1 traveller" : `${e.travelers} travellers`;
  lines.push(`**${destination.name} · ${e.days} days · ${who} · ${e.tier}-range**`);

  if (budget.has_benchmark) {
    lines.push(`Estimated total: ${money(budget.estimated_total)} (${money(Math.round(budget.estimated_total / e.travelers))} per person)`);
    const parts = budget.lines
      .filter((l) => l.amount > 0)
      .map((l) => `${l.label} ${money(l.amount)}`)
      .join(" · ");
    if (parts) lines.push(parts);
    lines.push(`Bare minimum for this trip: ${money(budget.minimum_total)}`);
  }

  if (e.journey) {
    lines.push(
      `Getting there: ${e.journey.from} → ${destination.name}, ${e.journey.distance_km} km, about ${duration(e.journey.duration_min)} by ${e.journey.mode}` +
        (e.journey.est_fare_bdt ? `, fare around ${money(e.journey.est_fare_bdt)} each way` : "") +
        (!e.journey.direct && e.journey.via.length ? ` (via ${e.journey.via.join(", ")})` : "")
    );
  }

  if (e.hotels.in_tier) {
    lines.push(`Where to stay: ${e.hotels.in_tier.name} from ${money(e.hotels.in_tier.price_per_night)}/night — ${e.hotels.count} places on file.`);
  }

  if (e.climate) {
    lines.push(
      `${e.month_name} weather: ${e.climate.temp_min_c}–${e.climate.temp_max_c} °C, around ${e.climate.rain_days} rainy days` +
        (e.climate.is_good_for_travel ? "." : " — not the best month to go.")
    );
  }

  if (e.attractions.length) {
    lines.push(`Worth seeing: ${e.attractions.map((a) => a.name).join(", ")}.`);
  }

  const assumptions = [];
  if (e.assumed.days) assumptions.push(`${e.days} days`);
  if (e.assumed.travelers) assumptions.push(who);
  if (e.assumed.tier) assumptions.push(`${e.tier}-range`);
  if (assumptions.length) {
    lines.push(`_Assumed ${assumptions.join(", ")} — tell me otherwise and I'll redo it._`);
  }

  return lines.join("\n");
}

/** Deterministic opening, used when no model is configured or it fails. */
function fallbackOpening(e) {
  const bits = [e.destination.summary];
  if (e.climate?.travel_advice) bits.push(e.climate.travel_advice);
  return bits.filter(Boolean).join(" ");
}

/**
 * Asks the model for the wording only. The brief carries the facts so the
 * reply is grounded, and the system prompt forbids it from stating figures —
 * those are appended from `formatEstimateFacts` regardless of what comes
 * back, so a hallucinated number can never reach the traveller.
 */
async function writeOpening(e) {
  const brief = [
    `Destination: ${e.destination.name}, ${e.destination.country} (${e.destination.type})`,
    `Summary: ${e.destination.summary}`,
    e.destination.highlights?.length ? `Highlights: ${e.destination.highlights.join(", ")}` : "",
    `Trip: ${e.days} days, ${e.travelers} travellers, ${e.tier}-range, travelling from ${e.origin}`,
    e.journey ? `Journey: ${e.journey.mode}${e.journey.direct ? "" : ` via ${e.journey.via.join(", ")}`}` : "",
    e.climate ? `${e.month_name}: ${e.climate.rain_days} rainy days, ${e.climate.travel_advice}` : "",
    e.template ? `A ${e.template.duration_days}-day plan exists: ${e.template.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You are the travel assistant for TourGenie AI, a trip planner for Bangladesh and nearby countries. " +
    "Write 2–3 short sentences introducing this trip: what the place is like and the one practical thing " +
    "that most affects planning it. Warm but plain — no marketing language, no lists, no headings. " +
    "STRICT RULE: never state any price, cost, distance, duration or temperature. The application renders " +
    "all figures itself directly beneath your text. Mentioning a number would risk contradicting it.";

  const result = await askForText(system, brief);
  return result ? { text: result.text, provider: result.provider } : null;
}

/**
 * Full reply: model-written opening where available, database facts always.
 */
export async function describeEstimate(e, { useModel = true } = {}) {
  let opening = fallbackOpening(e);
  let source = "database";

  if (useModel) {
    const written = await writeOpening(e);
    if (written) {
      opening = written.text;
      source = written.provider;
    }
  }

  return { reply: `${opening}\n\n${formatEstimateFacts(e)}`, source };
}

export default { parseTripQuery, buildTripEstimate, describeEstimate, matchDestination, formatEstimateFacts };
