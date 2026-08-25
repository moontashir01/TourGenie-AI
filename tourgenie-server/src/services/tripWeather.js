// Resolves a trip into its days, the city each day happens in, and the
// weather for that city on that date.
//
// Shared by FR-11 (the forecast endpoint) and the rainy-day rewriter, so
// both agree on what "day 4 is wet" means. Beyond the generated forecast
// window it falls back to the monthly climate normals, labelled as such —
// described climate, not a forecast.
import ItineraryItem from "../models/ItineraryItem.js";
import WeatherForecast from "../models/WeatherForecast.js";
import ClimateNormal from "../models/ClimateNormal.js";

const DAY_MS = 86400000;

export function utcDay(value) {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Conditions that actually disrupt an outdoor plan. Cloud and haze do not.
export const WET_CONDITIONS = ["light-rain", "rain", "heavy-rain", "thunderstorm"];
export const SEVERE_CONDITIONS = ["heavy-rain", "thunderstorm"];

export function isWet(forecast) {
  if (!forecast) return false;
  if (WET_CONDITIONS.includes(forecast.condition)) return true;
  // A day the model calls "cloudy" but gives a high rain chance still ruins
  // a boat trip.
  return (forecast.rain_chance_pct ?? 0) >= 70;
}

/**
 * @returns {Array<{day, date, city, forecast}>}
 */
export async function resolveTripDays(trip) {
  const items = await ItineraryItem.find({ trip_id: trip._id }).select("day city").lean();
  const numDays = trip.duration_days || 1;

  // The city most of a day's items sit in wins the day.
  const countsByDay = {};
  for (const item of items) {
    if (!item.city) continue;
    (countsByDay[item.day] ||= {})[item.city] = ((countsByDay[item.day] ||= {})[item.city] || 0) + 1;
  }
  const cityOfDay = {};
  for (const [day, byCity] of Object.entries(countsByDay)) {
    cityOfDay[day] = Object.entries(byCity).sort((a, b) => b[1] - a[1])[0][0];
  }
  const fallbackCity = trip.multi_city ? trip.entry_city : trip.destination;

  const start = utcDay(trip.start_date);
  const days = Array.from({ length: numDays }, (_, i) => ({
    day: i + 1,
    date: new Date(start.getTime() + i * DAY_MS),
    city: cityOfDay[i + 1] || fallbackCity,
  }));

  const cities = [...new Set(days.map((d) => d.city).filter(Boolean))];
  if (cities.length === 0) return days.map((d) => ({ ...d, forecast: null }));

  const [forecasts, normals] = await Promise.all([
    WeatherForecast.find({
      city: { $in: cities },
      date: { $gte: days[0].date, $lte: days[days.length - 1].date },
    }).lean(),
    ClimateNormal.find({ city: { $in: cities } }).lean(),
  ]);

  const forecastByKey = new Map(
    forecasts.map((f) => [`${f.city}|${utcDay(f.date).toISOString().slice(0, 10)}`, f])
  );
  const normalByKey = new Map(normals.map((n) => [`${n.city}|${n.month}`, n]));

  return days.map((d) => {
    const f = forecastByKey.get(`${d.city}|${d.date.toISOString().slice(0, 10)}`);
    if (f) {
      return {
        ...d,
        forecast: {
          temp_min_c: f.temp_min_c,
          temp_max_c: f.temp_max_c,
          feels_like_c: f.feels_like_c,
          condition: f.condition,
          description: f.description,
          rain_chance_pct: f.rain_chance_pct,
          rain_mm: f.rain_mm,
          humidity_pct: f.humidity_pct,
          sunrise: f.sunrise,
          sunset: f.sunset,
          alerts: f.alerts || [],
          source: "forecast",
        },
      };
    }
    const n = normalByKey.get(`${d.city}|${d.date.getUTCMonth() + 1}`);
    if (n) {
      return {
        ...d,
        forecast: {
          temp_min_c: n.temp_min_c,
          temp_max_c: n.temp_max_c,
          feels_like_c: n.temp_max_c,
          condition: n.dominant_condition,
          description: `Typical ${n.month_name} weather`,
          rain_chance_pct: null,
          rain_mm: null,
          humidity_pct: n.humidity_pct,
          sunrise: "",
          sunset: "",
          alerts: [],
          source: "climate-normal",
        },
      };
    }
    return { ...d, forecast: null };
  });
}

export default { resolveTripDays, isWet, utcDay, WET_CONDITIONS, SEVERE_CONDITIONS };
