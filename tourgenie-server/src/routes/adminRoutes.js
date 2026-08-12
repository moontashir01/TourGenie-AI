import { Router } from "express";
import {
  listUsers,
  setUserStatus,
  deleteUser,
  listTrips,
  createAttraction,
  updateAttraction,
  deleteAttraction,
  listHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  createTransportOption,
  updateTransportOption,
  deleteTransportOption,
  listCommunityPosts,
  moderatePost,
  listReviews,
  moderateReview,
  getAnalytics,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();
router.use(protect, adminOnly);

// FR-20
router.get("/users", listUsers);
router.patch("/users/:id/status", setUserStatus);
router.delete("/users/:id", deleteUser);

// Trip oversight
router.get("/trips", listTrips);

// FR-21
router.post("/attractions", createAttraction);
router.patch("/attractions/:id", updateAttraction);
router.delete("/attractions/:id", deleteAttraction);

// FR-07 (admin) — Hotel management
router.get("/hotels", listHotels);
router.post("/hotels", createHotel);
router.patch("/hotels/:id", updateHotel);
router.delete("/hotels/:id", deleteHotel);

// FR-22
router.post("/transport", createTransportOption);
router.patch("/transport/:id", updateTransportOption);
router.delete("/transport/:id", deleteTransportOption);

// FR-23
router.get("/community-posts", listCommunityPosts);
router.patch("/community-posts/:id/moderate", moderatePost);
router.get("/reviews", listReviews);
router.patch("/reviews/:id/moderate", moderateReview);

// FR-24
router.get("/analytics", getAnalytics);

export default router;
