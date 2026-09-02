import CommunityPost from "../models/CommunityPost.js";
import Destination from "../models/Destination.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// A post is filed under a place, and the feed can only be filtered by places
// it knows about — so the list of places has to be the real catalogue, not a
// hand-written handful. The client used to carry three names in a constant
// while the database held 27 destinations: anything posted about the other
// 24 could never be filtered back out again.
export const getPlaces = asyncHandler(async (req, res) => {
  const [destinations, used] = await Promise.all([
    Destination.find({ is_active: true }).select("name country_code").sort({ name: 1 }).lean(),
    // Places already posted about that are no longer in the catalogue — a
    // renamed or retired destination shouldn't hide its own posts.
    CommunityPost.distinct("place", { is_hidden: false }),
  ]);

  const names = new Set(destinations.map((d) => d.name));
  const extras = used.filter((place) => place && !names.has(place)).sort();

  res.json({ places: [...destinations.map((d) => d.name), ...extras] });
});

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
