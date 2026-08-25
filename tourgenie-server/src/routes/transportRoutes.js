import { Router } from "express";
import { getTransportOptions } from "../controllers/transportController.js";
import { getSeatAvailability } from "../controllers/bookingController.js";

const router = Router();

router.get("/", getTransportOptions);
// Public: the seat map is catalogue data, not user data.
router.get("/:id/availability", getSeatAvailability);

export default router;
