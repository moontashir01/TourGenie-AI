// Monthly climate averages per destination — the source data the daily
// WeatherForecast rows are generated from, and the fallback answer when a
// user picks a date beyond the generated forecast window.
//
// Figures are typical Bangladesh Meteorological Department style monthly
// normals: they describe the climate, not a live observation.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";
import { WEATHER_CONDITIONS } from "./WeatherForecast.js";

const climateNormalSchema = new mongoose.Schema(
  {
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", required: true },
    city: { type: String, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    month_name: { type: String, default: "" },

    temp_min_c: { type: Number, required: true },
    temp_max_c: { type: Number, required: true },
    humidity_pct: { type: Number, min: 0, max: 100 },
    rain_mm: { type: Number, min: 0, default: 0 }, // total for the month
    rain_days: { type: Number, min: 0, max: 31, default: 0 },
    wind_kph: { type: Number, min: 0, default: 8 },
    uv_index: { type: Number, min: 0, max: 12, default: 7 },

    dominant_condition: { type: String, enum: WEATHER_CONDITIONS, default: "partly-cloudy" },
    season: { type: String, default: "" }, // winter, summer, monsoon, autumn
    travel_advice: { type: String, default: "" },
    is_good_for_travel: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

climateNormalSchema.index({ destination_id: 1, month: 1 }, { unique: true });
climateNormalSchema.index({ city: 1, month: 1 });

export default mongoose.model("ClimateNormal", climateNormalSchema);
