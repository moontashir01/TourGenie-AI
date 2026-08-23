// FR-11 — Weather Forecast, served from the seeded WeatherForecast window.
//
// The endpoint is trip-scoped on purpose: the useful question isn't "what's
// the weather in Bangkok" but "what's the sky doing wherever I am on day 4".
// It walks the itinerary to learn which city each day happens in, then joins
// the per-day forecasts. Dates beyond the generated window fall back to the
// monthly climate normals, labeled as such — described climate, not a
// forecast.
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import WeatherForecast from "../models/WeatherForecast.js";
import ClimateNormal from "../models/ClimateNormal.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DAY_MS = 86400000;

function utcDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const getTripWeather = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, user_id: req.user._id });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const items = await ItineraryItem.find({ trip_id: trip._id }).select("day city").lean();
  const numDays = trip.duration_days || 1;

  // Which city each day happens in — the city most of that day's items are
  // in wins. Before an itinerary exists, single-city trips use the
  // destination and country trips the gateway city.
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

  const out = days.map((d) => {
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

  res.json({ days: out });
});
