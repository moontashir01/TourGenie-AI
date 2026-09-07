import Trip from "../models/Trip.js";
import Destination from "../models/Destination.js";
import Country from "../models/Country.js";
import TransportOption from "../models/TransportOption.js";
import FlightOption from "../models/FlightOption.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Booking from "../models/Booking.js";
import HotelBooking from "../models/HotelBooking.js";
import TripShare from "../models/TripShare.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findTripForUser, resolveTrip, EDIT, VIEW, OWN } from "../services/tripAccess.js";
import { toBdt, normalizeCode } from "../utils/currency.js";
import { estimateTripBudget, resolveBudgetTier, verdictFor } from "../services/budgetEstimator.js";
import { buildBudgetSummary } from "./expenseController.js";
import { buildTripPdf, tripPdfFilename } from "../services/tripPdf.js";
import { sendMail, tripConfirmationEmail } from "../services/mailer.js";

const DESTINATION_FIELDS = "name country country_code timezone currency pricing_currency nearest_airport type";
const MAX_TRIP_DAYS = 60;
const MAX_TRAVELERS = 20;
const MAX_TRIP_TITLE = 80;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function badRequest(message, details) {
  const error = new Error(message);
  error.status = 400;
  if (details) error.details = details;
  return error;
}

async function resolveDestination({ id, name, required = false }) {
  let destination = null;
  if (id) destination = await Destination.findOne({ _id: id, is_active: true });
  if (!destination && name?.trim()) {
    const exact = new RegExp(`^${escapeRegex(name.trim())}$`, "i");
    destination = await Destination.findOne({ is_active: true, $or: [{ name: exact }, { aliases: exact }] });
  }
  if (!destination && required) {
    throw badRequest(`Unsupported destination: ${name || id || "not provided"}`);
  }
  return destination;
}

// ── getting to the destination ───────────────────────────────────────
// The cost estimate used to price only what happens *at* the destination:
// beds, food, local transport. The form meanwhile asked whether the budget
// "covers the flights in and out", so a traveler could tick that box, set
// their budget to the quoted figure and be over it the moment a real fare
// appeared on the Budget page. Now the trip in and out is priced too —
// from the seeded TransportOption fare where one exists, and flagged as
// missing where it doesn't, so the form can say which it is.

/** Cheapest seeded fare between two cities, per passenger, one way. */
async function seededFare(origin, destination) {
  if (!origin || !destination) return null;
  const byId =
    origin._id && destination._id
      ? { from_destination_id: origin._id, to_destination_id: destination._id }
      : null;
  const byName = {
    from_city: new RegExp(`^${escapeRegex(origin.name)}$`, "i"),
    to_city: new RegExp(`^${escapeRegex(destination.name)}$`, "i"),
  };
  const option = await TransportOption.findOne({
    is_active: true,
    ...(byId ? { $or: [byId, byName] } : byName),
  })
    .sort({ fare: 1 })
    .lean();
  return option ? { fare: option.fare, mode: option.mode, operator: option.operator } : null;
}

/**
 * Cheapest seeded airfare between two cities, per passenger, one way.
 *
 * The estimate cannot ask a live flight provider: it re-runs on every
 * keystroke, and a provider round trip is seconds where this has to be
 * milliseconds. So an international trip used to be priced with no journey in
 * it at all, and ticking "this budget covers getting there and back" moved
 * the figure by nothing. FlightOption is the seeded catalogue the rest of the
 * app already falls back to; the number is indicative and the response says
 * so, which is the same bargain every other provider here is on.
 *
 * Nobody flies Dhaka to Phuket directly and the catalogue doesn't pretend
 * otherwise: with no direct row the fare is the border hop plus the cheapest
 * domestic connection on to the arrival city.
 */
