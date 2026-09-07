// FR-11 — Weather Forecast, served from the seeded WeatherForecast window.
//
// The endpoint is trip-scoped on purpose: the useful question isn't "what's
// the weather in Bangkok" but "what's the sky doing wherever I am on day 4".
// Day/city/forecast resolution lives in services/tripWeather.js so the
// rainy-day rewriter agrees with this endpoint about which days are wet.
import { resolveTripDays } from "../services/tripWeather.js";
import { planWeatherSwaps } from "../services/weatherRewriter.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findTripForUser, EDIT, VIEW } from "../services/tripAccess.js";

export const getTripWeather = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.params.tripId, req.user._id, { level: VIEW });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const days = await resolveTripDays(trip);
  res.json({ days });
});

// POST /api/trips/:tripId/weather-swap        → preview, changes nothing
// POST /api/trips/:tripId/weather-swap?apply=true → writes the swaps
//
// FR-05's "what if it rains?" without an AI provider: the forecast picks the
// days, `weather_dependent` picks the activities, `is_indoor` picks the
// replacements.
export const swapWeatherDependent = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.params.tripId, req.user._id, { level: EDIT });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const apply = req.query.apply === "true" || req.body?.apply === true;
  const result = await planWeatherSwaps(trip, { apply });
  res.json(result);
});
