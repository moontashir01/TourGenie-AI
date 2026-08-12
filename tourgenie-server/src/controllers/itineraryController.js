import ItineraryItem from "../models/ItineraryItem.js";
import Trip from "../models/Trip.js";
import Attraction from "../models/Attraction.js";
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

// FR-04 — AI Itinerary Generation (real Claude API call)
// Builds the day-by-day plan from trip params + the curated attractions
// database for the trip's destination, then saves it the same way
// generateItinerary (manual save) does.
export const generateAIItinerary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const attractions = await Attraction.find({
    ...(trip.destination_id?._id
      ? { destination_id: trip.destination_id._id }
      : { city: new RegExp(`^${trip.destination}$`, "i") }),
  });

  let items;
  try {
    items = await generateItineraryWithAI(trip, attractions);
  } catch (err) {
    return res.status(502).json({
      message: `AI itinerary generation failed: ${err.message}`,
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(502).json({ message: "AI returned an empty or invalid itinerary" });
  }

  // Augment travel items with real transport options
  for (const item of items) {
    if (item.category === "travel") {
      let fromCity = trip.origin;
      let toCity = trip.destination;
      // If it's the last day, assume it's the return trip
      if (trip.duration_days && item.day === trip.duration_days) {
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

  await ItineraryItem.deleteMany({ trip_id: trip._id });
  const created = await ItineraryItem.insertMany(
    items.map((i) => ({
      trip_id: trip._id,
      day: i.day,
      time: i.time,
      activity: i.activity,
      location: i.location,
      est_cost: i.est_cost || 0,
      category: i.category || "activity",
      attraction_id: i.attraction_id || null,
      available_transport_options: i.available_transport_options || [],
    }))
  );

  trip.status = "planned";
  await trip.save();

  res.status(201).json({ items: created });
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

export const getItinerary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const items = await ItineraryItem.find({ trip_id: trip._id }).sort({ day: 1, time: 1 });
  res.json({ items });
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