async function seededAirFare(origin, arrivalCity) {
  const from = origin?.nearest_airport;
  const to = arrivalCity?.nearest_airport;
  if (!from || !to || from === to) return null;

  const cheapest = (query) =>
    FlightOption.findOne({ is_active: true, ...query }).sort({ total_fare_bdt: 1 }).lean();

  const direct = await cheapest({ from_iata: from, to_iata: to });
  if (direct) {
    return { fare: direct.total_fare_bdt, mode: "flight", operator: direct.airline, via: null };
  }

  const borderHops = await FlightOption.find({ is_active: true, from_iata: from, is_domestic: false })
    .sort({ total_fare_bdt: 1 })
    .lean();
  for (const hop of borderHops) {
    const onward = await cheapest({ from_iata: hop.to_iata, to_iata: to });
    // An onward leg existing is what proves this gateway is in the right
    // country — no separate country check needed.
    if (onward) {
      return {
        fare: hop.total_fare_bdt + onward.total_fare_bdt,
        mode: "flight",
        operator: hop.airline,
        via: hop.to_city,
      };
    }
  }
  return null;
}

/**
 * What it costs to reach the trip and come home, per passenger one way.
 *
 * `fare: null` with `needs_airfare: true` is the honest answer when even the
 * seeded flight catalogue has nothing for the route. The form surfaces that
 * as "airfare not included" rather than quietly costing the trip at zero.
 */
async function resolveTravelFare({ origin, arrivalCity }) {
  if (!origin || !arrivalCity) return { fare: null, mode: "", needs_airfare: false, known: false };
  if (String(origin._id) === String(arrivalCity._id)) {
    return { fare: 0, mode: "none", needs_airfare: false, known: true };
  }
  const international = (origin.country_code || "") !== (arrivalCity.country_code || "");
  if (!international) {
    const ground = await seededFare(origin, arrivalCity);
    if (ground) return { ...ground, needs_airfare: false, known: true };
    return { fare: null, mode: "", needs_airfare: false, known: false };
  }

  const air = await seededAirFare(origin, arrivalCity);
  if (air) return { ...air, needs_airfare: false, known: true, is_indicative: true };
  return { fare: null, mode: "flight", needs_airfare: true, known: false };
}

// ── the trip's name ────────────────────────────────────────────────
// Travelers plan more than one trip to the same city, and "Cox's Bazar"
// twice over tells them nothing apart. The form now offers a name; when it
// is left blank the trip still gets one, generated from what was filled in.

/** undefined = not supplied (leave alone); "" = blank (fall back to auto). */
function parseTripTitle(raw) {
  if (raw === undefined || raw === null) return undefined;
  const title = String(raw).replace(/\s+/g, " ").trim();
  if (title.length > MAX_TRIP_TITLE) {
    throw badRequest(`Trip name can't be longer than ${MAX_TRIP_TITLE} characters`);
  }
  return title;
}

/** "4 days in Cox's Bazar" — never empty, so a trip always has a name. */
function autoTripTitle(days, destination) {
  const place = (destination || "").trim();
  if (!Number.isFinite(Number(days)) || Number(days) < 1) {
    return place ? `Trip to ${place}` : "Untitled trip";
  }
  const count = Number(days);
  const span = `${count} day${count > 1 ? "s" : ""}`;
  return place ? `${span} in ${place}` : `A ${span} trip`;
}

function allowedTripFields(body) {
  return {
    title: parseTripTitle(body.title),
    interests: body.interests,
    transport_preference: body.transport_preference,
    hotel_preference: body.hotel_preference,
    food_preference: body.food_preference,
    notes: body.notes,
    selected_flight: body.selected_flight,
    must_visit_attraction_ids: body.must_visit_attraction_ids,
  };
}

// ── input validation ─────────────────────────────────────────────────
// The form used to post whatever its inputs happened to hold: a blank
// travellers box arrived as 0 and surfaced as a raw mongoose validation
// error, and a reversed date range quietly became a one-day trip that
// poisoned every per-day cost. Each value is checked here with a message a
// traveler can act on.

function parseTripDates(body) {
  const start = new Date(body.start_date);
  const end = new Date(body.end_date);
  if (!body.start_date || Number.isNaN(start.getTime())) throw badRequest("A valid start date is required");
  if (!body.end_date || Number.isNaN(end.getTime())) throw badRequest("A valid end date is required");
  if (end < start) throw badRequest("End date must be on or after the start date");
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  if (days > MAX_TRIP_DAYS) throw badRequest(`Trips longer than ${MAX_TRIP_DAYS} days can't be planned in one go`);
  return { start, end, days };
}

function parseTravelers(body) {
  const travelers = Number(body.travelers);
  if (!Number.isInteger(travelers) || travelers < 1) {
    throw badRequest("Number of travelers must be a whole number of at least 1");
  }
  if (travelers > MAX_TRAVELERS) {
    throw badRequest(`Groups larger than ${MAX_TRAVELERS} need to be planned as separate trips`);
  }
  return travelers;
}

