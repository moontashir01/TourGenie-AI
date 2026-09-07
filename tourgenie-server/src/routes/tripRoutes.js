import { Router } from "express";
import {
  createTrip,
  estimateTrip,
  getMyTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  confirmTrip,
  getTripCities,
} from "../controllers/tripController.js";
import { protect } from "../middleware/auth.js";
import { tripConfirmLimiter } from "../middleware/rateLimit.js";

const router = Router();
router.use(protect);

router.post("/estimate", estimateTrip); // live cost preview on the Plan a trip form
router.post("/", createTrip);
// FR-03 — explicit confirmation; sends the plan as a PDF by email.
router.post("/:id/confirm", tripConfirmLimiter, confirmTrip);
router.get("/", getMyTrips);
// FR-07 x FR-12 — the cities this trip covers, so Hotels and Attractions
// stop listing the whole country.
router.get("/:id/cities", getTripCities);
router.get("/:id", getTripById);
router.patch("/:id", updateTrip);
router.delete("/:id", deleteTrip);

export default router;
