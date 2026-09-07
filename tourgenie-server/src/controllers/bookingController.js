// FR-08 — Mock Ticket Booking.
//
// Demonstration only: no carrier API, no payment gateway. What it does do is
// behave like a real booking in every way that costs nothing — a reference
// number, assigned seats that cannot be double-sold, a frozen copy of the
// schedule, and inventory that goes down when you book and back up when you
// cancel.
import Booking from "../models/Booking.js";
import TransportOption from "../models/TransportOption.js";
import AppSetting from "../models/AppSetting.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findTripForUser, EDIT, VIEW, OWN } from "../services/tripAccess.js";
import { releaseBooking } from "../services/bookingCancellation.js";

const DAY_MS = 86400000;

function utcDay(value) {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// TG-XXXXXX from an unambiguous alphabet — no O/0 or I/1, because these get
// read aloud and typed in by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeReference() {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `TG-${out}`;
}

// Seat labels follow the coach's own layout: a 2-2 bus numbers A1..A4 per
// row, a 1-1 launch cabin numbers A1..A2. The client draws the map from the
// same three fields, so both agree without a shared constant.
export function buildSeatMap(option) {
  const perRow = String(option.seat_layout || "2-2")
    .split("-")
    .map((n) => Number(n) || 0)
    .reduce((a, b) => a + b, 0) || 4;
  const prefix = option.seat_prefix || "A";
  const total = option.total_seats || 40;

  const seats = [];
  for (let i = 0; i < total; i++) {
    seats.push({
      label: `${prefix}${i + 1}`,
      row: Math.floor(i / perRow) + 1,
      column: (i % perRow) + 1,
    });
  }
  return { seats, per_row: perRow, layout: option.seat_layout || "2-2" };
}

// GET /api/transport/:id/availability?date=2026-09-14
//
// Which seats are already taken on that departure. Cancelled bookings free
// their seats again, so only pending/confirmed rows count.
export const getSeatAvailability = asyncHandler(async (req, res) => {
  const option = await TransportOption.findById(req.params.id).lean();
  if (!option) return res.status(404).json({ message: "Transport option not found" });

  const date = req.query.date ? utcDay(req.query.date) : null;
  const filter = { transport_id: option._id, status: { $ne: "cancelled" } };
  if (date) filter.travel_date = { $gte: date, $lt: new Date(date.getTime() + DAY_MS) };

  const bookings = await Booking.find(filter).select("seats").lean();
  const taken = [...new Set(bookings.flatMap((b) => b.seats || []))];

  const { seats, per_row, layout } = buildSeatMap(option);
  res.json({
    option,
    date: date ? date.toISOString().slice(0, 10) : null,
    layout,
    per_row,
    seats: seats.map((s) => ({ ...s, taken: taken.includes(s.label) })),
    taken_count: taken.length,
    available_count: seats.length - taken.length,
  });
});

