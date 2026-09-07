import {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudLightning,
  CloudFog,
  Haze,
  Wind,
} from "lucide-react";

const ICONS = {
  clear: Sun,
  "partly-cloudy": CloudSun,
  cloudy: Cloud,
  "light-rain": CloudDrizzle,
  rain: CloudRain,
  "heavy-rain": CloudRainWind,
  thunderstorm: CloudLightning,
  fog: CloudFog,
  haze: Haze,
  windy: Wind,
};

const WET = new Set(["light-rain", "rain", "heavy-rain", "thunderstorm"]);

// Compact chip for day headers: icon + high/low. Wet days get a gold tint so
// a rainy stretch is visible at a glance down the itinerary.
export default function WeatherBadge({ forecast }) {
  if (!forecast) return null;
  const Icon = ICONS[forecast.condition] || CloudSun;
  const wet = WET.has(forecast.condition);
  return (
    <span
      title={`${forecast.description}${forecast.rain_chance_pct != null ? ` · ${forecast.rain_chance_pct}% rain` : ""}`}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
        wet ? "bg-gold/15 text-ink-900" : "bg-paper text-ink-600"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${wet ? "text-gold" : "text-teal-dark"}`} strokeWidth={1.75} />
      {Math.round(forecast.temp_max_c)}°/{Math.round(forecast.temp_min_c)}°
    </span>
  );
}

// Fuller one-liner inside an open day panel.
export function WeatherDetail({ forecast }) {
  if (!forecast) return null;
  const Icon = ICONS[forecast.condition] || CloudSun;
  const wet = WET.has(forecast.condition);
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs rounded-xl px-4 py-2.5 mb-4 border ${
        wet ? "bg-gold/10 border-gold/30 text-ink-900" : "bg-teal-light/30 border-teal-light text-ink-900/70"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Icon className={`w-4 h-4 ${wet ? "text-gold" : "text-teal-dark"}`} strokeWidth={1.75} />
        {forecast.description}
      </span>
      <span>
        {Math.round(forecast.temp_min_c)}–{Math.round(forecast.temp_max_c)} °C
      </span>
      {forecast.rain_chance_pct != null && <span>{forecast.rain_chance_pct}% chance of rain</span>}
      {forecast.humidity_pct != null && <span>{forecast.humidity_pct}% humidity</span>}
      {forecast.sunrise && (
        <span className="text-ink-500">
          ☀ {forecast.sunrise} – {forecast.sunset}
        </span>
      )}
      {forecast.source === "climate-normal" && (
        <span className="text-ink-500 italic">typical for the season, not a live forecast</span>
      )}
    </div>
  );
}
