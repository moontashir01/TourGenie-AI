import { Router } from "express";
import { getTripWeather, swapWeatherDependent } from "../controllers/weatherController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Mounted at the bare "/api" prefix — protect is per-route so unmatched
// /api/* requests falling through don't get an auth wall (see itineraryRoutes).
router.get("/trips/:tripId/weather", protect, getTripWeather);
router.post("/trips/:tripId/weather-swap", protect, swapWeatherDependent);

export default router;