// Budget is stored in BDT whatever the traveler typed it in, so a USD figure
// can never be summed against BDT hotel and activity costs.
async function parseBudget(body, { optional = false } = {}) {
  const raw = body.budget;
  const missing = raw === undefined || raw === null || raw === "";
  if (missing && optional) {
    // The estimate endpoint is useful before a budget has been typed —
    // that is how the form suggests one in the first place.
    return {
      budget: null,
      budget_input: null,
      budget_currency: normalizeCode(body.budget_currency),
      budget_includes_flights: body.budget_includes_flights !== false,
    };
  }
  if (missing) throw badRequest("Budget is required");
  const value = Number(raw);
  if (!Number.isFinite(value)) throw badRequest("Budget must be a number");
  if (value <= 0) throw badRequest("Budget must be greater than zero");

  const currency = normalizeCode(body.budget_currency);
  const { amount, converted } = await toBdt(value, currency);
  if (!converted && currency !== "BDT") throw badRequest(`Unsupported budget currency: ${currency}`);

  return {
    budget: Math.round(amount),
    budget_input: value,
    budget_currency: currency,
    budget_includes_flights: body.budget_includes_flights !== false,
  };
}

// A country-level trip ("Thailand", not one city) needs at least two active
// destinations for the AI to actually route between — otherwise it's just a
// worse version of picking the one city directly.
async function resolveCountryTrip(countryCode) {
  const country = await Country.findOne({ code: String(countryCode).toUpperCase(), is_active: true });
  if (!country) throw badRequest(`Unsupported country: ${countryCode}`);
  const cities = await Destination.find({ country_code: country.code, is_active: true }).sort({ popularity: -1 });
  if (cities.length < 2) {
    throw badRequest(`${country.name} doesn't have multiple cities set up for a country-wide trip yet`);
  }
  return { country, cities };
}

// Roughly the cities the AI will end up choosing for a country trip — a new
// city about every three days, gateway city always included. Costing against
// these is much closer than costing against the country's whole catalogue.
function likelyCitiesForCountryTrip(cities, entryCity, days) {
  const wanted = Math.min(cities.length, Math.max(1, Math.ceil(days / 3)));
  const picked = [entryCity];
  for (const city of cities) {
    if (picked.length >= wanted) break;
    if (String(city._id) !== String(entryCity._id)) picked.push(city);
  }
  return picked;
}

/**
 * Everything both trip creation and the live estimate need: validated
 * inputs, the destination(s) being costed, and the resulting BDT estimate.
 */
async function buildTripPlan(body, { budgetOptional = false, user = null } = {}) {
  const { start, end, days } = parseTripDates(body);
  const travelers = parseTravelers(body);
  const budget = await parseBudget(body, { optional: budgetOptional });
  const tier = resolveBudgetTier(body);

  const origin = await resolveDestination({
    id: body.origin_destination_id,
    name: body.origin || user?.city,
  });

  let scope;
  if (body.country_code) {
    const { country, cities } = await resolveCountryTrip(body.country_code);
    const entryCity = cities.find((c) => c.name === country.capital) || cities[0];
    // Cities the traveler explicitly picked on the form. Only names that are
    // real destinations in this country survive — both the cost estimate and
    // the AI planner honour the picks instead of guessing.
    const wanted = Array.isArray(body.preferred_cities) ? body.preferred_cities : [];
    const preferredCities = wanted
      .map((name) => cities.find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase()))
      .filter(Boolean);
    scope = {
      multi_city: true,
      country,
      cities,
      entryCity,
      preferredCities,
      label: country.name,
      costDestinations: preferredCities.length
        ? preferredCities
        : likelyCitiesForCountryTrip(cities, entryCity, days),
      pricingCurrency: country.pricing_currency || "BDT",
    };
  } else {
    const destination = await resolveDestination({
      id: body.destination_id,
      name: body.destination,
      required: true,
    });
    // A trip that starts and ends in the same place isn't a trip — it used to
    // be accepted and then priced with a zero-length journey.
    if (origin && String(origin._id) === String(destination._id)) {
      throw badRequest(`You're already in ${destination.name} — pick a different destination.`);
    }
    scope = {
      multi_city: false,
      destination,
      label: destination.name,
      costDestinations: [destination],
      pricingCurrency: destination.pricing_currency || "BDT",
    };
  }

  // Where the traveler physically arrives: the gateway city on a country
  // trip, the destination itself otherwise.
  const arrivalCity = scope.multi_city ? scope.entryCity : scope.destination;
  const travel = await resolveTravelFare({ origin, arrivalCity });

  // Only charge the journey against the budget when the traveler said the
  // budget is meant to cover it — that checkbox now changes the number it
  // sits next to instead of being decorative.
  const fareInBudget = budget.budget_includes_flights ? travel.fare : null;

  const estimate = await estimateTripBudget({
    destinations: scope.costDestinations,
    days,
    travelers,
    tier,
    transportFare: fareInBudget,
  });

  return {
    dates: { start, end, days },
    travelers,
    budget,
    tier,
    origin,
    scope,
    travel: {
      ...travel,
      // Airfare is missing from the figure above: either we have no fare for
      // this hop, or the traveler said their budget doesn't cover it.
      counted: fareInBudget != null,
      excluded_from_estimate: travel.needs_airfare && budget.budget_includes_flights,
    },
    estimate,
    verdict: budget.budget == null ? "unknown" : verdictFor(budget.budget, estimate),
  };
}

