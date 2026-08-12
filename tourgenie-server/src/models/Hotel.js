// FR-07 — Hotel Recommendation.
//
// The proposal's fields (§4.1.7) are intact. Added: a destination_id, GeoJSON
// `location` for distance-based ranking, room types so a trip's traveller
// count maps to a real nightly rate, and `distance_to_landmark` — the
// "0.2 km to beach" line the wireframe's hotel cards show.
import mongoose from "mongoose";
import { geoPointSchema, latLngSchema, withGeoSync } from "./_shared.js";

const roomTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Deluxe Twin"
    capacity: { type: Number, default: 2 },
    price_per_night: { type: Number, required: true },
    beds: { type: String, default: "" },
    has_ac: { type: Boolean, default: true },
    breakfast_included: { type: Boolean, default: false },
    rooms_available: { type: Number, default: 5 },
  },
  { _id: false }
);

const hotelSchema = new mongoose.Schema(
  {
    // — proposal §4.1.7 —
    name: { type: String, required: true },
    city: { type: String, required: true },
    price_per_night: { type: Number, required: true }, // cheapest room in currency
    currency: { type: String, default: "BDT", uppercase: true },
    rating: { type: Number, min: 0, max: 5, default: 3 },
    facilities: { type: [String], default: [] },
    lat_lng: latLngSchema,

    // — additive —
    slug: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
    location: geoPointSchema,

    address: { type: String, default: "" },
    area: { type: String, default: "" }, // Kolatoli, Gulshan-1
    description: { type: String, default: "" },
    star_rating: { type: Number, min: 1, max: 5, default: 3 }, // official stars
    review_score: { type: Number, min: 0, max: 10, default: 0 }, // guest score /10
    review_count: { type: Number, default: 0 },

    room_types: { type: [roomTypeSchema], default: [] },
    price_range: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    budget_tier: { type: String, enum: ["budget", "mid", "luxury"], default: "mid" },

    // Powers the "0.2 km to beach" tag on the card.
    distance_to_landmark: {
      landmark: { type: String, default: "" },
      km: { type: Number, default: null },
    },

    checkin_time: { type: String, default: "14:00" },
    checkout_time: { type: String, default: "12:00" },
    phone: { type: String, default: "" },
    cancellation_policy: { type: String, default: "" },
    image_url: { type: String, default: null },

    source: { type: String, default: "seeded" }, // seeded | stayapi
    external_id: { type: String, default: null },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

withGeoSync(hotelSchema);

hotelSchema.index({ location: "2dsphere" });
hotelSchema.index({ city: 1, price_per_night: 1 });
hotelSchema.index({ city: 1, rating: -1 });
hotelSchema.index({ destination_id: 1, budget_tier: 1 });
hotelSchema.index({ name: "text", description: "text", facilities: "text" });

export default mongoose.model("Hotel", hotelSchema);
