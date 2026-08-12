// Flight schedules held locally, so the flight search on the Plan Trip page
// answers from MongoDB instead of a live fare API.
//
// A row is a recurring *schedule* (which weekdays it operates), not a single
// dated departure — the search expands it into concrete dates for the range
// the traveller asked about. That keeps the collection small and means a new
// travel date never needs new rows.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const flightOptionSchema = new mongoose.Schema(
  {
    airline: { type: String, required: true }, // "Biman Bangladesh Airlines"
    airline_code: { type: String, required: true, uppercase: true }, // BG
    flight_number: { type: String, required: true }, // BG-435
    aircraft: { type: String, default: "" },

    from_city: { type: String, required: true },
    from_iata: { type: String, required: true, uppercase: true },
    to_city: { type: String, required: true },
    to_iata: { type: String, required: true, uppercase: true },

    depart_time: { type: String, required: true }, // "07:30" local
    arrive_time: { type: String, required: true },
    duration_min: { type: Number, required: true },
    arrives_next_day: { type: Boolean, default: false },

    stops: { type: Number, default: 0 },
    via: { type: [String], default: [] }, // intermediate IATA codes

    cabin: { type: String, enum: ["economy", "premium", "business", "first"], default: "economy" },
    base_fare_bdt: { type: Number, required: true },
    taxes_bdt: { type: Number, default: 0 },
    total_fare_bdt: { type: Number, required: true },
    refundable: { type: Boolean, default: false },
    baggage_kg: { type: Number, default: 20 },
    cabin_baggage_kg: { type: Number, default: 7 },

    // 0 = Sunday … 6 = Saturday. Empty means it operates daily.
    days_of_week: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    seats_available: { type: Number, default: 40 },

    is_domestic: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
    source: { type: String, default: "seeded" },
  },
  TIMESTAMPS
);

flightOptionSchema.index({ from_iata: 1, to_iata: 1, is_active: 1 });
flightOptionSchema.index({ from_city: 1, to_city: 1 });
flightOptionSchema.index({ total_fare_bdt: 1 });

export default mongoose.model("FlightOption", flightOptionSchema);
