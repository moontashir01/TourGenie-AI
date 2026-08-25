import { Router } from "express";
import { getTripJourney } from "../controllers/routeController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Mounted at the bare "/api" prefix — protect is per-route so unmatched
// /api/* requests falling through don't hit an auth wall (see weatherRoutes).
router.get("/trips/:tripId/route", protect, getTripJourney);

export default router;