function assertBudgetIsPlannable(plan) {
  if (plan.budget.budget == null) return;
  if (!plan.estimate.has_benchmark) return;
  if (plan.budget.budget >= plan.estimate.minimum_total) return;
  const { days } = plan.dates;
  const people = `${plan.travelers} traveler${plan.travelers > 1 ? "s" : ""}`;
  throw badRequest(
    `A ${days}-day trip to ${plan.scope.label} for ${people} needs at least ` +
      `BDT ${plan.estimate.minimum_total.toLocaleString("en-US")} just for beds, food and local transport — ` +
      `BDT ${plan.budget.budget.toLocaleString("en-US")} won't cover it.`,
    { estimate: plan.estimate, verdict: "below_minimum" }
  );
}

// POST /api/trips/estimate — what the trip costs, without creating anything.
// Drives the live figure under the budget field on the Plan a trip form.
export const estimateTrip = asyncHandler(async (req, res) => {
  const plan = await buildTripPlan(req.body, { budgetOptional: true, user: req.user });
  res.json({
    estimate: plan.estimate,
    verdict: plan.verdict,
    budget_bdt: plan.budget.budget,
    budget_currency: plan.budget.budget_currency,
    budget_tier: plan.tier,
    destination: plan.scope.label,
    cities_costed: plan.scope.costDestinations.map((c) => c.name),
    // What getting there costs, and whether it is inside the figure above.
    travel: plan.travel,
  });
});

// FR-03 — Trip Creation
export const createTrip = asyncHandler(async (req, res) => {
  const plan = await buildTripPlan(req.body, { user: req.user });
  assertBudgetIsPlannable(plan);

  const origin = plan.origin;

  const common = {
    ...allowedTripFields(req.body),
    ...plan.budget,
    travelers: plan.travelers,
    start_date: plan.dates.start,
    end_date: plan.dates.end,
    budget_tier: plan.tier,
    // FR-09 — the split is computed up front, so the Budget page has real
    // numbers to show before the AI itinerary has ever run.
    budget_breakdown: plan.estimate.lines,
    estimated_total: plan.estimate.estimated_total,
    user_id: req.user._id,
    origin: origin?.name || req.body.origin || req.user.city || "",
    origin_destination_id: origin?._id || null,
    status: "draft",
  };

  // A blank name is not an error — it just means the trip is named for us.
  if (!common.title) common.title = autoTripTitle(plan.dates.days, plan.scope.label);

  if (plan.scope.multi_city) {
    const trip = await Trip.create({
      ...common,
      destination: plan.scope.country.name,
      destination_id: null,
      multi_city: true,
      country_code: plan.scope.country.code,
      entry_city: plan.scope.entryCity.name,
      preferred_cities: plan.scope.preferredCities.map((c) => c.name),
      currency: plan.scope.pricingCurrency,
    });
    return res.status(201).json({ trip, estimate: plan.estimate, verdict: plan.verdict });
  }

  const trip = await Trip.create({
    ...common,
    destination: plan.scope.destination.name,
    destination_id: plan.scope.destination._id,
    currency: plan.scope.pricingCurrency,
  });
  res.status(201).json({ trip, estimate: plan.estimate, verdict: plan.verdict });
});

