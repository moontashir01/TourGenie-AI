// FR-16 — Carbon Footprint Calculator.
//
// emission = distance_km × grams_co2_per_passenger_km ÷ 1000  (kg CO₂e)
//
// Factors are per *passenger*-km, so shared modes already account for
// typical occupancy — that's what `occupancy_assumption` records.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const carbonFactorSchema = new mongoose.Schema(
  {
    mode: { type: String, required: true, unique: true }, // bus, train, launch, flight_short…
    label: { type: String, required: true }, // "Intercity bus (AC)"
    category: {
      type: String,
      enum: ["road", "rail", "water", "air", "active"],
      required: true,
    },

    grams_co2_per_passenger_km: { type: Number, required: true, min: 0 },
    occupancy_assumption: { type: Number, default: 1 }, // passengers per vehicle
    is_shared: { type: Boolean, default: true },

    // Shown alongside the estimate as "you could have…" suggestions.
    greener_alternatives: { type: [String], default: [] },
    rating: { type: String, enum: ["low", "moderate", "high", "very-high"], default: "moderate" },

    source: { type: String, default: "DEFRA/IPCC average" },
    notes: { type: String, default: "" },
    sort_order: { type: Number, default: 0 },
  },
  TIMESTAMPS
);

carbonFactorSchema.index({ category: 1, sort_order: 1 });

export default mongoose.model("CarbonFactor", carbonFactorSchema);
