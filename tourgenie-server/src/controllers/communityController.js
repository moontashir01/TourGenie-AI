import CommunityPost from "../models/CommunityPost.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-19 — Review & Community: posts
export const createPost = asyncHandler(async (req, res) => {
  const { place, content, photo_url } = req.body;
  if (!place || !content) {
    return res.status(400).json({ message: "place and content are required" });
  }
  const post = await CommunityPost.create({ user_id: req.user._id, place, content, photo_url });
  res.status(201).json({ post });
});

export const getPosts = asyncHandler(async (req, res) => {
  const { place } = req.query;
  const filter = { is_hidden: false };
  if (place && place !== "All places") filter.place = place;

  const posts = await CommunityPost.find(filter)
    .populate("user_id", "name")
    .sort({ created_at: -1 });
  res.json({ posts });
});

export const likePost = asyncHandler(async (req, res) => {
  const post = await CommunityPost.findByIdAndUpdate(
    req.params.id,
    { $inc: { likes: 1 } },
    { new: true }
  );
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json({ post });
});
