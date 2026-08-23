// FR-15 — Smart Packing Assistant, the API side.
//
// Generation runs the same rule engine the seeder uses (packingService):
// load the active templates, keep the ones whose conditions match the trip's
// weather + destinations + interests + duration, merge their items. The
// result is persisted so ticked checkboxes survive reloads, and regeneration
// carries the ticks over for items that are still on the list.
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Destination from "../models/Destination.js";
import WeatherForecast from "../models/WeatherForecast.js";
import PackingTemplate from "../models/PackingTemplate.js";
import PackingList from "../models/PackingList.js";
import { buildPackingList } from "../services/packingService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertOwnsTrip(tripId, userId) {
  return Trip.findOne({ _id: tripId, user_id: userId }).populate(
    "destination_id",
    "name type country_code"
  );
}

export const getPackingList = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  const list = await PackingList.findOne({ trip_id: trip._id });
  res.json({ packing_list: list || null });
});

export const generatePackingList = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  // The cities actually being visited (from the itinerary), falling back to
  // the destination / gateway city before a plan exists.
  const items = await ItineraryItem.find({ trip_id: trip._id }).select("city").lean();
  const cityNames = [...new Set(items.map((i) => i.city).filter(Boolean))];
  if (!cityNames.length) cityNames.push(trip.multi_city ? trip.entry_city : trip.destination);

  const destinations = await Destination.find({
    $or: cityNames.map((name) => ({ name: new RegExp(`^${escapeRegex(name)}$`, "i") })),
  })
    .select("name type country_code")
    .lean();
  const destinationIds = destinations.map((d) => d._id);
  if (!destinationIds.length && trip.destination_id?._id) destinationIds.push(trip.destination_id._id);

  const forecasts = await WeatherForecast.find({
    destination_id: { $in: destinationIds },
    date: { $gte: trip.start_date, $lte: trip.end_date },
  }).lean();

  const hints = new Set();
  const conditions = new Set();
  let tempMin = Infinity;
  let tempMax = -Infinity;
  for (const f of forecasts) {
    (f.packing_hints || []).forEach((h) => hints.add(h));
    conditions.add(f.condition);
    tempMin = Math.min(tempMin, f.temp_min_c);
    tempMax = Math.max(tempMax, f.temp_max_c);
  }
  if (!forecasts.length) {
    tempMin = 20;
    tempMax = 30;
  }

  // International when the origin's country differs from the destination's.
  const destCountry = trip.multi_city ? trip.country_code : trip.destination_id?.country_code || null;
  let isInternational = false;
  if (destCountry && trip.origin) {
    const originRow = await Destination.findOne({
      is_active: true,
      $or: [
        { name: new RegExp(`^${escapeRegex(trip.origin)}$`, "i") },
        { aliases: new RegExp(`^${escapeRegex(trip.origin)}$`, "i") },
      ],
    })
      .select("country_code")
      .lean();
    isInternational = (originRow?.country_code || "BD") !== destCountry;
  }

  const ctx = {
    days: trip.duration_days || 1,
    travelers: trip.travelers || 1,
    tempMin,
    tempMax,
    hints,
    conditions,
    destinationTypes: [...new Set(destinations.map((d) => d.type).filter(Boolean))],
    interests: trip.interests || [],
    isInternational,
  };

  const templates = await PackingTemplate.find({ is_active: true }).lean();
  const { categories, templates_applied } = buildPackingList(templates, ctx);

  // Regeneration keeps the ticks for items that are still on the list.
  const previous = await PackingList.findOne({ trip_id: trip._id }).lean();
  if (previous) {
    const ticked = new Set();
    for (const group of previous.categories || []) {
      for (const item of group.items || []) {
        if (item.checked) ticked.add(`${group.category}|${item.name.toLowerCase()}`);
      }
    }
    for (const group of categories) {
      for (const item of group.items) {
        if (ticked.has(`${group.category}|${item.name.toLowerCase()}`)) item.checked = true;
      }
    }
  }

  const list = await PackingList.findOneAndUpdate(
    { trip_id: trip._id },
    {
      trip_id: trip._id,
      user_id: req.user._id,
      categories,
      based_on: {
        days: ctx.days,
        travelers: ctx.travelers,
        temp_min_c: Number.isFinite(tempMin) ? tempMin : null,
        temp_max_c: Number.isFinite(tempMax) ? tempMax : null,
        weather_summary: forecasts.length
          ? `${forecasts.length}-day forecast across ${cityNames.join(", ")}: ${tempMin}–${tempMax} °C, ${[...conditions].join(", ")}`
          : `No forecast available for these dates — packed for typical conditions`,
        packing_hints: [...hints],
        interests: ctx.interests,
        templates_applied,
      },
      generated_at: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ packing_list: list });
});

// Tick or untick one item — the whole point of persisting the list.
export const togglePackingItem = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const { category, name, checked } = req.body;
  if (!category || !name) return res.status(400).json({ message: "category and name are required" });

  const list = await PackingList.findOne({ trip_id: trip._id });
  if (!list) return res.status(404).json({ message: "No packing list yet — generate one first" });

  const group = list.categories.find((g) => g.category === category);
  const item = group?.items.find((i) => i.name === name);
  if (!item) return res.status(404).json({ message: "Item not found in the list" });

  item.checked = checked !== false;
  await list.save();
  res.json({ packing_list: list });
});
