// FR-13 — Nearby Services, served from MongoDB instead of the OSM Overpass API.
//
// The 2dsphere index on `location` is what makes this work: a $geoNear
// aggregation returns the same "here are the restaurants within 2 km, sorted
// by distance" answer Overpass would, with the distance already computed.
import mongoose from "mongoose";
import { geoPointSchema, latLngSchema, withGeoSync, TIMESTAMPS } from "./_shared.js";

export const SERVICE_CATEGORIES = [
  "restaurant",
  "cafe",
  "hospital",
  "pharmacy",
  "atm",
  "bank",
  "fuel",
  "shopping",
  "toilet",
  "police",
  "mosque",
  "bus_stop",
  "hotel",
  "tourist_info",
];

const nearbyServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: SERVICE_CATEGORIES, required: true },
    subcategory: { type: String, default: "" }, // "seafood", "government hospital", "ATM booth"

    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
    city: { type: String, required: true },
    area: { type: String, default: "" }, // Kolatoli, Gulshan-2

    address: { type: String, default: "" },
    lat_lng: latLngSchema,
    location: geoPointSchema,

    phone: { type: String, default: "" },
    opening_hours: { type: String, default: "" },
    is_24h: { type: Boolean, default: false },

    rating: { type: Number, min: 0, max: 5, default: 0 },
    price_level: { type: Number, min: 0, max: 4, default: 0 }, // 0 unknown … 4 expensive
    tags: { type: [String], default: [] }, // halal, wheelchair, card-accepted

    // Kept so a record sourced from OSM can be traced back / de-duplicated
    // if the team later imports a live Overpass extract.
    osm_id: { type: String, default: null },
    source: { type: String, default: "seeded" },
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

withGeoSync(nearbyServiceSchema);

nearbyServiceSchema.index({ location: "2dsphere" });
nearbyServiceSchema.index({ city: 1, category: 1 });
nearbyServiceSchema.index({ destination_id: 1, category: 1 });
nearbyServiceSchema.index({ name: "text", tags: "text" });

export default mongoose.model("NearbyService", nearbyServiceSchema);