// List the logged-in traveler's trips (Dashboard / My Trips).
//
// Owned and shared-with-me in one list, each carrying the role its reader
// holds, so the dashboard can badge a shared trip and hide the controls a
// viewer isn't allowed to press instead of finding out from a 404.
export const getMyTrips = asyncHandler(async (req, res) => {
  const shares = await TripShare.find({ shared_with_user_id: req.user._id, status: "accepted" })
    .select("trip_id role")
    .lean();
  const roleByTrip = new Map(shares.map((s) => [String(s.trip_id), s.role]));

  const trips = await Trip.find({
    $or: [{ user_id: req.user._id }, { _id: { $in: shares.map((s) => s.trip_id) } }],
  })
    .populate("origin_destination_id", DESTINATION_FIELDS)
    .populate("destination_id", DESTINATION_FIELDS)
    .populate("user_id", "name email")
    .sort({ created_at: -1 })
    .lean();

  res.json({
    trips: trips.map((trip) => {
      const owned = String(trip.user_id?._id || trip.user_id) === String(req.user._id);
      return {
        ...trip,
        // The owner's name is only worth carrying on a trip that isn't yours.
        owner: owned ? null : { name: trip.user_id?.name || "", email: trip.user_id?.email || "" },
        user_id: trip.user_id?._id || trip.user_id,
        shared: !owned,
        role: owned ? OWN : roleByTrip.get(String(trip._id)) || VIEW,
      };
    }),
  });
});

export const getTripById = asyncHandler(async (req, res) => {
  const { trip, role } = await resolveTrip(req.params.id, req.user._id, {
    level: VIEW,
    populate: [
      "hotel_id",
      "hotel_selections.hotel_id",
      "must_visit_attraction_ids",
      ["origin_destination_id", DESTINATION_FIELDS],
      ["destination_id", DESTINATION_FIELDS],
    ],
  });
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  // The reader's role rides along so the page can render itself read-only
  // rather than offering buttons the API will refuse.
  res.json({ trip, role, shared: role !== OWN });
});

// Anything that moves the cost model — dates, party size, tier, budget — has
// to re-run the breakdown, otherwise the stored split describes a trip that
// no longer exists.
const COST_FIELDS = [
  "start_date",
  "end_date",
  "travelers",
  "budget",
  "budget_currency",
  "budget_tier",
  "hotel_preference",
  "budget_includes_flights",
  "preferred_cities", // which cities a country trip visits moves the cost model too
  // The journey in and out is priced into the breakdown now, so moving the
  // starting point changes the total.
  "origin",
  "origin_destination_id",
];

