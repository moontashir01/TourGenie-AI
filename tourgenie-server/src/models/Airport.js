// Airport reference data — replaces the hardcoded city→IATA map that the
// flight search previously carried in code, so the admin can add an airport
// without a redeploy.
import mongoose from "mongoose";
import { geoPointSchema, latLngSchema, withGeoSync, TIMESTAMPS } from "./_shared.js";

const airportSchema = new mongoose.Schema(
  {
    iata: { type: String, required: true, unique: true, uppercase: true, minlength: 3, maxlength: 3 },
    icao: { type: String, default: "", uppercase: true },
    name: { type: String, required: true },

    city: { type: String, required: true },
    city_aliases: { type: [String], default: [] }, // "Dacca", "Chittagong"
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
    country: { type: String, required: true },
    country_code: { type: String, default: "BD", uppercase: true, maxlength: 2 },

    lat_lng: latLngSchema,
    location: geoPointSchema,
    timezone: { type: String, default: "Asia/Dhaka" },

    is_international: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

withGeoSync(airportSchema);

airportSchema.index({ city: 1 });
airportSchema.index({ location: "2dsphere" });
airportSchema.index({ city: "text", name: "text", city_aliases: "text" });

export default mongoose.model("Airport", airportSchema);
