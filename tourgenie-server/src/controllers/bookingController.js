import Booking from "../models/Booking.js";
import Trip from "../models/Trip.js";
import TransportOption from "../models/TransportOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-08 — Mock Ticket Booking (demo only, no real payment/carrier API)
export const createBooking = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.body.trip_id, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const transport = await TransportOption.findById(req.body.transport_id);
  if (!transport) return res.status(404).json({ message: "Transport option not found" });

  const passengers = req.body.passengers || [];
  const booking = await Booking.create({
    trip_id: trip._id,
    transport_id: transport._id,
    passengers,
    seats: req.body.seats || passengers.map((_, i) => `S${i + 1}`),
    total_fare: transport.fare * passengers.length,
    status: "confirmed",
  });

  res.status(201).json({ booking, message: "Demo booking confirmed — no real payment was processed" });
});

export const getTripBookings = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const bookings = await Booking.find({ trip_id: trip._id }).populate("transport_id");
  res.json({ bookings });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.bookingId, trip_id: trip._id },
    { status: "cancelled" },
    { new: true }
  );
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  res.json({ booking });
});