// POST /api/bookings
export const createBooking = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.body.trip_id, req.user._id, { level: EDIT });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const option = await TransportOption.findById(req.body.transport_id);
  if (!option) return res.status(404).json({ message: "Transport option not found" });

  // Accept either a plain name list (the shape the proposal documents) or
  // full passenger objects from the booking form.
  const details = Array.isArray(req.body.passenger_details) ? req.body.passenger_details : [];
  const names = details.length
    ? details.map((p) => String(p.name || "").trim()).filter(Boolean)
    : (req.body.passengers || []).map((n) => String(n).trim()).filter(Boolean);

  if (names.length === 0) {
    return res.status(400).json({ message: "At least one passenger name is required" });
  }

  const maxPassengers = (await AppSetting.findOne({ key: "booking.max_passengers" }).lean())?.value ?? 10;
  if (names.length > maxPassengers) {
    return res.status(400).json({ message: `A single booking can hold at most ${maxPassengers} passengers` });
  }

  const travelDate = utcDay(req.body.travel_date || trip.start_date);

  // Seats: take what was picked, or assign the first free ones.
  const { seats: allSeats } = buildSeatMap(option);
  const sameDeparture = await Booking.find({
    transport_id: option._id,
    status: { $ne: "cancelled" },
    travel_date: { $gte: travelDate, $lt: new Date(travelDate.getTime() + DAY_MS) },
  })
    .select("seats")
    .lean();
  const taken = new Set(sameDeparture.flatMap((b) => b.seats || []));

  let seats = (req.body.seats || details.map((p) => p.seat).filter(Boolean) || []).filter(Boolean);
  if (seats.length > 0) {
    const clash = seats.filter((s) => taken.has(s));
    if (clash.length) {
      return res.status(409).json({
        message: `Seat${clash.length > 1 ? "s" : ""} ${clash.join(", ")} ${clash.length > 1 ? "have" : "has"} just been taken. Pick another.`,
        taken: [...taken],
      });
    }
    const unknown = seats.filter((s) => !allSeats.some((a) => a.label === s));
    if (unknown.length) {
      return res.status(400).json({ message: `Unknown seat${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}` });
    }
    if (seats.length !== names.length) {
      return res.status(400).json({ message: "Pick exactly one seat per passenger" });
    }
  } else {
    seats = allSeats
      .filter((s) => !taken.has(s.label))
      .slice(0, names.length)
      .map((s) => s.label);
    if (seats.length < names.length) {
      return res.status(409).json({ message: "Not enough seats left on this departure" });
    }
  }

  const serviceCharge = (await AppSetting.findOne({ key: "booking.service_charge_bdt" }).lean())?.value ?? 0;

  // Two things here are uniquely indexed: the reference, which collides
  // about never and is worth retrying, and the (departure, seat) pair, which
  // collides when someone else confirmed the same seat in the moment between
  // the check above and this write. Only the first is a retry — the second is
  // the answer to a question the traveller has to re-answer.
  let booking;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      booking = await Booking.create({
        trip_id: trip._id,
        user_id: req.user._id,
        transport_id: option._id,
        reference: makeReference(),
        passengers: names,
        passenger_details: names.map((name, i) => ({
          name,
          age: details[i]?.age ?? null,
          gender: details[i]?.gender || "",
          id_number: details[i]?.id_number || "",
          seat: seats[i],
        })),
        seats,
        fare_per_passenger: option.fare,
        service_charge: serviceCharge,
        total_fare: option.fare * names.length + serviceCharge,
        status: "confirmed",
        // Frozen so an admin editing the schedule later cannot rewrite a
        // ticket that has already been issued.
        journey: {
          operator: option.operator,
          mode: option.mode,
          from_city: option.from_city,
          to_city: option.to_city,
          depart_time: option.depart_time,
          arrive_time: option.arrive_time,
          service_class: option.service_class,
          boarding_point: option.boarding_point,
        },
        travel_date: travelDate,
      });
      break;
    } catch (err) {
      if (err?.code === 11000) {
        // Which unique index rejected it? A seat clash names the seat fields.
        const clashedOnSeat = Object.keys(err.keyPattern || {}).includes("seats");
        if (clashedOnSeat) {
          return res.status(409).json({
            message: `Seat${seats.length > 1 ? "s" : ""} ${seats.join(", ")} ${
              seats.length > 1 ? "were" : "was"
            } taken a moment ago. Pick another.`,
            taken: [...taken, ...seats],
          });
        }
        if (attempt < 4) continue; // reference collision — try another one
      }
      throw err;
    }
  }

  // Inventory is per-schedule rather than per-date in the seeded model, so
  // this is indicative: the authoritative check is the seat clash above and
  // the unique index behind it.
  //
  // It still has to add up. The old guard skipped the whole decrement when
  // the counter was lower than the party size, while cancelling added the
  // full party back — so booking and then cancelling handed the schedule
  // seats it never had, over and over. Now the write clamps at zero and
  // reports what it actually took, and the cancellation gives back exactly
  // that. Done at driver level because Mongoose rejects a pipeline in
  // updateOne, and because the clamp has to happen inside the write to stay
  // atomic.
  const before = await TransportOption.collection.findOneAndUpdate(
    { _id: option._id },
    [{ $set: { seats_available: { $max: [0, { $subtract: ["$seats_available", names.length] }] } } }],
    { returnDocument: "before" }
  );
  const previous = before?.seats_available ?? before?.value?.seats_available ?? 0;
  booking.inventory_held = Math.max(0, Math.min(names.length, previous));
  await booking.save();

  const populated = await Booking.findById(booking._id).populate("transport_id");
  res.status(201).json({
    booking: populated,
    message: "Demonstration booking confirmed — no payment was taken and no ticket was issued with the operator.",
  });
});

export const getTripBookings = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.params.tripId, req.user._id, { level: VIEW });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const bookings = await Booking.find({ trip_id: trip._id })
    .populate("transport_id")
    .sort({ created_at: -1 });
  res.json({ bookings });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  // Cancelling can reverse money that has already moved, so it sits with the
  // payment flow on the owner's side of the line.
  const trip = await findTripForUser(req.params.tripId, req.user._id, { level: OWN });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const booking = await Booking.findOne({ _id: req.params.bookingId, trip_id: trip._id });
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (booking.status === "cancelled") {
    return res.status(409).json({ message: "That booking is already cancelled" });
  }

  // Shared with the admin's cancel-on-behalf, so the seat accounting can
  // only ever be done one way.
  await releaseBooking(booking);

  res.json({ booking, message: "Booking cancelled and seats released." });
});