export const updateTrip = asyncHandler(async (req, res) => {
  const existing = await findTripForUser(req.params.id, req.user._id, { level: EDIT });
  if (!existing) return res.status(404).json({ message: "Trip not found" });

  const updates = Object.fromEntries(
    Object.entries(allowedTripFields(req.body)).filter(([, value]) => value !== undefined),
  );

  // Clearing the name hands it back to the generator rather than leaving
  // the trip nameless everywhere it is listed.
  if (updates.title === "") {
    updates.title = autoTripTitle(existing.duration_days, existing.destination);
  }

  if (req.body.destination_id || req.body.destination) {
    const destination = await resolveDestination({
      id: req.body.destination_id,
      name: req.body.destination,
      required: true,
    });
    updates.destination = destination.name;
    updates.destination_id = destination._id;
    updates.currency = destination.pricing_currency || "BDT";
  }
  if (req.body.origin_destination_id || req.body.origin) {
    const origin = await resolveDestination({
      id: req.body.origin_destination_id,
      name: req.body.origin,
      required: Boolean(req.body.origin_destination_id),
    });
    updates.origin = origin?.name || req.body.origin;
    updates.origin_destination_id = origin?._id || null;
  }
  if (req.body.budget_includes_flights !== undefined) {
    updates.budget_includes_flights = req.body.budget_includes_flights !== false;
  }

  // Dates and travellers are only accepted through the cost re-run below, so
  // they get the same validation trip creation does.
  if (COST_FIELDS.some((field) => req.body[field] !== undefined)) {
    const merged = {
      start_date: req.body.start_date ?? existing.start_date,
      end_date: req.body.end_date ?? existing.end_date,
      travelers: req.body.travelers ?? existing.travelers,
      // budget_input is what the traveler typed; falling back to the stored
      // BDT figure keeps trips created before this field existed working.
      budget: req.body.budget ?? existing.budget_input ?? existing.budget,
      budget_currency: req.body.budget_currency ?? existing.budget_currency,
      budget_tier: req.body.budget_tier ?? existing.budget_tier,
      hotel_preference: req.body.hotel_preference ?? existing.hotel_preference,
      budget_includes_flights: updates.budget_includes_flights ?? existing.budget_includes_flights,
      destination_id: updates.destination_id ?? existing.destination_id,
      destination: updates.destination ?? existing.destination,
      // The journey in and out is part of the cost now, so the re-run needs
      // to know where the traveler is starting from.
      origin_destination_id: updates.origin_destination_id ?? existing.origin_destination_id,
      origin: updates.origin ?? existing.origin,
      ...(existing.multi_city
        ? {
            country_code: existing.country_code,
            preferred_cities: req.body.preferred_cities ?? existing.preferred_cities,
          }
        : {}),
    };
    const plan = await buildTripPlan(merged, { user: req.user });
    assertBudgetIsPlannable(plan);
    Object.assign(updates, plan.budget, {
      travelers: plan.travelers,
      start_date: plan.dates.start,
      end_date: plan.dates.end,
      budget_tier: plan.tier,
      budget_breakdown: plan.estimate.lines,
      estimated_total: plan.estimate.estimated_total,
    });
    if (existing.multi_city) {
      updates.preferred_cities = (plan.scope.preferredCities || []).map((c) => c.name);
    }
  }

  // Access was settled above; this addresses the same document by id.
  const trip = await Trip.findByIdAndUpdate(existing._id, updates, { new: true, runValidators: true });
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  res.json({ trip });
});

// Deleting is the owner's alone, whatever an editor has been given.
export const deleteTrip = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.params.id, req.user._id, { level: OWN });
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  await Trip.findByIdAndDelete(trip._id);
  // The invitations die with the trip they let people into.
  await TripShare.deleteMany({ trip_id: trip._id });
  res.json({ message: "Trip deleted" });
});

// FR-07 × FR-12 — which cities this trip actually covers.
//
// `preferred_cities` was written by the Plan form and then read by nothing:
// the Hotels and Attractions pages each derived their own city list from the
// whole country, so a Phuket + Chiang Mai trip offered Bangkok hotels. The
// rule lives here rather than in two pages so it stays the rule the planner
// narrows its own candidate pool with (loadAttractionContext).
//
// `all_cities` rides along so the pages can offer "show every city in the
// country" — a traveller may well want a hotel somewhere they didn't pick.
export const getTripCities = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.params.id, req.user._id, {
    level: VIEW,
    populate: [["destination_id", DESTINATION_FIELDS]],
  });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  // A single-destination trip has one city and nothing to show all of.
  if (!trip.multi_city || !trip.country_code) {
    const only = [trip.destination_id?.name || trip.destination].filter(Boolean);
    return res.json({
      cities: only,
      all_cities: only,
      filtered: false,
      source: "destination",
      country: trip.destination_id?.country || "",
    });
  }

  const [country, catalogue] = await Promise.all([
    Country.findOne({ code: trip.country_code }).lean(),
    Destination.find({ country_code: trip.country_code, is_active: true }).sort({ popularity: -1 }).select("name").lean(),
  ]);
  const allCities = catalogue.map((c) => c.name);
  const byName = new Map(catalogue.map((c) => [c.name.toLowerCase(), c.name]));
  const answer = (cities, source, filtered) =>
    res.json({ cities, all_cities: allCities, filtered, source, country: country?.name || trip.destination });

  // The traveller's own picks win. They are stored as names, so one that has
  // since left the catalogue is dropped rather than offered as a dead tab.
  const preferred = (trip.preferred_cities || [])
    .map((name) => byName.get(String(name).trim().toLowerCase()))
    .filter(Boolean);
  if (preferred.length) return answer(preferred, "preferred", preferred.length < allCities.length);

  // No picks — the cities the generated plan routes through are the next best
  // answer, and the only one available before anything was picked.
  const items = await ItineraryItem.find({ trip_id: trip._id }).select("city day").sort({ day: 1 }).lean();
  const routed = [...new Set(items.map((i) => i.city).filter(Boolean))]
    .map((name) => byName.get(String(name).toLowerCase()))
    .filter(Boolean);
  if (routed.length) return answer(routed, "itinerary", routed.length < allCities.length);

  return answer(allCities, "country", false);
});

