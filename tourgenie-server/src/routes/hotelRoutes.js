import { Router } from "express";
import { getHotels, selectHotelForTrip } from "../controllers/hotelController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", getHotels);
router.post("/:id/select", protect, selectHotelForTrip);

export default router;
