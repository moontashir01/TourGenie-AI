// FR-08 for accommodation — demonstration hotel reservations.
//
// Same contract as the transport booking: a readable reference, rooms that
// can't be double-sold across overlapping dates, a frozen copy of the
// property, and inventory that goes down on booking and back up on
// cancellation. No payment, nothing reserved with the hotel.
import HotelBooking from "../models/HotelBooking.js";
import Hotel from "../models/Hotel.js";
import Trip from "../models/Trip.js";
import Destination from "../models/Destination.js";
import { fromBdt } from "../utils/currency.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DAY_MS = 86400000;

function utcDay(value) {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function nightsBetween(checkIn, checkOut) {
  return Math.max(1, Math.round((utcDay(checkOut) - utcDay(checkIn)) / DAY_MS));
}

// No O/0 or I/1 — confirmations get read aloud and typed by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeReference() {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `TG-H-${out}`;
}

/** Two stays clash when each starts before the other ends. */
function overlapFilter(checkIn, checkOut) {
  return { check_in: { $lt: utcDay(checkOut) }, check_out: { $gt: utcDay(checkIn) } };
}

async function roomsTaken(hotelId, roomType, checkIn, checkOut) {
  const clashes = await HotelBooking.find({
    hotel_id: hotelId,
    room_type: roomType,
    status: { $ne: "cancelled" },
    ...overlapFilter(checkIn, checkOut),
  })
    .select("rooms")
    .lean();
  return clashes.reduce((sum, b) => sum + (b.rooms || 1), 0);
}

// GET /api/hotels/:id/availability?check_in=…&check_out=…
//
// What's bookable for those dates, per room type. Public, like the hotel
// catalogue itself.
export const getHotelAvailability = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id).lean();
  if (!hotel) return res.status(404).json({ message: "Hotel not found" });

  const checkIn = req.query.check_in ? utcDay(req.query.check_in) : utcDay(Date.now() + DAY_MS);
  const checkOut = req.query.check_out ? utcDay(req.query.check_out) : new Date(checkIn.getTime() + DAY_MS);
  if (checkOut <= checkIn) {
    return res.status(400).json({ message: "check_out must be after check_in" });
  }
  const nights = nightsBetween(checkIn, checkOut);

  // A hotel with no room card still needs something bookable, so its
  // headline nightly rate stands in as a single standard room type.
  const roomTypes = hotel.room_types?.length
    ? hotel.room_types
    : [{ name: "Standard Room", capacity: 2, price_per_night: hotel.price_per_night, rooms_available: 5, beds: "", has_ac: true, breakfast_included: false }];

  const rooms = await Promise.all(
    roomTypes.map(async (room) => {
      const taken = await roomsTaken(hotel._id, room.name, checkIn, checkOut);
      const available = Math.max(0, (room.rooms_available ?? 5) - taken);
      return {
        ...room,
        rooms_available: available,
        taken,
        stay_total: room.price_per_night * nights,
      };
    })
  );

  res.json({
    hotel: {
      _id: hotel._id,
      name: hotel.name,
      city: hotel.city,
      area: hotel.area,
      star_rating: hotel.star_rating,
      checkin_time: hotel.checkin_time,
      checkout_time: hotel.checkout_time,
      cancellation_policy: hotel.cancellation_policy,
    },
    check_in: checkIn.toISOString().slice(0, 10),
    check_out: checkOut.toISOString().slice(0, 10),
    nights,
    rooms,
  });
});

