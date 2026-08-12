// FR-03 — Trip Creation, and the hub every other feature hangs off.
//
// Proposal fields (§4.1.2) unchanged. Added: resolved destination ids, the
// stored budget breakdown (FR-09), the carbon estimate (FR-16), and the
// selected route/transport so the trip carries the answers rather than
// recomputing them on every page load.
import mongoose from "mongoose";

const budgetLineSchema = new mongoose.Schema(
  {
    category: { type: String, required: true }, // matches ExpenseCategory.code
    label: { type: String, default: "" },
    amount: { type: Number, required: true },
    color: { type: String, default: "" },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    // — proposal §4.1.2 —
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", default: null },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    travelers: { type: Number, required: true, min: 1 },
    budget: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["draft", "planned", "active", "completed"], default: "draft" },

    // — already in use by the app —
    interests: { type: [String], default: [] },
    transport_preference: { type: String, default: "No preference" },
    hotel_preference: { type: String, default: "Balanced" },
    food_preference: { type: String, default: "No preference" },

    // — additive —
    title: { type: String, default: "" }, // "4 days in Cox's Bazar"
    origin_destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },

    duration_days: { type: Number, default: null }, // derived, kept for quick reads
    budget_tier: { type: String, enum: ["budget", "mid", "luxury"], default: "mid" },
    currency: { type: String, default: "BDT" },

    // FR-09 — the estimated split, computed from CostBenchmark at plan time.
    budget_breakdown: { type: [budgetLineSchema], default: [] },
    estimated_total: { type: Number, default: 0 },

    // FR-06 — the route the map draws for this trip.
    route_id: { type: mongoose.Schema.Types.ObjectId, ref: "Route", default: null },
    transport_option_id: { type: mongoose.Schema.Types.ObjectId, ref: "TransportOption", default: null },

    // FR-16 — carbon estimate, stored so the Budget page banner is a read.
    carbon: {
      total_kg: { type: Number, default: 0 },
      per_person_kg: { type: Number, default: 0 },
      mode: { type: String, default: "" },
      distance_km: { type: Number, default: 0 },
      rating: { type: String, default: "" },
      computed_at: { type: Date, default: null },
    },

    cover: { type: String, default: "beach" }, // card artwork key used by the UI
    notes: { type: String, default: "" },
    is_archived: { type: Boolean, default: false },

    itinerary_generated_at: { type: Date, default: null },
    itinerary_source: { type: String, default: "" }, // template | groq | claude | openai | manual
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Keep duration_days in step with the dates without making callers set it.
tripSchema.pre("validate", function setDuration() {
  if (this.start_date && this.end_date) {
    const ms = new Date(this.end_date) - new Date(this.start_date);
    this.duration_days = Math.max(1, Math.round(ms / 86400000) + 1);
  }
});

tripSchema.index({ user_id: 1, created_at: -1 });
tripSchema.index({ user_id: 1, status: 1 });
tripSchema.index({ destination: 1 });
tripSchema.index({ start_date: 1 });
tripSchema.index({ status: 1, start_date: 1 }); // notification scheduler

export default mongoose.model("Trip", tripSchema);
