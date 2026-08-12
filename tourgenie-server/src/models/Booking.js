// FR-08 — Mock Ticket Booking. Demo-only by design: no carrier API, no
// payment gateway. Proposal fields (§4.1.4) unchanged; the additions are the
// reference number and journey snapshot a confirmation screen needs.
import mongoose from "mongoose";

const passengerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    age: { type: Number, default: null },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    seat: { type: String, default: "" },
    id_number: { type: String, default: "" },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    // — proposal §4.1.4 —
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    transport_id: { type: mongoose.Schema.Types.ObjectId, ref: "TransportOption", required: true },
    passengers: { type: [String], required: true }, // names, as documented
    seats: { type: [String], default: [] },
    total_fare: { type: Number, required: true },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },

    // — additive —
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reference: { type: String, sparse: true, unique: true }, // TG-8F3K2A
    passenger_details: { type: [passengerSchema], default: [] },

    // Frozen copy of the schedule at booking time, so the ticket still reads
    // correctly if an admin later edits the TransportOption.
    journey: {
      operator: { type: String, default: "" },
      mode: { type: String, default: "" },
      from_city: { type: String, default: "" },
      to_city: { type: String, default: "" },
      depart_time: { type: String, default: "" },
      arrive_time: { type: String, default: "" },
      service_class: { type: String, default: "" },
      boarding_point: { type: String, default: "" },
    },
    travel_date: { type: Date, default: null },

    fare_per_passenger: { type: Number, default: 0 },
    service_charge: { type: Number, default: 0 },
    currency: { type: String, default: "BDT" },

    is_mock: { type: Boolean, default: true }, // always true — FR-08
    payment_status: { type: String, enum: ["not_required", "simulated"], default: "not_required" },
    cancelled_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

bookingSchema.index({ trip_id: 1, created_at: -1 });
bookingSchema.index({ user_id: 1, status: 1 });
bookingSchema.index({ travel_date: 1 });

export default mongoose.model("Booking", bookingSchema);
