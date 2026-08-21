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

const hotelSelectionSchema = new mongoose.Schema(
  {
    city: { type: String, required: true },
    hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    // — proposal §4.1.2 —
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", default: null },
    // Multi-city trips need one hotel per city rather than the single
    // hotel_id above — each entry replaces any prior pick for that city.
    hotel_selections: { type: [hotelSelectionSchema], default: [] },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    travelers: { type: Number, required: true, min: 1 },
    budget: { type: Number, required: true, min: 0 },
    // Always BDT. The amount the traveler actually typed, and the currency
    // they typed it in, are kept alongside so the form can show it back
    // unchanged — conversion happens once, on write.
    budget_currency: { type: String, default: "BDT", uppercase: true },
    budget_input: { type: Number, default: null },
    // Whether the number above is meant to cover the flights in and out.
    // When false the Budget page tracks flights separately instead of
    // eating the whole budget with one international fare.
    budget_includes_flights: { type: Boolean, default: true },
    status: { type: String, enum: ["draft", "planned", "active", "completed"], default: "draft" },

    // — already in use by the app —
    interests: { type: [String], default: [] },
    transport_preference: { type: String, default: "No preference" },
    hotel_preference: { type: String, default: "Balanced" },
    food_preference: { type: String, default: "No preference" },

    // Attractions the traveler explicitly picked to have in the plan —
    // AI itinerary generation (and chat-driven edits) must include every one
    // of these, rather than freely choosing from the whole catalog.
    must_visit_attraction_ids: { type: [mongoose.Schema.Types.ObjectId], ref: "Attraction", default: [] },

    // — additive —
    title: { type: String, default: "" }, // "4 days in Cox's Bazar"
    origin_destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },

    // Country-level trip: destination is a whole country ("Thailand") rather
    // than one city, so the AI itinerary picks which cities to visit and how
    // to move between them. destination_id stays null for these trips.
    multi_city: { type: Boolean, default: false },
    country_code: { type: String, default: null, uppercase: true, maxlength: 2 },
    entry_city: { type: String, default: "" }, // main gateway city, e.g. "Bangkok"

    duration_days: { type: Number, default: null }, // derived, kept for quick reads
    budget_tier: { type: String, enum: ["budget", "mid", "luxury"], default: "mid" },
    currency: { type: String, default: "BDT" },

    // FR-09 — the estimated split, computed from CostBenchmark at plan time.
    budget_breakdown: { type: [budgetLineSchema], default: [] },
    estimated_total: { type: Number, default: 0 },

    // FR-06 — the route the map draws for this trip.
    route_id: { type: mongoose.Schema.Types.ObjectId, ref: "Route", default: null },
    transport_option_id: { type: mongoose.Schema.Types.ObjectId, ref: "TransportOption", default: null },
    selected_flight: { type: mongoose.Schema.Types.Mixed, default: null },

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
    // A reversed range used to clamp to a single day and silently poison
    // every per-day cost downstream — reject it instead.
    if (ms < 0) {
      this.invalidate("end_date", "End date must be on or after the start date");
      return;
    }
    this.duration_days = Math.max(1, Math.round(ms / 86400000) + 1);
  }
});

tripSchema.index({ user_id: 1, created_at: -1 });
tripSchema.index({ user_id: 1, status: 1 });
tripSchema.index({ destination: 1 });
tripSchema.index({ start_date: 1 });
tripSchema.index({ status: 1, start_date: 1 }); // notification scheduler

export default mongoose.model("Trip", tripSchema);
