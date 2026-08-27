// FR-08, extended to accommodation — a demonstration hotel reservation.
//
// Kept separate from `Booking` rather than folded into it: the proposal
// documents Booking (§4.1.4) as a transport record with a required
// transport_id, and a stay has a genuinely different shape — nights and
// rooms rather than seats and passengers. Same guarantees though: a
// reference you can read out, inventory that moves, and a frozen copy of
// the hotel so a later edit can't rewrite an issued confirmation.
//
// Demonstration only. No payment is taken and nothing is reserved with the
// property.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    age: { type: Number, default: null },
    is_lead: { type: Boolean, default: false },
  },
  { _id: false }
);

const hotelBookingSchema = new mongoose.Schema(
  {
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },

    reference: { type: String, sparse: true, unique: true }, // TG-H-4KQ8ZP

    // Which room, and how many of it.
    room_type: { type: String, required: true },
    rooms: { type: Number, required: true, min: 1, default: 1 },
    room_capacity: { type: Number, default: 2 },

    check_in: { type: Date, required: true },
    check_out: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },

    guests: { type: [guestSchema], default: [] },
    guest_count: { type: Number, default: 1 },

    rate_per_night: { type: Number, required: true }, // BDT
    total_amount: { type: Number, required: true }, // BDT, rate × nights × rooms
    currency: { type: String, default: "BDT" },
    // What the same total looks like where the traveller is going, for
    // international stays. Stored rather than computed on read so the
    // confirmation still reads correctly if a rate is edited later.
    local_currency: { type: String, default: "" },
    local_total: { type: Number, default: null },

    special_requests: { type: String, default: "" },

    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "confirmed" },
    is_mock: { type: Boolean, default: true }, // always true — demonstration only
    payment_status: { type: String, enum: ["not_required", "simulated"], default: "not_required" },
    cancelled_at: { type: Date, default: null },

    // Frozen at booking time so an admin editing the hotel later cannot
    // rewrite a confirmation that has already been issued.
    property: {
      name: { type: String, default: "" },
      city: { type: String, default: "" },
      area: { type: String, default: "" },
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
      star_rating: { type: Number, default: null },
      checkin_time: { type: String, default: "14:00" },
      checkout_time: { type: String, default: "12:00" },
      cancellation_policy: { type: String, default: "" },
      breakfast_included: { type: Boolean, default: false },
    },
  },
  TIMESTAMPS
);

hotelBookingSchema.index({ trip_id: 1, created_at: -1 });
hotelBookingSchema.index({ user_id: 1, status: 1 });
hotelBookingSchema.index({ hotel_id: 1, check_in: 1 });

export default mongoose.model("HotelBooking", hotelBookingSchema);
