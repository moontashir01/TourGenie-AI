import { Router } from "express";
import { getFlights } from "../controllers/flightController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Auth required — flights are only shown to logged-in trip planners
router.get("/", protect, getFlights);

export default router;
