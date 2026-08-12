// Builds ClimateNormal rows and the rolling daily WeatherForecast window
// from the regional climate profiles.
//
// The daily values are deterministic: the same destination and date always
// produce the same forecast, because the PRNG is seeded from them. That
// means reseeding doesn't churn the data, and the same trip dates give the
// same answer on every run — which is what you want from a demo dataset,
// and what you'd never get from a live weather API.

import {
  climateProfiles,
  destinationClimate,
  MONTH_NAMES,
  seasonForMonth,
  dominantCondition,
  travelAdvice,
  isGoodForTravel,
} from "../data/climate.js";

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Sunrise / sunset ─────────────────────────────────────────────────
// NOAA's simplified solar-position equations. Accurate to a few minutes,
// which is all a travel app needs.
function sunTimes(lat, lng, date, timezoneOffsetHours) {
  const dayOfYear = Math.floor((date - new Date(Date.UTC(date.getUTCFullYear(), 0, 0))) / 86400000);
  const decl = 23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81)) * (Math.PI / 180);
  const latRad = (lat * Math.PI) / 180;

  const cosH = -Math.tan(latRad) * Math.tan(decl);
  // Polar day / night — never happens at these latitudes, but guard anyway.
  if (cosH > 1 || cosH < -1) return { sunrise: "06:00", sunset: "18:00" };

  const hourAngle = (Math.acos(cosH) * 180) / Math.PI / 15; // hours from solar noon
  const b = ((2 * Math.PI) / 364) * (dayOfYear - 81);
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b); // minutes
  const solarNoon = 12 - lng / 15 - eot / 60 + timezoneOffsetHours;

  const fmt = (h) => {
    let t = ((h % 24) + 24) % 24;
    const hh = Math.floor(t);
    const mm = Math.round((t - hh) * 60);
    const carry = mm === 60 ? 1 : 0;
    return `${String((hh + carry) % 24).padStart(2, "0")}:${String(carry ? 0 : mm).padStart(2, "0")}`;
  };

  return { sunrise: fmt(solarNoon - hourAngle), sunset: fmt(solarNoon + hourAngle) };
}

const TZ_OFFSET = {
  "Asia/Dhaka": 6, "Asia/Kathmandu": 5.75, "Asia/Bangkok": 7, "Asia/Kuala_Lumpur": 8,
  "Asia/Dubai": 4, "Asia/Kolkata": 5.5, "Asia/Singapore": 8, "Indian/Maldives": 5,
};

const WIND_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// ── Condition selection ──────────────────────────────────────────────
function pickCondition(rnd, rainProbability, intensity, humidity, tempMax) {
  const roll = rnd();

  if (roll < rainProbability) {
    // It's a rain day — how hard depends on the month's mm-per-rain-day.
    if (intensity > 45) return rnd() < 0.35 ? "thunderstorm" : "heavy-rain";
    if (intensity > 22) return "rain";
    return "light-rain";
  }

  // Dry day. Cloud cover still tracks the season's wetness.
  const dryRoll = rnd();
  if (rainProbability > 0.5) return dryRoll < 0.55 ? "cloudy" : "partly-cloudy";
  if (rainProbability > 0.25) return dryRoll < 0.45 ? "partly-cloudy" : "clear";
  // Dry season in the plains brings winter fog and dry-season haze.
  if (humidity > 78 && tempMax < 28 && dryRoll < 0.15) return "fog";
  if (humidity < 60 && dryRoll < 0.12) return "haze";
  return dryRoll < 0.3 ? "partly-cloudy" : "clear";
}

