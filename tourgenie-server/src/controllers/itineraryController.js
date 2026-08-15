import ItineraryItem from "../models/ItineraryItem.js";
import Trip from "../models/Trip.js";
import Attraction from "../models/Attraction.js";
import Destination from "../models/Destination.js";
import FlightOption from "../models/FlightOption.js";
import TransportOption from "../models/TransportOption.js";
import { generateItineraryWithAI } from "../services/aiPlanner.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    const attractions = await Attraction.find({
      destination_id: { $in: candidateCities.map((c) => c._id) },
    });
    return { attractions, candidateCities, mustVisitIds };
  }
  const attractions = await Attraction.find({
    ...(trip.destination_id?._id
      ? { destination_id: trip.destination_id._id }
      : { city: new RegExp(`^${trip.destination}$`, "i") }),
  });
  return { attractions, candidateCities: [], mustVisitIds };
}

// Augment travel items with real transport options. Multi-city trips carry
// explicit from_city/to_city per leg (set by the AI); single-destination
// trips only travel on day 1 (arrival) and the last day (return), between
// the trip's origin and its one destination. Mutates items in place.
export async function augmentTravelItems(items, trip) {
  for (const item of items) {
    if (item.category === "travel") {
      let fromCity = item.from_city || (trip.multi_city ? trip.entry_city : trip.origin);
      let toCity = item.to_city || (trip.multi_city ? trip.entry_city : trip.destination);
      if (!item.from_city && !item.to_city && !trip.multi_city && trip.duration_days && item.day === trip.duration_days) {
        fromCity = trip.destination;
        toCity = trip.origin;
      }

      const flights = await FlightOption.find({
        from_city: new RegExp(`^${fromCity}$`, "i"),
        to_city: new RegExp(`^${toCity}$`, "i"),
        is_active: true,
      }).lean();

      const transports = await TransportOption.find({
        from_city: new RegExp(`^${fromCity}$`, "i"),
        to_city: new RegExp(`^${toCity}$`, "i"),
        is_active: true,
      }).lean();

      // Ensure a unified format so the frontend can display them interchangeably
      item.available_transport_options = [
        ...flights.map(f => ({ ...f, option_type: "flight", estimated_cost: f.total_fare_bdt })),
        ...transports.map(t => ({ ...t, option_type: "transport", estimated_cost: t.fare }))
      ];
    }
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

  const { attractions, candidateCities, mustVisitIds } = await loadAttractionContext(trip);

  let items;
  try {
    items = await generateItineraryWithAI(trip, attractions, candidateCities, mustVisitIds);
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

export const updateItineraryItem = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const item = await ItineraryItem.findOneAndUpdate(
    { _id: req.params.itemId, trip_id: trip._id },
    req.body,
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: "Itinerary item not found" });
  res.json({ item });
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
