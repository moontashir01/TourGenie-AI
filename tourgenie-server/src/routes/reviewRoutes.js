import { Router } from "express";
import { createReview, getReviewsForAttraction } from "../controllers/reviewController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/attraction/:attractionId", getReviewsForAttraction);
router.post("/", protect, createReview);

export default router;