const CONDITION_META = {
  clear: { icon: "Sun", description: "Clear skies", cloud: [0, 15], rainChance: [0, 10] },
  "partly-cloudy": { icon: "CloudSun", description: "Partly cloudy", cloud: [20, 55], rainChance: [10, 25] },
  cloudy: { icon: "Cloud", description: "Overcast", cloud: [60, 95], rainChance: [20, 40] },
  "light-rain": { icon: "CloudDrizzle", description: "Light showers", cloud: [65, 90], rainChance: [55, 75] },
  rain: { icon: "CloudRain", description: "Rain", cloud: [75, 100], rainChance: [75, 90] },
  "heavy-rain": { icon: "CloudRainWind", description: "Heavy rain", cloud: [85, 100], rainChance: [88, 98] },
  thunderstorm: { icon: "CloudLightning", description: "Thunderstorms", cloud: [85, 100], rainChance: [85, 98] },
  fog: { icon: "CloudFog", description: "Morning fog", cloud: [40, 80], rainChance: [5, 20] },
  haze: { icon: "Haze", description: "Hazy", cloud: [20, 50], rainChance: [0, 12] },
  windy: { icon: "Wind", description: "Windy", cloud: [30, 70], rainChance: [10, 30] },
};

const WET_CONDITIONS = ["light-rain", "rain", "heavy-rain", "thunderstorm"];

function packingHints(condition, tempMin, tempMax, humidity) {
  const hints = [];
  if (WET_CONDITIONS.includes(condition)) hints.push("rain");
  if (condition === "heavy-rain" || condition === "thunderstorm") hints.push("heavy-rain");
  if (tempMax >= 32) hints.push("hot");
  if (tempMin <= 15) hints.push("cold");
  if (humidity >= 80) hints.push("humid");
  if (condition === "clear" || condition === "partly-cloudy") hints.push("sunny");
  return hints;
}

function buildAlerts(condition, tempMax, tempMin, rainMm, windKph) {
  const alerts = [];
  if (condition === "thunderstorm") {
    alerts.push({ type: "storm", severity: "warning", headline: "Thunderstorm expected", description: "Lightning and gusty winds. Boat trips and hill roads are affected first — confirm with your operator before travelling." });
  }
  if (rainMm >= 60) {
    alerts.push({ type: "rain", severity: "warning", headline: "Very heavy rainfall", description: `Around ${Math.round(rainMm)} mm expected. Localised flooding and transport delays are likely.` });
  }
  if (tempMax >= 38) {
    alerts.push({ type: "heat", severity: "warning", headline: "Heatwave conditions", description: `Highs near ${Math.round(tempMax)} °C. Avoid outdoor sightseeing between 11:00 and 15:00 and keep drinking water.` });
  } else if (tempMax >= 36) {
    alerts.push({ type: "heat", severity: "advisory", headline: "Very hot day", description: "Plan outdoor activity for the early morning or late afternoon." });
  }
  if (tempMin <= 10) {
    alerts.push({ type: "cold", severity: "advisory", headline: "Cold night", description: `Lows near ${Math.round(tempMin)} °C. Bring a warm layer, particularly at hill destinations.` });
  }
  if (windKph >= 45) {
    alerts.push({ type: "wind", severity: "advisory", headline: "Strong winds", description: "Ferry and small-boat services may be suspended." });
  }
  return alerts;
}

// ── Public builders ──────────────────────────────────────────────────

export function buildClimateNormals(destination) {
  const mapping = destinationClimate[destination.slug];
  if (!mapping) return [];
  const profile = climateProfiles[mapping.profile];
  if (!profile) return [];
  const offset = mapping.temp_offset_c || 0;

  return profile.months.map((m, i) => {
    const [tMin, tMax, humidity, rainMm, rainDays] = m;
    const month = i + 1;
    const minC = +(tMin + offset).toFixed(1);
    const maxC = +(tMax + offset).toFixed(1);
    return {
      destination_id: destination._id,
      city: destination.name,
      month,
      month_name: MONTH_NAMES[i],
      temp_min_c: minC,
      temp_max_c: maxC,
      humidity_pct: humidity,
      rain_mm: rainMm,
      rain_days: rainDays,
      wind_kph: 8 + Math.round(rainDays / 3),
      uv_index: Math.max(3, Math.min(12, Math.round(11 - rainDays / 3))),
      dominant_condition: dominantCondition(rainDays),
      season: seasonForMonth(month, destination.country_code),
      travel_advice: travelAdvice(month, rainDays, maxC, minC),
      is_good_for_travel: isGoodForTravel(rainDays, maxC),
    };
  });
}

