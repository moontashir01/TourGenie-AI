import ItineraryItem from "../models/ItineraryItem.js";
import Trip from "../models/Trip.js";
import Attraction from "../models/Attraction.js";
import Destination from "../models/Destination.js";
import TransportOption from "../models/TransportOption.js";
import { generateItineraryWithAI } from "../services/aiPlanner.js";
import { searchFlights as searchTravelpayouts } from "../services/travelpayoutsFlights.js";
import { benchmarkFor } from "../services/budgetEstimator.js";
import { resolveAirport } from "./flightController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Realistic per-meal prices for the WHOLE party, averaged across the cities
// being visited, from the seeded CostBenchmark rows. Without these anchors
// the AI lowballs food to squeeze inside the budget — ৳300 dinners for a
// party of two at a mid-range tier.
async function buildMealGuidance(trip, costTargets) {
  if (!costTargets.length) return null;
  const tier = trip.budget_tier || "mid";
  const rows = (await Promise.all(costTargets.map((d) => benchmarkFor(d, tier)))).filter(Boolean);
  if (!rows.length) return null;
  const travelers = Math.max(1, trip.travelers || 1);
  const avg = (key) =>
    Math.round(((rows.reduce((sum, r) => sum + (r.meal_costs?.[key] || 0), 0) / rows.length) * travelers) / 10) * 10;
  const meals = { breakfast: avg("breakfast"), lunch: avg("lunch"), dinner: avg("dinner"), snack: avg("street_snack") };
  return meals.dinner > 0 ? meals : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertOwnsTrip(tripId, userId) {
  const trip = await Trip.findOne({ _id: tripId, user_id: userId }).populate(
    "destination_id",
    "name country country_code currency pricing_currency timezone",
  );
  return trip;
}

// Candidate attractions + (for multi-city trips) candidate cities an AI call
// should be grounded in, plus which of those attractions the traveler
// explicitly picked (must appear in the plan, not just be "available").
// Shared by generation and chat-driven adjustment.
export async function loadAttractionContext(trip) {
  const mustVisitIds = (trip.must_visit_attraction_ids || []).map((id) => String(id?._id || id));

  if (trip.multi_city && trip.country_code) {
    const candidateCities = await Destination.find({ country_code: trip.country_code, is_active: true })
      .sort({ popularity: -1 })
      .select("name recommended_days avg_daily_cost tags summary");
    // When the traveler picked cities, only their attractions belong in the
    // prompt — Bangkok's catalogue is dead prompt weight on a Phuket + Chiang
    // Mai trip, and Groq's free tier meters prompt + completion together, so
    // trimming it here buys the completion room a long itinerary needs.
    // Must-visit picks are kept regardless of city.
    const preferredNames = new Set((trip.preferred_cities || []).map((n) => String(n).toLowerCase()));
    const cityPool = preferredNames.size
      ? candidateCities.filter((c) => preferredNames.has(c.name.toLowerCase()))
      : candidateCities;
    const attractionFilter = {
      destination_id: { $in: (cityPool.length ? cityPool : candidateCities).map((c) => c._id) },
    };
    const attractions = await Attraction.find(
      mustVisitIds.length ? { $or: [attractionFilter, { _id: { $in: mustVisitIds } }] } : attractionFilter
    );
    const mealGuidance = await buildMealGuidance(trip, cityPool.length ? cityPool : candidateCities);
    return { attractions, candidateCities, mustVisitIds, mealGuidance };
  }
  const attractions = await Attraction.find({
    ...(trip.destination_id?._id
      ? { destination_id: trip.destination_id._id }
      : { city: new RegExp(`^${trip.destination}$`, "i") }),
  });
  const mealGuidance = await buildMealGuidance(trip, trip.destination_id ? [trip.destination_id] : []);
  return { attractions, candidateCities: [], mustVisitIds, mealGuidance };
}

// Augment travel items with real transport options. Multi-city trips carry
// explicit from_city/to_city per leg (set by the AI); single-destination
// trips only travel on day 1 (arrival) and the last day (return), between
// the trip's origin and its one destination. Mutates items in place.
//
// Flight options come from the Travelpayouts API (real fares for that leg's
// actual calendar date) — the seeded FlightOption collection is deliberately
// ignored. Ground options (bus/train/launch) still come from the catalogue.
// Every estimated_cost covers the WHOLE party, matching est_cost semantics,
// so selecting an option moves the budget by the amount the party pays.
export async function augmentTravelItems(items, trip) {
  const travelers = Math.max(1, trip.travelers || 1);

  // International trips: the arrival and departure legs are covered by the
  // ROUND-TRIP fare picked in the flight panel. Offering per-leg options
  // there showed the same airline at a second (one-way) price and produced a
  // duplicate-looking flight cost on the last day — so those legs get no
  // options of their own.
  const destCountry = trip.multi_city ? trip.country_code : trip.destination_id?.country_code || null;
  let isInternational = false;
  if (destCountry && trip.origin) {
    const exactOrigin = new RegExp(`^${escapeRegex(trip.origin)}$`, "i");
    const originRow = await Destination.findOne({
      is_active: true,
      $or: [{ name: exactOrigin }, { aliases: exactOrigin }],
    })
      .select("country_code")
      .lean();
    isInternational = (originRow?.country_code || "BD") !== destCountry;
  }
  const sameCity = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

  for (const item of items) {
    if (item.category !== "travel") continue;

    let fromCity = item.from_city || (trip.multi_city ? trip.entry_city : trip.origin);
    let toCity = item.to_city || (trip.multi_city ? trip.entry_city : trip.destination);
    if (!item.from_city && !item.to_city && !trip.multi_city && trip.duration_days && item.day === trip.duration_days) {
      fromCity = trip.destination;
      toCity = trip.origin;
    }

    if (isInternational && (sameCity(fromCity, trip.origin) || sameCity(toCity, trip.origin))) {
      item.available_transport_options = [];
      continue;
    }

    const options = [];

    if (process.env.TRAVELPAYOUTS_API_KEY) {
      try {
        const [fromAirport, toAirport] = await Promise.all([resolveAirport(fromCity), resolveAirport(toCity)]);
        if (fromAirport?.iata && toAirport?.iata && fromAirport.iata !== toAirport.iata) {
          // The leg flies on trip start + (day - 1), not on the search date.
          const legDate = new Date(new Date(trip.start_date).getTime() + (item.day - 1) * 86400000)
            .toISOString()
            .slice(0, 10);
          const fares = await searchTravelpayouts({
            origin: fromAirport.iata,
            destination: toAirport.iata,
            date: legDate,
            travelers,
            limit: 5,
          });
          options.push(
            ...fares.map((f) => ({
              ...f,
              option_type: "flight",
              flight_number: f.flightNumber,
              depart_time: f.departure ? String(f.departure).slice(11, 16) : "",
              estimated_cost: f.price, // already the whole-party total in BDT
            }))
          );
        }
      } catch (error) {
        console.warn(`Live flight options failed for ${fromCity} → ${toCity}:`, error.message);
      }
    }

    const transports = await TransportOption.find({
      from_city: new RegExp(`^${escapeRegex(fromCity)}$`, "i"),
      to_city: new RegExp(`^${escapeRegex(toCity)}$`, "i"),
      is_active: true,
    }).lean();
    options.push(
      ...transports.map((t) => ({ ...t, option_type: "transport", estimated_cost: (t.fare || 0) * travelers }))
    );

    item.available_transport_options = options;
  }
}

// Replaces a trip's itinerary wholesale with a freshly generated/adjusted
// items[] (the shape generateItineraryWithAI / adjustItineraryWithAI return).
export async function persistItinerary(trip, items) {
  await ItineraryItem.deleteMany({ trip_id: trip._id });
  const created = await ItineraryItem.insertMany(
    items.map((i) => ({
      trip_id: trip._id,
      day: i.day,
      time: i.time,
      activity: i.activity,
      location: i.location,
      city: i.city || (trip.multi_city ? "" : trip.destination),
      from_city: i.from_city || "",
      to_city: i.to_city || "",
      est_cost: i.est_cost || 0,
      category: i.category || "activity",
      attraction_id: i.attraction_id || null,
      // Carried through so the rainy-day rewriter works on generated
      // itineraries too, not only seeded ones.
      weather_dependent: Boolean(i.weather_dependent),
      available_transport_options: i.available_transport_options || [],
    }))
  );

  trip.status = "planned";
  await trip.save();

  return created;
}

// FR-04 — AI Itinerary Generation (real Claude API call)
// Builds the day-by-day plan from trip params + the curated attractions
// database for the trip's destination, then saves it the same way
// generateItinerary (manual save) does.
export const generateAIItinerary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const { attractions, candidateCities, mustVisitIds, mealGuidance } = await loadAttractionContext(trip);

  let items;
  try {
    items = await generateItineraryWithAI(trip, attractions, candidateCities, mustVisitIds, mealGuidance);
  } catch (err) {
    return res.status(502).json({
      message: `AI itinerary generation failed: ${err.message}`,
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(502).json({ message: "AI returned an empty or invalid itinerary" });
  }

  await augmentTravelItems(items, trip);
  const created = await persistItinerary(trip, items);
  await ItineraryItem.populate(created, { path: "attraction_id", select: "name lat_lng city" });
  const city_coordinates = await buildCityCoordinates(trip, created);

  res.status(201).json({ items: created, city_coordinates });
});

// Manual save — used by the "Add activity" flow where the client sends
// the full items[] array itself (no AI call).
export const generateItinerary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const { items } = req.body; // [{ day, time, activity, location, est_cost, attraction_id }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items[] is required" });
  }

  await ItineraryItem.deleteMany({ trip_id: trip._id });
  const created = await ItineraryItem.insertMany(
    items.map((i) => ({ ...i, trip_id: trip._id }))
  );

  trip.status = "planned";
  await trip.save();

  res.status(201).json({ items: created });
});