// POST /api/hotel-bookings
export const createHotelBooking = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.body.trip_id, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const hotel = await Hotel.findById(req.body.hotel_id);
  if (!hotel) return res.status(404).json({ message: "Hotel not found" });

  const checkIn = utcDay(req.body.check_in || trip.start_date);
  const checkOut = utcDay(req.body.check_out || trip.end_date);
  if (checkOut <= checkIn) {
    return res.status(400).json({ message: "Check-out has to be after check-in" });
  }
  const nights = nightsBetween(checkIn, checkOut);

  const roomTypes = hotel.room_types?.length
    ? hotel.room_types
    : [{ name: "Standard Room", capacity: 2, price_per_night: hotel.price_per_night, rooms_available: 5, breakfast_included: false }];

  const requestedName = req.body.room_type || roomTypes[0].name;
  const room = roomTypes.find((r) => r.name === requestedName);
  if (!room) {
    return res.status(400).json({
      message: `"${requestedName}" isn't a room type at this hotel. Available: ${roomTypes.map((r) => r.name).join(", ")}`,
    });
  }

  const rooms = Math.max(1, Number(req.body.rooms) || 1);
  // Silently clamping this hid the availability check: asking for 11 rooms
  // became a request for 10, which then passed. Say no instead.
  if (rooms > 10) {
    return res.status(400).json({ message: "A single reservation can hold at most 10 rooms." });
  }
  const guests = (req.body.guests || [])
    .map((g) => (typeof g === "string" ? { name: g } : g))
    .filter((g) => g?.name?.trim())
    .map((g, i) => ({ name: String(g.name).trim(), age: g.age ?? null, is_lead: i === 0 }));

  if (guests.length === 0) {
    return res.status(400).json({ message: "At least one guest name is required" });
  }
  const capacity = (room.capacity || 2) * rooms;
  if (guests.length > capacity) {
    return res.status(400).json({
      message: `${guests.length} guests won't fit in ${rooms} × ${room.name} (sleeps ${capacity}). Book another room.`,
    });
  }

  const taken = await roomsTaken(hotel._id, room.name, checkIn, checkOut);
  const free = Math.max(0, (room.rooms_available ?? 5) - taken);
  if (rooms > free) {
    return res.status(409).json({
      message: free === 0
        ? `No ${room.name} left for those dates.`
        : `Only ${free} × ${room.name} left for those dates.`,
      available: free,
    });
  }

  const total = room.price_per_night * nights * rooms;

  // International stays also carry the local-currency figure, so the
  // confirmation means something at the front desk.
  const destination = hotel.destination_id
    ? await Destination.findById(hotel.destination_id).select("currency").lean()
    : null;
  const localCode = destination?.currency && destination.currency !== "BDT" ? destination.currency : "";
  let localTotal = null;
  if (localCode) {
    const converted = await fromBdt(total, localCode);
    if (converted.converted) localTotal = Math.round(converted.amount);
  }

  let booking;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      booking = await HotelBooking.create({
        trip_id: trip._id,
        user_id: req.user._id,
        hotel_id: hotel._id,
        reference: makeReference(),
        room_type: room.name,
        rooms,
        room_capacity: room.capacity || 2,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        guests,
        guest_count: guests.length,
        rate_per_night: room.price_per_night,
        total_amount: total,
        currency: "BDT",
        local_currency: localCode,
        local_total: localTotal,
        special_requests: String(req.body.special_requests || "").slice(0, 400),
        status: "confirmed",
        property: {
          name: hotel.name,
          city: hotel.city,
          area: hotel.area,
          address: hotel.address,
          phone: hotel.phone,
          star_rating: hotel.star_rating,
          checkin_time: hotel.checkin_time,
          checkout_time: hotel.checkout_time,
          cancellation_policy: hotel.cancellation_policy,
          breakfast_included: Boolean(room.breakfast_included),
        },
      });
      break;
    } catch (err) {
      if (err?.code === 11000 && attempt < 4) continue;
      throw err;
    }
  }

  // Booking a room is also choosing where you're staying.
  if (!trip.multi_city && !trip.hotel_id) {
    trip.hotel_id = hotel._id;
    await trip.save();
  }

  const populated = await HotelBooking.findById(booking._id).populate("hotel_id", "name city image_url rating");
  res.status(201).json({
    booking: populated,
    message: "Demonstration reservation confirmed — no payment was taken and nothing was reserved with the property.",
  });
});

export const getTripHotelBookings = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const bookings = await HotelBooking.find({ trip_id: trip._id })
    .populate("hotel_id", "name city image_url rating")
    .sort({ check_in: 1 })
    .lean();
  res.json({ bookings });
});

export const cancelHotelBooking = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const booking = await HotelBooking.findOne({ _id: req.params.bookingId, trip_id: trip._id });
  if (!booking) return res.status(404).json({ message: "Reservation not found" });
  if (booking.status === "cancelled") {
    return res.status(409).json({ message: "That reservation is already cancelled" });
  }

  booking.status = "cancelled";
  booking.cancelled_at = new Date();
  await booking.save();

  // Inventory is derived from live bookings, so cancelling frees the room
  // without a counter to decrement.
  res.json({ booking, message: "Reservation cancelled and the room released." });
});

