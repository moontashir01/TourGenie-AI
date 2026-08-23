import { Router } from "express";
import { getPackingList, generatePackingList, togglePackingItem } from "../controllers/packingController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Mounted at the bare "/api" prefix — protect per route (see itineraryRoutes).
router.get("/trips/:tripId/packing-list", protect, getPackingList);
router.post("/trips/:tripId/packing-list/generate", protect, generatePackingList);
router.patch("/trips/:tripId/packing-list/items", protect, togglePackingItem);

export default router;
