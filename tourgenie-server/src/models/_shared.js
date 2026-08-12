// Shared sub-schema pieces reused across the new collections.
//
// Every place-like document carries BOTH shapes on purpose:
//   lat_lng  { lat, lng }              — the shape the proposal (§4.1) documents
//   location { type:"Point", coords }  — GeoJSON, so a 2dsphere index can answer
//                                        "what's near me" straight from MongoDB
//                                        instead of calling the Overpass API.
// `syncGeo` keeps the second in step with the first, so callers only ever
// have to set lat_lng.

export const geoPointSchema = {
  type: {
    type: String,
    enum: ["Point"],
    default: "Point",
  },
  coordinates: {
    type: [Number], // [lng, lat] — GeoJSON order, NOT lat/lng
    default: undefined,
  },
};

export const latLngSchema = {
  lat: { type: Number, min: -90, max: 90 },
  lng: { type: Number, min: -180, max: 180 },
};

// Mongoose pre-validate hook: mirror lat_lng into GeoJSON `location`.
export function syncGeo(doc) {
  const lat = doc.lat_lng?.lat;
  const lng = doc.lat_lng?.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    doc.location = { type: "Point", coordinates: [lng, lat] };
  }
}

// Attach the hook to a schema that has both `lat_lng` and `location`.
// Declared with no parameters so Mongoose treats it as a synchronous hook
// rather than looking for a `next` callback.
export function withGeoSync(schema) {
  schema.pre("validate", function attachGeo() {
    syncGeo(this);
  });
  return schema;
}

export const TIMESTAMPS = {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
};