// The AI never sets an item's own lat_lng (it isn't in the generation
// prompt's JSON schema), so the map needs two other sources of coordinates:
// the linked Attraction's exact position where one exists, and a city-center
// fallback (via Destination) for everything else — meals, check-in/out,
// generic activities the AI didn't tie to a catalog attraction.
async function buildCityCoordinates(trip, items) {
  const cityNames = new Set([trip.origin, trip.destination]);
  for (const item of items) {
    if (item.city) cityNames.add(item.city);
    if (item.from_city) cityNames.add(item.from_city);
    if (item.to_city) cityNames.add(item.to_city);
  }

  const destinations = await Destination.find({ name: { $in: [...cityNames] } }).select("name lat_lng");
  return Object.fromEntries(destinations.filter((d) => d.lat_lng?.lat != null).map((d) => [d.name, d.lat_lng]));
}

export const getItinerary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const items = await ItineraryItem.find({ trip_id: trip._id })
    .sort({ day: 1, time: 1 })
    .populate("attraction_id", "name lat_lng city");

  const city_coordinates = await buildCityCoordinates(trip, items);
  res.json({ items, city_coordinates });
});

// Only these may be set from a request body. Passing req.body straight to
// findOneAndUpdate let a client rewrite trip_id (moving an item onto someone
// else's trip), forge `source`, or set selected_transport_option without the
// cost recalculation selectTransportOption does.
const EDITABLE_ITEM_FIELDS = [
  "day", "time", "end_time", "duration_min", "activity", "location",
  "city", "from_city", "to_city", "est_cost", "category", "day_theme",
  "notes", "weather_dependent", "is_locked", "is_completed",
];

