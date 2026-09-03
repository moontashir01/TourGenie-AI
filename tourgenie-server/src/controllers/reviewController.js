import Review from "../models/Review.js";
import AppSetting from "../models/AppSetting.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { screenContent, describeRules } from "../services/moderationRules.js";

// FR-19 — Review & Community: attraction reviews
export const createReview = asyncHandler(async (req, res) => {
  const { attraction_id, rating, comment, photo_url } = req.body;
  if (!attraction_id || !rating || !comment) {
    return res.status(400).json({ message: "attraction_id, rating, and comment are required" });
  }

  // FR-23 — same screening as a community post. A held review is not shown
  // to other travellers and does not move the attraction's average.
  const [priorApproved, requireModeration] = await Promise.all([
    Review.countDocuments({ user_id: req.user._id, moderation_status: "approved" }),
    AppSetting.findOne({ key: "community.require_moderation" }).lean(),
  ]);
  const screen = screenContent({
    text: comment,
    accountAgeMs: Date.now() - new Date(req.user.created_at || 0).getTime(),
    priorApproved,
    force: Boolean(requireModeration?.value),
  });

  const review = await Review.create({
    user_id: req.user._id,
    attraction_id,
    rating,
    comment,
    photo_url,
    moderation_status: screen.status,
  });
  res.status(201).json({
    review,
    held: screen.status === "pending",
    held_because: screen.status === "pending" ? describeRules(screen.matched) : "",
  });
});

export const getReviewsForAttraction = asyncHandler(async (req, res) => {
  const reviews = await Review.find({
    attraction_id: req.params.attractionId,
    is_hidden: false,
    moderation_status: { $ne: "pending" },
  })
    .populate("user_id", "name")
    .sort({ created_at: -1 });
  res.json({ reviews });
});
