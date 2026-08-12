// FR-06 — Route Optimization, served from MongoDB instead of OpenRouteService.
//
// Each document is one precomputed route between two points for one travel
// mode, including the polyline the map draws and the turn-by-turn legs the
// side panel lists. `variant` lets the same pair store a fastest / shortest /
// scenic option so "fastest route selected" (wireframe §3.7) is a real choice
// against real rows rather than a label.
import mongoose from "mongoose";
import { geoPointSchema, latLngSchema, TIMESTAMPS } from "./_shared.js";

export const TRAVEL_MODES = ["driving", "bus", "train", "launch", "flight", "walking", "cycling"];

const endpointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: ["city", "attraction", "hotel", "poi"], default: "city" },
    ref_id: { type: mongoose.Schema.Types.ObjectId, default: null }, // Destination/Attraction id
    lat_lng: latLngSchema,
    location: geoPointSchema,
  },
  { _id: false }
);

const legSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true },
    instruction: { type: String, required: true }, // "Head south on N1 toward Chattogram"
    road: { type: String, default: "" }, // N1, N2, Dhaka–Chattogram Highway
    distance_km: { type: Number, required: true },
    duration_min: { type: Number, required: true },
    via: { type: String, default: "" }, // town the leg passes through
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    from: { type: endpointSchema, required: true },
    to: { type: endpointSchema, required: true },

    mode: { type: String, enum: TRAVEL_MODES, required: true },
    profile: { type: String, default: "driving-car" }, // ORS-compatible naming
    variant: {
      type: String,
      enum: ["fastest", "shortest", "scenic", "cheapest"],
      default: "fastest",
    },
    is_default: { type: Boolean, default: false }, // the one selected on load

    distance_km: { type: Number, required: true, min: 0 },
    duration_min: { type: Number, required: true, min: 0 },

    // GeoJSON LineString — [lng, lat] pairs, drawn straight onto the Leaflet map.
    geometry: {
      type: { type: String, enum: ["LineString"], default: "LineString" },
      coordinates: { type: [[Number]], default: [] },
    },

    legs: { type: [legSchema], default: [] },

    // Cost + emissions inputs so FR-09 (budget) and FR-16 (carbon) can be
    // answered from the same row the map was drawn from.
    est_fare_bdt: { type: Number, default: 0 }, // per passenger, public transport
    toll_bdt: { type: Number, default: 0 },
    fuel_cost_bdt: { type: Number, default: 0 }, // private car estimate
    carbon_kg: { type: Number, default: 0 }, // per passenger, from CarbonFactor

    notes: { type: String, default: "" },
    source: { type: String, default: "seeded" },
  },
  TIMESTAMPS
);

routeSchema.index({ "from.name": 1, "to.name": 1, mode: 1, variant: 1 }, { unique: true });
routeSchema.index({ "from.name": 1, "to.name": 1, is_default: -1 });
routeSchema.index({ "from.location": "2dsphere" });
routeSchema.index({ mode: 1 });

export default mongoose.model("Route", routeSchema);
