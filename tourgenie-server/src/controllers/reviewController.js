import Review from "../models/Review.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-19 — Review & Community: attraction reviews
export const createReview = asyncHandler(async (req, res) => {
  const { attraction_id, rating, comment, photo_url } = req.body;
  if (!attraction_id || !rating || !comment) {
    return res.status(400).json({ message: "attraction_id, rating, and comment are required" });
  }
  const review = await Review.create({
    user_id: req.user._id,
    attraction_id,
    rating,
    comment,
    photo_url,
  });
  res.status(201).json({ review });
});

export const getReviewsForAttraction = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ attraction_id: req.params.attractionId, is_hidden: false })
    .populate("user_id", "name")
    .sort({ created_at: -1 });
  res.json({ reviews });
});