/**
 * One WeatherForecast document per day for `days` days starting at
 * `startDate` (default: today, UTC midnight).
 */
export function buildDailyForecasts(destination, { days = 180, startDate } = {}) {
  const mapping = destinationClimate[destination.slug];
  if (!mapping) return [];
  const profile = climateProfiles[mapping.profile];
  if (!profile) return [];

  const offset = mapping.temp_offset_c || 0;
  const tzOffset = TZ_OFFSET[destination.timezone] ?? 6;
  const lat = destination.lat_lng?.lat ?? 23.8;
  const lng = destination.lat_lng?.lng ?? 90.4;

  const start = startDate ? new Date(startDate) : new Date();
  start.setUTCHours(0, 0, 0, 0);

  const out = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * 86400000);
    const month = date.getUTCMonth() + 1;
    const [tMin, tMax, humidityNorm, rainMm, rainDays] = profile.months[month - 1];

    const dateKey = date.toISOString().slice(0, 10);
    const rnd = mulberry32(hashString(`${destination.slug}|${dateKey}`));

    const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), month, 0)).getUTCDate();
    const rainProbability = Math.min(0.95, rainDays / daysInMonth);
    const intensityPerRainDay = rainDays > 0 ? rainMm / rainDays : 0;

    // ±3 °C of day-to-day variation around the monthly normal.
    const maxC = +(tMax + offset + (rnd() * 6 - 3)).toFixed(1);
    const minC = +(Math.min(tMin + offset + (rnd() * 5 - 2.5), maxC - 3)).toFixed(1);
    const avgC = +((maxC + minC) / 2).toFixed(1);

    const humidity = Math.max(30, Math.min(99, Math.round(humidityNorm + (rnd() * 12 - 6))));
    const condition = pickCondition(rnd, rainProbability, intensityPerRainDay, humidity, maxC);
    const meta = CONDITION_META[condition];

    const isWet = WET_CONDITIONS.includes(condition);
    const dayRainMm = isWet ? +(intensityPerRainDay * (0.5 + rnd() * 1.4)).toFixed(1) : 0;

    const cloud = Math.round(meta.cloud[0] + rnd() * (meta.cloud[1] - meta.cloud[0]));
    const rainChance = Math.round(meta.rainChance[0] + rnd() * (meta.rainChance[1] - meta.rainChance[0]));
    const windKph = +(6 + rnd() * 14 + (isWet ? 10 : 0) + (condition === "thunderstorm" ? 15 : 0)).toFixed(1);
    const uv = Math.max(1, Math.min(12, Math.round(11 - cloud / 12 - (isWet ? 3 : 0))));

    // Humidity above ~70% makes heat feel worse; below that it's near enough.
    const feelsLike = +(maxC + (humidity > 70 ? (humidity - 70) * 0.09 : 0) - (windKph > 20 ? 1 : 0)).toFixed(1);

    const { sunrise, sunset } = sunTimes(lat, lng, date, tzOffset);

    out.push({
      destination_id: destination._id,
      city: destination.name,
      date,
      temp_min_c: minC,
      temp_max_c: maxC,
      temp_avg_c: avgC,
      feels_like_c: feelsLike,
      condition,
      description: meta.description,
      icon: meta.icon,
      humidity_pct: humidity,
      cloud_pct: cloud,
      wind_kph: windKph,
      wind_dir: WIND_DIRS[Math.floor(rnd() * WIND_DIRS.length)],
      rain_chance_pct: rainChance,
      rain_mm: dayRainMm,
      uv_index: uv,
      visibility_km: condition === "fog" ? +(0.5 + rnd() * 2).toFixed(1) : condition === "haze" ? +(3 + rnd() * 4).toFixed(1) : +(8 + rnd() * 4).toFixed(1),
      sunrise,
      sunset,
      alerts: buildAlerts(condition, maxC, minC, dayRainMm, windKph),
      packing_hints: packingHints(condition, minC, maxC, humidity),
      source: "climate-model",
      generated_at: new Date(),
    });
  }

  return out;
}

export default { buildClimateNormals, buildDailyForecasts };
