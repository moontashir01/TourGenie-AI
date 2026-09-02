import CommunityPost from "../models/CommunityPost.js";
import Destination from "../models/Destination.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// A post is filed under a place, and the feed can only be filtered by places
// it knows about — so the list of places has to be the real catalogue, not a
// hand-written handful. The client used to carry three names in a constant
// while the database held 27 destinations: anything posted about the other
// 24 could never be filtered back out again.
// Grouped by country, because a flat run of 25 names gives no clue that the
// list is two destinations countries rather than one long alphabet — Chiang
// Mai lands between Chattogram and Cox's Bazar.
export const getPlaces = asyncHandler(async (req, res) => {
  const [destinations, used] = await Promise.all([
    Destination.find({ is_active: true }).select("name country country_code").sort({ name: 1 }).lean(),
    // Places already posted about that are no longer in the catalogue — a
    // renamed or retired destination shouldn't hide its own posts.
    CommunityPost.distinct("place", { is_hidden: false }),
  ]);

  const byCountry = new Map();
  for (const destination of destinations) {
    const code = destination.country_code || "";
    if (!byCountry.has(code)) {
      byCountry.set(code, { country: destination.country || "Elsewhere", country_code: code, places: [] });
    }
    byCountry.get(code).places.push(destination.name);
  }

  // Home country first, then the rest alphabetically — the feed is mostly
  // Bangladeshi travel and burying it under "Elsewhere" would read oddly.
  const groups = [...byCountry.values()].sort((a, b) => {
    if (a.country_code === "BD") return -1;
    if (b.country_code === "BD") return 1;
    return a.country.localeCompare(b.country);
  });

  const known = new Set(destinations.map((d) => d.name));
  const extras = used.filter((place) => place && !known.has(place)).sort();
  if (extras.length) groups.push({ country: "Other places", country_code: "", places: extras });

  res.json({
    groups,
    // The flat list stays: it is what the post form and the filter fall back
    // to, and what the endpoint answered before it grouped anything.
    places: groups.flatMap((group) => group.places),
  });
});

// One post's shape for the feed. `liked` is per-viewer, so it is only
// meaningful when the request carried a token — logged out, it is false and
// the button prompts a login.
function shapePost(post, userId) {
  const likedBy = post.liked_by || [];
  return {
    ...post,
    // The ledger of who liked it is nobody else's business; the viewer only
    // needs to know about their own like.
    liked_by: undefined,
    likes: post.likes || 0,
    liked: Boolean(userId) && likedBy.some((id) => String(id) === String(userId)),
  };
}

// FR-19 — Review & Community: posts
export const createPost = asyncHandler(async (req, res) => {
  const { place, content, photo_url } = req.body;
  if (!place || !content) {
    return res.status(400).json({ message: "place and content are required" });
  }
  const post = await CommunityPost.create({
    user_id: req.user._id,
    place: String(place).trim(),
    content: String(content).trim(),
    photo_url,
  });
  const populated = await CommunityPost.findById(post._id).populate("user_id", "name").lean();
  res.status(201).json({ post: shapePost(populated, req.user._id) });
});

export const getPosts = asyncHandler(async (req, res) => {
  const { place } = req.query;
  const filter = { is_hidden: false };
  if (place && place !== "All places") filter.place = place;

  const posts = await CommunityPost.find(filter)
    .populate("user_id", "name")
    .sort({ created_at: -1 })
    .lean();

  res.json({ posts: posts.map((post) => shapePost(post, req.user?._id)) });
});

// A like is a toggle, not a tally. It used to be a bare increment: the same
// person could add to a post's count forever and never take it back — and no
// button in the app ever called it.
export const likePost = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const post = await CommunityPost.findById(req.params.id);
  if (!post || post.is_hidden) return res.status(404).json({ message: "Post not found" });

  const alreadyLiked = (post.liked_by || []).some((id) => String(id) === String(userId));

  // The count is recomputed from the ledger rather than nudged up and down,
  // so it can't drift away from the list of people it is supposed to describe.
  const updated = await CommunityPost.findOneAndUpdate(
    { _id: post._id },
    alreadyLiked ? { $pull: { liked_by: userId } } : { $addToSet: { liked_by: userId } },
    { new: true }
  );
  updated.likes = (updated.liked_by || []).length;
  await updated.save();

  res.json({ liked: !alreadyLiked, likes: updated.likes });
});
