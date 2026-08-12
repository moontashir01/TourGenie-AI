import Trip from "../models/Trip.js";
import Destination from "../models/Destination.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DESTINATION_FIELDS = "name country country_code timezone currency pricing_currency nearest_airport type";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveDestination({ id, name, required = false }) {
  let destination = null;
  if (id) destination = await Destination.findOne({ _id: id, is_active: true });
  if (!destination && name?.trim()) {
    const exact = new RegExp(`^${escapeRegex(name.trim())}$`, "i");
    destination = await Destination.findOne({ is_active: true, $or: [{ name: exact }, { aliases: exact }] });
  }
  if (!destination && required) {
    const error = new Error(`Unsupported destination: ${name || id || "not provided"}`);
    error.status = 400;
    throw error;
  }
  return destination;
}

function allowedTripFields(body) {
  return {
    start_date: body.start_date,
    end_date: body.end_date,
    travelers: body.travelers,
    budget: body.budget,
    interests: body.interests,
    transport_preference: body.transport_preference,
    hotel_preference: body.hotel_preference,
    food_preference: body.food_preference,
    budget_tier: body.budget_tier,
    notes: body.notes,
  };
}

// FR-03 — Trip Creation
export const createTrip = asyncHandler(async (req, res) => {
  const [destination, origin] = await Promise.all([
    resolveDestination({ id: req.body.destination_id, name: req.body.destination, required: true }),
    resolveDestination({ id: req.body.origin_destination_id, name: req.body.origin }),
  ]);
  const trip = await Trip.create({
    ...allowedTripFields(req.body),
    user_id: req.user._id,
    origin: origin?.name || req.body.origin || req.user.city || "",
    destination: destination.name,
    origin_destination_id: origin?._id || null,
    destination_id: destination._id,
    currency: destination.pricing_currency || "BDT",
    status: "draft",
  });
  res.status(201).json({ trip });
});

// List the logged-in traveler's trips (Dashboard / My Trips)
export const getMyTrips = asyncHandler(async (req, res) => {
  const trips = await Trip.find({ user_id: req.user._id })
    .populate("origin_destination_id", DESTINATION_FIELDS)
    .populate("destination_id", DESTINATION_FIELDS)
    .sort({ created_at: -1 });
  res.json({ trips });
});

export const getTripById = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, user_id: req.user._id })
    .populate("hotel_id")
    .populate("origin_destination_id", DESTINATION_FIELDS)
    .populate("destination_id", DESTINATION_FIELDS);
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  res.json({ trip });
});

export const updateTrip = asyncHandler(async (req, res) => {
  const updates = Object.fromEntries(
    Object.entries(allowedTripFields(req.body)).filter(([, value]) => value !== undefined),
  );
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
  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id },
    updates,
    { new: true, runValidators: true }
  );
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  res.json({ trip });
});

export const deleteTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  res.json({ message: "Trip deleted" });
});
