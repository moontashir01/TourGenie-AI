// FR-04 — AI Itinerary Generation, database-backed.
//
// A library of curated day-by-day plans keyed by destination + duration +
// budget tier + interests. The planner scores every template against the
// trip's parameters, picks the best match, stretches or trims it to the
// actual number of days, and writes ItineraryItem rows.
//
// This is what lets itinerary generation work with no LLM key configured
// and no network call — the AI provider, when one is available, refines a
// plan that already exists rather than inventing one from nothing.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";
import { BUDGET_TIERS } from "./CostBenchmark.js";

const templateItemSchema = new mongoose.Schema(
  {
    time: { type: String, required: true }, // "09:00", 24-hour
    activity: { type: String, required: true },
    location: { type: String, default: "" },
    // Resolved to a real Attraction._id at generation time, so templates stay
    // portable across reseeds (ObjectIds change, slugs don't).
    attraction_slug: { type: String, default: null },
    est_cost: { type: Number, default: 0 }, // template currency, per traveller
    duration_min: { type: Number, default: 60 },
    category: {
      type: String,
      enum: ["travel", "meal", "sightseeing", "activity", "rest", "shopping", "checkin", "checkout"],
      default: "activity",
    },
    tags: { type: [String], default: [] },
    is_optional: { type: Boolean, default: false }, // first to drop on a "relaxed" pace
    weather_dependent: { type: Boolean, default: false }, // swapped out on rainy days
  },
  { _id: false }
);

const templateDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1 },
    theme: { type: String, default: "" }, // "Arrival & sunset"
    items: { type: [templateItemSchema], default: [] },
  },
  { _id: false }
);

const itineraryTemplateSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", required: true },
    city: { type: String, required: true },

    title: { type: String, required: true },
    summary: { type: String, default: "" },

    duration_days: { type: Number, required: true, min: 1 },
    pace: { type: String, enum: ["relaxed", "balanced", "packed"], default: "balanced" },
    budget_tier: { type: String, enum: BUDGET_TIERS, default: "mid" },
    currency: { type: String, default: "BDT", uppercase: true },
    interests: { type: [String], default: [] }, // matched against Trip.interests
    suitable_for: { type: [String], default: [] }, // family, couple, solo, friends

    days: { type: [templateDaySchema], default: [] },

    est_total_cost_per_person: { type: Number, default: 0 },
    popularity: { type: Number, default: 50, min: 0, max: 100 },
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

itineraryTemplateSchema.index({ destination_id: 1, duration_days: 1, budget_tier: 1 });
itineraryTemplateSchema.index({ city: 1, is_active: 1 });
itineraryTemplateSchema.index({ interests: 1 });

export default mongoose.model("ItineraryTemplate", itineraryTemplateSchema);
