import { Router } from "express";
import { createTrip, estimateTrip, getMyTrips, getTripById, updateTrip, deleteTrip } from "../controllers/tripController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.post("/estimate", estimateTrip); // live cost preview on the Plan a trip form
router.post("/", createTrip);
router.get("/", getMyTrips);
router.get("/:id", getTripById);
router.patch("/:id", updateTrip);
router.delete("/:id", deleteTrip);

export default router;
