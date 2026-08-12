// FR-12 — Tourist Attractions.
//
// Every field the proposal (§4.1.6) documents is unchanged; the rest is
// additive — a destination_id so attractions roll up to a city, a GeoJSON
// `location` mirroring lat_lng for proximity search, and the detail the
// itinerary planner needs (visit duration, best time of day, indoor/outdoor
// for rainy-day swaps).
import mongoose from "mongoose";
import { geoPointSchema, latLngSchema, withGeoSync } from "./_shared.js";

const attractionSchema = new mongoose.Schema(
  {
    // — proposal §4.1.6 —
    name: { type: String, required: true },
    city: { type: String, required: true },
    category: { type: String, required: true }, // beach, history, nature, wildlife…
    entry_fee: { type: Number, default: 0 },
    currency: { type: String, default: "BDT", uppercase: true },
    lat_lng: latLngSchema,
    open_hours: { type: String, default: "" },

    // — additive —
    slug: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
    location: geoPointSchema,

    description: { type: String, default: "" },
    address: { type: String, default: "" },
    tags: { type: [String], default: [] },

    // Planner inputs.
    avg_visit_duration_min: { type: Number, default: 90 },
    best_time_of_day: {
      type: String,
      enum: ["morning", "afternoon", "evening", "night", "any"],
      default: "any",
    },
    is_indoor: { type: Boolean, default: false }, // rainy-day substitutes
    // Set where rain or season materially changes the experience — the
    // planner swaps these out when the forecast for that day is wet.
    weather_dependent: { type: Boolean, default: false },
    is_free: { type: Boolean, default: false },
    closed_days: { type: [String], default: [] }, // ["Friday"]
    seasonal_note: { type: String, default: "" },

    // Fees beyond the headline entry_fee, so budget estimates are honest.
    foreigner_entry_fee: { type: Number, default: null },
    child_entry_fee: { type: Number, default: null },
    parking_fee: { type: Number, default: 0 },
    guide_fee: { type: Number, default: 0 },

    // Maintained by the review controller as reviews land.
    rating: { type: Number, min: 0, max: 5, default: 0 },
    review_count: { type: Number, default: 0 },
    popularity: { type: Number, default: 50, min: 0, max: 100 },

    image_url: { type: String, default: null },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

withGeoSync(attractionSchema);

attractionSchema.index({ location: "2dsphere" });
attractionSchema.index({ city: 1, category: 1 });
attractionSchema.index({ destination_id: 1, is_active: 1 });
attractionSchema.index({ name: "text", description: "text", tags: "text" });
attractionSchema.index({ rating: -1 });

export default mongoose.model("Attraction", attractionSchema);