// ── FR-03 — confirming a trip, and the email that follows ────────────
//
// Deliberately its own action rather than a hook on the draft → planned
// transition `persistItinerary` performs: that transition repeats on every
// regeneration, and a traveller tweaking their plan four times should not
// receive four confirmations.

/**
 * Renders the plan and mails it. Runs after the response has gone out, so a
 * slow SMTP handshake never shows up as a slow confirm — the trip is
 * confirmed whether or not the mail lands.
 *
 * `confirmation_email_sent_at` is claimed by the caller *before* this runs
 * and released here if nothing was actually delivered, so the field means
 * "the traveller has this email", not "we tried once".
 */
async function sendConfirmationEmail(trip, user) {
  const release = () =>
    Trip.updateOne({ _id: trip._id }, { $set: { confirmation_email_sent_at: null } }).catch(() => {});

  try {
    const [items, budget, transport, hotels] = await Promise.all([
      ItineraryItem.find({ trip_id: trip._id }).sort({ day: 1, time: 1 }).lean(),
      // The same summary the Budget page renders — the confirmation must not
      // be a fourth place that adds a trip up for itself.
      buildBudgetSummary(trip),
      Booking.find({ trip_id: trip._id, status: { $ne: "cancelled" } }).populate("transport_id").lean(),
      HotelBooking.find({ trip_id: trip._id, status: { $ne: "cancelled" } }).lean(),
    ]);

    const pdf = await buildTripPdf({ trip, items, budget, transport, hotels });
    const { subject, text, html } = tripConfirmationEmail({ name: user.name, trip, budget });

    const result = await sendMail({
      to: user.email,
      subject,
      text,
      html,
      attachments: [{ filename: tripPdfFilename(trip), content: pdf, contentType: "application/pdf" }],
    });

    if (!result.delivered) await release();
    return result;
  } catch (err) {
    await release();
    console.error("[trips] confirmation email failed:", err.message);
    return { delivered: false, reason: "build_failed", error: err.message };
  }
}

// Confirming books the plan in and emails it — the owner's call, not a
// collaborator's.
export const confirmTrip = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.params.id, req.user._id, {
    level: OWN,
    populate: ["hotel_id", "hotel_selections.hotel_id", ["destination_id", DESTINATION_FIELDS]],
  });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const itemCount = await ItineraryItem.countDocuments({ trip_id: trip._id });
  if (itemCount === 0) {
    throw badRequest(
      "Generate the itinerary before confirming — the confirmation email carries the day-by-day plan."
    );
  }

  const alreadySent = Boolean(trip.confirmation_email_sent_at);

  if (!trip.confirmed_at) {
    trip.confirmed_at = new Date();
    if (trip.status === "draft") trip.status = "planned";
    await trip.save();
  }

  // Two clicks landing together both read confirmation_email_sent_at as
  // null, so the claim is the update itself: only the one that still matches
  // null modifies a document, and only that one sends.
  let queued = false;
  if (!alreadySent) {
    const claimedAt = new Date();
    const claim = await Trip.updateOne(
      { _id: trip._id, confirmation_email_sent_at: null },
      { $set: { confirmation_email_sent_at: claimedAt } }
    );
    queued = claim.modifiedCount === 1;
    if (queued) trip.confirmation_email_sent_at = claimedAt;
  }

  if (queued) {
    // Not awaited on purpose — see sendConfirmationEmail. It swallows its own
    // errors, so there is no unhandled rejection to catch here.
    sendConfirmationEmail(trip, req.user);
  }

  res.json({
    trip,
    email: {
      queued,
      already_sent: alreadySent,
      to: queued ? req.user.email : null,
    },
  });
});
