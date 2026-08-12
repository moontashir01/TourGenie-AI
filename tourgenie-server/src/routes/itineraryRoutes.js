import { Router } from "express";
import {
  generateAIItinerary,
  generateItinerary,
  getItinerary,
  updateItineraryItem,
  deleteItineraryItem,
  selectTransportOption,
} from "../controllers/itineraryController.js";
import { protect } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

// protect is applied per-route (not via router.use) because this router is
// mounted at the bare "/api" prefix in server.js — a blanket router.use(protect)
// here would run for every "/api/*" request that falls through unmatched from
// earlier routers, incorrectly requiring login for unrelated public endpoints
// like /api/hotels.
router.post("/trips/:tripId/itinerary/generate", protect, generateAIItinerary);
router.post("/trips/:tripId/itinerary", protect, generateItinerary);
router.get("/trips/:tripId/itinerary", protect, getItinerary);
router.patch("/trips/:tripId/itinerary/:itemId", protect, updateItineraryItem);
router.delete("/trips/:tripId/itinerary/:itemId", protect, deleteItineraryItem);
router.put("/trips/:tripId/itinerary/:itemId/transport", protect, selectTransportOption);

export default router;
