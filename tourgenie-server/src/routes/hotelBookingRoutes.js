import { Router } from "express";
import {
  createHotelBooking,
  getTripHotelBookings,
  cancelHotelBooking,
} from "../controllers/hotelBookingController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.post("/", createHotelBooking);
router.get("/trips/:tripId", getTripHotelBookings);
router.patch("/trips/:tripId/:bookingId/cancel", cancelHotelBooking);

export default router;
