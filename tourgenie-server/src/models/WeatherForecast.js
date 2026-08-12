// FR-11 — Weather Forecast, served from MongoDB rather than OpenWeather.
//
// One document per destination per calendar day. `npm run seed:weather`
// generates a rolling window (default 180 days) from the ClimateNormal
// monthly averages, so a forecast always exists for any trip date the user
// can realistically pick. Re-running the generator refreshes the window.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

export const WEATHER_CONDITIONS = [
  "clear",
  "partly-cloudy",
  "cloudy",
  "light-rain",
  "rain",
  "heavy-rain",
  "thunderstorm",
  "fog",
  "haze",
  "windy",
];

const alertSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // heat, rain, storm, flood, cyclone
    severity: { type: String, enum: ["info", "advisory", "watch", "warning"], default: "info" },
    headline: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const weatherForecastSchema = new mongoose.Schema(
  {
    destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", required: true },
    city: { type: String, required: true }, // denormalised so lookups by name work
    date: { type: Date, required: true }, // normalised to 00:00 UTC

    temp_min_c: { type: Number, required: true },
    temp_max_c: { type: Number, required: true },
    temp_avg_c: { type: Number, required: true },
    feels_like_c: { type: Number, required: true },

    condition: { type: String, enum: WEATHER_CONDITIONS, required: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" }, // lucide-react icon name for the UI

    humidity_pct: { type: Number, min: 0, max: 100 },
    cloud_pct: { type: Number, min: 0, max: 100 },
    wind_kph: { type: Number, min: 0 },
    wind_dir: { type: String, default: "" }, // N, NE, E…
    rain_chance_pct: { type: Number, min: 0, max: 100 },
    rain_mm: { type: Number, min: 0, default: 0 },
    uv_index: { type: Number, min: 0, max: 12 },
    visibility_km: { type: Number, min: 0 },

    sunrise: { type: String, default: "" }, // "05:32"
    sunset: { type: String, default: "" },

    alerts: { type: [alertSchema], default: [] },

    // Tags the packing assistant (FR-15) matches its rules against.
    packing_hints: { type: [String], default: [] }, // rain, hot, cold, humid, sunny

    source: { type: String, default: "climate-model" },
    generated_at: { type: Date, default: Date.now },
  },
  TIMESTAMPS
);

// One forecast per place per day, and the index that makes the
// "next N days for this city" query a straight range scan.
weatherForecastSchema.index({ destination_id: 1, date: 1 }, { unique: true });
weatherForecastSchema.index({ city: 1, date: 1 });
weatherForecastSchema.index({ date: 1 });

export default mongoose.model("WeatherForecast", weatherForecastSchema);
