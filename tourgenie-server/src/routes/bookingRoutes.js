import { Router } from "express";
import { createBooking, getTripBookings, cancelBooking } from "../controllers/bookingController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.post("/", createBooking);
router.get("/trips/:tripId", getTripBookings);
router.patch("/trips/:tripId/:bookingId/cancel", cancelBooking);

export default router;
