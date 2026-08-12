// Master catalogue of every place the platform knows about.
//
// This is the collection destination search (FR-03 trip creation, and the
// guest-facing search on the landing page) reads from. Attractions, hotels,
// weather, routes, cost benchmarks and itinerary templates all hang off a
// destination_id, so adding a new city is a single insert here plus its
// related rows.
import mongoose from "mongoose";
import { geoPointSchema, latLngSchema, withGeoSync, TIMESTAMPS } from "./_shared.js";

const destinationSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    aliases: { type: [String], default: [] }, // "Coxs Bazar", "Cox Bazar" — search helpers

    country: { type: String, required: true, default: "Bangladesh" },
    country_code: { type: String, default: "BD", uppercase: true, maxlength: 2 },
    division: { type: String, default: "" }, // Chattogram, Sylhet, Khulna…

    type: {
      type: String,
      enum: ["city", "beach", "hill", "forest", "island", "heritage", "nature", "metro"],
      required: true,
    },
    is_international: { type: Boolean, default: false },

    summary: { type: String, default: "" }, // one-liner for cards
    description: { type: String, default: "" }, // long copy for the destination page
    highlights: { type: [String], default: [] },

    lat_lng: latLngSchema,
    location: geoPointSchema,

    timezone: { type: String, default: "Asia/Dhaka" },
    currency: { type: String, default: "BDT" }, // local currency at the destination
    pricing_currency: { type: String, default: "BDT" }, // normalized catalogue/budget amounts
    languages: { type: [String], default: ["bn", "en"] },

    tags: { type: [String], default: [] }, // beach, family, adventure, budget…
    best_months: { type: [Number], default: [] }, // 1–12
    peak_season: { type: String, default: "" },

    // Used to pre-fill the budget slider on the Plan Trip form (FR-03/FR-09).
    avg_daily_cost: { type: Number, default: 0 }, // pricing_currency, per traveller, mid tier
    recommended_days: { type: Number, default: 3 },

    popularity: { type: Number, default: 50, min: 0, max: 100 }, // search ranking
    nearest_airport: { type: String, default: null }, // IATA code -> Airport collection
    hero_image: { type: String, default: null },

    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

withGeoSync(destinationSchema);

destinationSchema.index({ location: "2dsphere" });
destinationSchema.index({ name: "text", aliases: "text", summary: "text", tags: "text" });
destinationSchema.index({ country_code: 1, is_active: 1, popularity: -1 });
destinationSchema.index({ type: 1, is_active: 1 });

export default mongoose.model("Destination", destinationSchema);
