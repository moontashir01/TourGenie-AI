import User from "../models/User.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import TransportOption from "../models/TransportOption.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-20 — Admin: User Management
export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ created_at: -1 });
  res.json({ users });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const { is_active } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { is_active }, { new: true });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: "You can't delete your own account while logged in as it" });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ message: "User removed" });
});

// Trip oversight — lets admin see all trips across all travelers
export const listTrips = asyncHandler(async (req, res) => {
  const trips = await Trip.find().populate("user_id", "name email").sort({ created_at: -1 });
  res.json({ trips });
});

// FR-21 — Admin: Attraction Management
export const createAttraction = asyncHandler(async (req, res) => {
  const attraction = await Attraction.create(req.body);
  res.status(201).json({ attraction });
});

export const updateAttraction = asyncHandler(async (req, res) => {
  const attraction = await Attraction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!attraction) return res.status(404).json({ message: "Attraction not found" });
  res.json({ attraction });
});

export const deleteAttraction = asyncHandler(async (req, res) => {
  const attraction = await Attraction.findByIdAndDelete(req.params.id);
  if (!attraction) return res.status(404).json({ message: "Attraction not found" });
  res.json({ message: "Attraction removed" });
});

// FR-22 — Admin: Transport Database
export const createTransportOption = asyncHandler(async (req, res) => {
  const option = await TransportOption.create(req.body);
  res.status(201).json({ option });
});

export const updateTransportOption = asyncHandler(async (req, res) => {
  const option = await TransportOption.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!option) return res.status(404).json({ message: "Transport option not found" });
  res.json({ option });
});

export const deleteTransportOption = asyncHandler(async (req, res) => {
  const option = await TransportOption.findByIdAndDelete(req.params.id);
  if (!option) return res.status(404).json({ message: "Transport option not found" });
  res.json({ message: "Transport option removed" });
});

// FR-07 (admin side) — Hotel Database Management
// The public GET /api/hotels endpoint is read-only and city-scoped; these
// give the admin full CRUD over the Hotel collection, mirroring the
// attraction and transport management above.
export const listHotels = asyncHandler(async (req, res) => {
  const hotels = await Hotel.find().sort({ city: 1, name: 1 });
  res.json({ hotels });
});

export const createHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.create(req.body);
  res.status(201).json({ hotel });
});

export const updateHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!hotel) return res.status(404).json({ message: "Hotel not found" });
  res.json({ hotel });
});

export const deleteHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findByIdAndDelete(req.params.id);
  if (!hotel) return res.status(404).json({ message: "Hotel not found" });
  res.json({ message: "Hotel removed" });
});

// FR-23 — Admin: Review Moderation
// Lists ALL posts/reviews (including hidden ones) so the admin has
// something to actually moderate — the public endpoints only show
// is_hidden: false.
export const listCommunityPosts = asyncHandler(async (req, res) => {
  const posts = await CommunityPost.find().populate("user_id", "name email").sort({ created_at: -1 });
  res.json({ posts });
});

export const listReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate("user_id", "name email")
    .populate("attraction_id", "name city")
    .sort({ created_at: -1 });
  res.json({ reviews });
});

// action: "hide" | "unhide" | "remove"
export const moderatePost = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (action === "remove") {
    const deleted = await CommunityPost.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Post not found" });
    return res.json({ message: "Post removed" });
  }
  const post = await CommunityPost.findByIdAndUpdate(
    req.params.id,
    { is_hidden: action === "hide" },
    { new: true }
  );
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json({ post });
});

export const moderateReview = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (action === "remove") {
    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Review not found" });
    return res.json({ message: "Review removed" });
  }
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { is_hidden: action === "hide" },
    { new: true }
  );
  if (!review) return res.status(404).json({ message: "Review not found" });
  res.json({ review });
});

// FR-24 — Admin: Analytics Dashboard
export const getAnalytics = asyncHandler(async (req, res) => {
  const [totalUsers, activeTrips, totalTrips, attractionCount, hiddenPosts, hiddenReviews, bookingCount] =
    await Promise.all([
      User.countDocuments(),
      Trip.countDocuments({ status: { $in: ["planned", "active"] } }),
      Trip.countDocuments(),
      Attraction.countDocuments(),
      CommunityPost.countDocuments({ is_hidden: true }),
      Review.countDocuments({ is_hidden: true }),
      Booking.countDocuments({ status: "confirmed" }),
    ]);

  res.json({
    totalUsers,
    activeTrips,
    totalTrips,
    attractionCount,
    hiddenPosts,
    hiddenReviews,
    bookingCount,
  });
});
