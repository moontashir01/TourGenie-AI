import mongoose from "mongoose";

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
//
// With no coordinates the field has to be removed outright, not left as it
// is. `type` defaults to "Point", so a document saved without a lat/lng
// carries a Point with no coordinates — which the 2dsphere index refuses
// with "Can't extract geo keys", turning every admin "create hotel" without
// map coordinates into a 500.
export function syncGeo(doc) {
  const lat = doc.lat_lng?.lat;
  const lng = doc.lat_lng?.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    doc.location = { type: "Point", coordinates: [lng, lat] };
    return;
  }
  if (!doc.location?.coordinates?.length) doc.location = undefined;
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

// ── Soft delete ──────────────────────────────────────────────────────
//
// Catalogue records are referenced by things that outlive them: a trip names
// a destination, a ticket names a schedule, a review names an attraction.
// Deleting one outright strands those, so an admin delete marks the row
// instead and the record can be brought back.
//
// `is_active: false` is set at the same time on purpose. Every public query
// already filters on it, so one flag makes a soft-deleted record vanish from
// the traveller app without a single read path having to learn about
// deletion.
export function withSoftDelete(schema) {
  schema.add({
    deleted_at: { type: Date, default: null },
    deleted_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Where the row came from, so a screen can say whether it is seed data
    // (and will come back on the next reseed) or was created in the portal.
    source_kind: { type: String, enum: ["seed", "admin"], default: "seed" },
  });
  schema.index({ deleted_at: 1 });
  return schema;
}
