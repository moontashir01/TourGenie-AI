// FR-06 — Route Optimization, served from MongoDB instead of OpenRouteService.
//
// Each document is one precomputed route between two points for one travel
// mode, including the polyline the map draws and the turn-by-turn legs the
// side panel lists. `variant` lets the same pair store a fastest / shortest /
// scenic option so "fastest route selected" (wireframe §3.7) is a real choice
// against real rows rather than a label.
import mongoose from "mongoose";
import { geoPointSchema, latLngSchema, syncGeo, TIMESTAMPS, withSoftDelete } from "./_shared.js";

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
    // Added with the admin screen: a road closed by flooding is taken
    // out of the app without deleting the route it describes. Read
    // paths test `$ne: false` rather than `true`, because every row
    // seeded before this field existed simply doesn't carry it.
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

// The endpoints carry their own GeoJSON and nothing kept it in step with
// lat_lng. The seeder writes both, so this never showed; a route created from
// the admin portal with coordinates and no `location` was refused outright by
// the 2dsphere index below — "Can't extract geo keys" — because `type`
// defaults to "Point" while the coordinates are missing. Same fix withGeoSync
// applies at the top level, for both endpoints.
routeSchema.pre("validate", function syncEndpointGeo() {
  if (this.from) syncGeo(this.from);
  if (this.to) syncGeo(this.to);
});

routeSchema.index({ "from.name": 1, "to.name": 1, mode: 1, variant: 1 }, { unique: true });
routeSchema.index({ "from.name": 1, "to.name": 1, is_default: -1 });
routeSchema.index({ "from.location": "2dsphere" });
routeSchema.index({ mode: 1 });

withSoftDelete(routeSchema);

export default mongoose.model("Route", routeSchema);
