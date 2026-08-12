// FR-09 — Budget Management. Per-destination, per-tier cost reference used to
// turn "4 days in Cox's Bazar for 2 people, mid-range" into a categorised
// budget estimate without asking an external pricing API.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

export const BUDGET_TIERS = ["budget", "mid", "luxury"];

const costBenchmarkSchema = new mongoose.Schema(
  {
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", required: true },
    city: { type: String, required: true },
    tier: { type: String, enum: BUDGET_TIERS, required: true },
    currency: { type: String, default: "BDT" },

    // Everything below is BDT, per traveller, per day.
    per_person_per_day: {
      accommodation: { type: Number, required: true },
      food: { type: Number, required: true },
      local_transport: { type: Number, required: true },
      attractions: { type: Number, required: true },
      shopping: { type: Number, default: 0 },
      misc: { type: Number, default: 0 },
    },

    meal_costs: {
      breakfast: { type: Number, default: 0 },
      lunch: { type: Number, default: 0 },
      dinner: { type: Number, default: 0 },
      street_snack: { type: Number, default: 0 },
    },

    local_transport_rates: {
      cng_per_km: { type: Number, default: 0 },
      rickshaw_short_trip: { type: Number, default: 0 },
      local_bus: { type: Number, default: 0 },
      ride_share_per_km: { type: Number, default: 0 },
      reserved_car_per_day: { type: Number, default: 0 },
    },

    hotel_price_range: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },

    notes: { type: String, default: "" },
    effective_from: { type: Date, default: Date.now },
  },
  TIMESTAMPS
);

costBenchmarkSchema.index({ destination_id: 1, tier: 1 }, { unique: true });
costBenchmarkSchema.index({ city: 1, tier: 1 });

export default mongoose.model("CostBenchmark", costBenchmarkSchema);
