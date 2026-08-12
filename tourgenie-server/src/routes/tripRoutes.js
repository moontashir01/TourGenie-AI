import { Router } from "express";
import { createTrip, getMyTrips, getTripById, updateTrip, deleteTrip } from "../controllers/tripController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.post("/", createTrip);
router.get("/", getMyTrips);
router.get("/:id", getTripById);
router.patch("/:id", updateTrip);
router.delete("/:id", deleteTrip);

export default router;
