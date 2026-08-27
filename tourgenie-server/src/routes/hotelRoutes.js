import { Router } from "express";
import { getHotels, selectHotelForTrip } from "../controllers/hotelController.js";
import { getHotelAvailability } from "../controllers/hotelBookingController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", getHotels);
// Public, like the hotel catalogue — room availability is not user data.
router.get("/:id/availability", getHotelAvailability);
router.post("/:id/select", protect, selectHotelForTrip);

export default router;