function pickEditableFields(body = {}) {
  const update = {};
  for (const field of EDITABLE_ITEM_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  return update;
}

export const updateItineraryItem = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const update = pickEditableFields(req.body);
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: "No editable fields supplied" });
  }

  const item = await ItineraryItem.findOneAndUpdate(
    { _id: req.params.itemId, trip_id: trip._id },
    update,
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Itinerary item not found" });
  res.json({ item });
});

// Drag-and-drop reordering. The client sends the whole affected set in its
// new arrangement and gets the re-sorted itinerary back, so a reorder is one
// atomic round trip rather than one PATCH per moved row — which raced with
// itself and left the list half-updated when a drag touched several days.
//
// Times must arrive zero-padded: getItinerary sorts on `time` as a string,
// so "9:00" would sort after "14:00" and silently corrupt the day's order.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const reorderItineraryItems = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items must be a non-empty array" });
  }
  if (items.length > 300) {
    return res.status(400).json({ message: "Too many items in one reorder" });
  }

  const ops = [];
  for (const entry of items) {
    if (!entry?._id) {
      return res.status(400).json({ message: "Every item needs an _id" });
    }
    const day = Number(entry.day);
    if (!Number.isInteger(day) || day < 1) {
      return res.status(400).json({ message: `Invalid day for item ${entry._id}` });
    }
    if (typeof entry.time !== "string" || !HHMM.test(entry.time)) {
      return res.status(400).json({ message: `Invalid time for item ${entry._id} — expected zero-padded HH:MM` });
    }
    ops.push({
      updateOne: {
        // trip_id in the filter is what stops an id from another traveler's
        // trip being dragged into this one.
        filter: { _id: entry._id, trip_id: trip._id },
        update: { $set: { day, time: entry.time } },
      },
    });
  }

  const result = await ItineraryItem.bulkWrite(ops);
  if (result.matchedCount === 0) {
    return res.status(404).json({ message: "None of those items belong to this trip" });
  }

  const updated = await ItineraryItem.find({ trip_id: trip._id })
    .sort({ day: 1, time: 1 })
    .populate("attraction_id", "name lat_lng city");

  res.json({ items: updated, matched: result.matchedCount, modified: result.modifiedCount });
});

export const deleteItineraryItem = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const item = await ItineraryItem.findOneAndDelete({ _id: req.params.itemId, trip_id: trip._id });
  if (!item) return res.status(404).json({ message: "Itinerary item not found" });
  res.json({ message: "Item removed" });
});

export const selectTransportOption = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const { selected_option } = req.body;
  if (!selected_option || !selected_option.estimated_cost) {
    return res.status(400).json({ message: "Invalid selected option" });
  }

  const item = await ItineraryItem.findOneAndUpdate(
    { _id: req.params.itemId, trip_id: trip._id },
    {
      selected_transport_option: selected_option,
      est_cost: selected_option.estimated_cost
    },
    { new: true, runValidators: true }
  );

  if (!item) return res.status(404).json({ message: "Itinerary item not found" });
  
  res.json({ item });
});
