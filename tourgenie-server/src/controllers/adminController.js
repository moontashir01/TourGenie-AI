import User from "../models/User.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import TransportOption from "../models/TransportOption.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import AuditLog from "../models/AuditLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseListQuery, paginate } from "../utils/adminList.js";
import { recordAudit, diffFields } from "../services/auditLog.js";
import { deleteAccountAndContent, summariseAccountFootprint } from "../services/accountDeletion.js";
import { ROLES } from "../middleware/auth.js";

// FR-20 — Admin: User Management
export const listUsers = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["name", "email", "phone", "country", "city"],
    allowedSort: ["created_at", "name", "email", "role", "last_login_at"],
  });

  // Filters are additive on top of the search term.
  if (req.query.role && ROLES.includes(req.query.role)) options.filter.role = req.query.role;
  if (req.query.status === "active") options.filter.is_active = true;
  if (req.query.status === "inactive") options.filter.is_active = false;

  const result = await paginate(User, options, (q) => q.select("-password_hash"));
  res.json(result);
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const { is_active, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't change your own account's status" });
  }
  // Losing the last owner locks everyone out of role management for good.
  if (user.role === "owner" && is_active === false && (await lastOwner(user._id))) {
    return res.status(400).json({ message: "This is the only owner — promote someone else first" });
  }

  const was = user.is_active;
  user.is_active = Boolean(is_active);
  await user.save();

  await recordAudit(req, {
    action: is_active ? "user.reactivate" : "user.deactivate",
    entity_type: "User",
    entity_id: user._id,
    entity_label: user.email,
    before: { is_active: was },
    after: { is_active: user.is_active },
    reason,
  });

  res.json({ user: { ...user.toObject(), password_hash: undefined } });
});

/** True when this account is the last active owner. */
async function lastOwner(exceptId) {
  const others = await User.countDocuments({
    role: "owner",
    is_active: true,
    _id: { $ne: exceptId },
  });
  return others === 0;
}

// Promotion and demotion. Owner-only: if any admin could mint admins, one
// compromised admin account multiplies without limit.
export const setUserRole = asyncHandler(async (req, res) => {
  const { role, reason } = req.body;
  if (!ROLES.includes(role)) {
    return res.status(400).json({ message: `Role must be one of: ${ROLES.join(", ")}` });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  // Nobody edits their own role — it blocks both self-promotion and
  // accidentally demoting yourself out of the portal.
  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't change your own role" });
  }
  if (user.role === role) {
    return res.status(400).json({ message: `That account is already ${role}` });
  }
  if (user.role === "owner" && (await lastOwner(user._id))) {
    return res.status(400).json({ message: "This is the only owner — promote someone else first" });
  }

  const was = user.role;
  user.role = role;
  await user.save();

  await recordAudit(req, {
    action: "user.role_change",
    entity_type: "User",
    entity_id: user._id,
    entity_label: user.email,
    before: { role: was },
    after: { role },
    reason,
  });

  res.json({ user: { ...user.toObject(), password_hash: undefined } });
});

// What deleting this account would take with it — the confirmation screen
// asks for this first, because "delete user" reads much smaller than it is.
export const getUserFootprint = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("name email role");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user, footprint: await summariseAccountFootprint(user._id) });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: "You can't delete your own account while logged in as it" });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.role === "owner" && (await lastOwner(user._id))) {
    return res.status(400).json({ message: "This is the only owner — promote someone else first" });
  }

  // Everything the account owns goes with it; the counts are recorded,
  // because "removed 1 user" hides the forty documents that went too.
  const removed = await deleteAccountAndContent(user._id);

  await recordAudit(req, {
    action: "user.delete",
    entity_type: "User",
    entity_id: user._id,
    entity_label: user.email,
    before: { name: user.name, email: user.email, role: user.role },
    after: removed,
    reason: req.body?.reason,
  });

  res.json({ message: "Account and all of its content removed", removed });
});

// Trip oversight — lets admin see all trips across all travelers
export const listTrips = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["destination", "origin", "title"],
    allowedSort: ["created_at", "start_date", "budget", "destination", "status"],
  });
  if (req.query.status) options.filter.status = req.query.status;
  if (req.query.country_code) options.filter.country_code = String(req.query.country_code).toUpperCase();

  const result = await paginate(Trip, options, (q) => q.populate("user_id", "name email"));
  res.json(result);
});

// FR-21 — Admin: Attraction Management
export const createAttraction = asyncHandler(async (req, res) => {
  const attraction = await Attraction.create(req.body);
  await recordAudit(req, {
    action: "attraction.create",
    entity_type: "Attraction",
    entity_id: attraction._id,
    entity_label: attraction.name,
    after: { name: attraction.name, city: attraction.city, entry_fee: attraction.entry_fee },
  });
  res.status(201).json({ attraction });
});

export const updateAttraction = asyncHandler(async (req, res) => {
  const before = await Attraction.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: "Attraction not found" });

  const attraction = await Attraction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  await recordAudit(req, {
    action: "attraction.update",
    entity_type: "Attraction",
    entity_id: attraction._id,
    entity_label: attraction.name,
    ...diffFields(before, attraction.toObject(), Object.keys(req.body || {})),
    reason: req.body?.reason,
  });

  res.json({ attraction });
});

export const deleteAttraction = asyncHandler(async (req, res) => {
  const attraction = await Attraction.findByIdAndDelete(req.params.id);
  if (!attraction) return res.status(404).json({ message: "Attraction not found" });
  await recordAudit(req, {
    action: "attraction.delete",
    entity_type: "Attraction",
    entity_id: attraction._id,
    entity_label: attraction.name,
    before: { name: attraction.name, city: attraction.city },
    reason: req.body?.reason,
  });
  res.json({ message: "Attraction removed" });
});

// FR-22 — Admin: Transport Database
export const listTransportOptions = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["operator", "from_city", "to_city", "service_class"],
    allowedSort: ["created_at", "operator", "from_city", "to_city", "fare"],
    defaultSort: "from_city",
  });
  if (req.query.mode) options.filter.mode = req.query.mode;
  res.json(await paginate(TransportOption, options));
});

export const createTransportOption = asyncHandler(async (req, res) => {
  const option = await TransportOption.create(req.body);
  await recordAudit(req, {
    action: "transport.create",
    entity_type: "TransportOption",
    entity_id: option._id,
    entity_label: `${option.operator} ${option.from_city}→${option.to_city}`,
    after: { operator: option.operator, fare: option.fare, mode: option.mode },
  });
  res.status(201).json({ option });
});

export const updateTransportOption = asyncHandler(async (req, res) => {
  const before = await TransportOption.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: "Transport option not found" });

  const option = await TransportOption.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  await recordAudit(req, {
    action: "transport.update",
    entity_type: "TransportOption",
    entity_id: option._id,
    entity_label: `${option.operator} ${option.from_city}→${option.to_city}`,
    ...diffFields(before, option.toObject(), Object.keys(req.body || {})),
    reason: req.body?.reason,
  });

  res.json({ option });
});

export const deleteTransportOption = asyncHandler(async (req, res) => {
  // A schedule with live bookings against it can't just vanish — the ticket
  // would outlive the journey it describes.
  const held = await Booking.countDocuments({
    transport_id: req.params.id,
    status: { $in: ["pending", "confirmed"] },
  });
  if (held > 0) {
    return res.status(409).json({
      message: `That schedule has ${held} live booking${held > 1 ? "s" : ""}. Deactivate it instead of deleting it.`,
    });
  }

  const option = await TransportOption.findByIdAndDelete(req.params.id);
  if (!option) return res.status(404).json({ message: "Transport option not found" });
  await recordAudit(req, {
    action: "transport.delete",
    entity_type: "TransportOption",
    entity_id: option._id,
    entity_label: `${option.operator} ${option.from_city}→${option.to_city}`,
    before: { operator: option.operator, fare: option.fare },
    reason: req.body?.reason,
  });
  res.json({ message: "Transport option removed" });
});

// FR-07 (admin side) — Hotel Database Management
export const listHotels = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["name", "city", "area"],
    allowedSort: ["created_at", "name", "city", "price_per_night", "rating"],
    defaultSort: "city",
  });
  if (req.query.city) options.filter.city = req.query.city;
  res.json(await paginate(Hotel, options));
});

export const createHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.create(req.body);
  await recordAudit(req, {
    action: "hotel.create",
    entity_type: "Hotel",
    entity_id: hotel._id,
    entity_label: `${hotel.name} (${hotel.city})`,
    after: { name: hotel.name, city: hotel.city, price_per_night: hotel.price_per_night },
  });
  res.status(201).json({ hotel });
});

export const updateHotel = asyncHandler(async (req, res) => {
  const before = await Hotel.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: "Hotel not found" });

  const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  await recordAudit(req, {
    action: "hotel.update",
    entity_type: "Hotel",
    entity_id: hotel._id,
    entity_label: `${hotel.name} (${hotel.city})`,
    ...diffFields(before, hotel.toObject(), Object.keys(req.body || {})),
    reason: req.body?.reason,
  });

  res.json({ hotel });
});

export const deleteHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findByIdAndDelete(req.params.id);
  if (!hotel) return res.status(404).json({ message: "Hotel not found" });
  await recordAudit(req, {
    action: "hotel.delete",
    entity_type: "Hotel",
    entity_id: hotel._id,
    entity_label: `${hotel.name} (${hotel.city})`,
    before: { name: hotel.name, city: hotel.city, price_per_night: hotel.price_per_night },
    reason: req.body?.reason,
  });
  res.json({ message: "Hotel removed" });
});

// FR-23 — Admin: Review Moderation
// Lists ALL posts/reviews (including hidden ones) so the admin has something
// to actually moderate — the public endpoints only show is_hidden: false.
export const listCommunityPosts = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["place", "content"],
    allowedSort: ["created_at", "place", "likes"],
  });
  if (req.query.visibility === "hidden") options.filter.is_hidden = true;
  if (req.query.visibility === "visible") options.filter.is_hidden = false;

  res.json(await paginate(CommunityPost, options, (q) => q.populate("user_id", "name email")));
});

export const listReviews = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["comment"],
    allowedSort: ["created_at", "rating"],
  });
  if (req.query.visibility === "hidden") options.filter.is_hidden = true;
  if (req.query.visibility === "visible") options.filter.is_hidden = false;

  res.json(
    await paginate(Review, options, (q) =>
      q.populate("user_id", "name email").populate("attraction_id", "name city")
    )
  );
});

// action: "hide" | "unhide" | "remove"
export const moderatePost = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const post = await CommunityPost.findById(req.params.id).populate("user_id", "email");
  if (!post) return res.status(404).json({ message: "Post not found" });

  const label = `${post.place}: ${String(post.content).slice(0, 60)}`;

  if (action === "remove") {
    await CommunityPost.deleteOne({ _id: post._id });
    await recordAudit(req, {
      action: "post.remove",
      entity_type: "CommunityPost",
      entity_id: post._id,
      entity_label: label,
      before: { author: post.user_id?.email || "", content: post.content },
      reason,
    });
    return res.json({ message: "Post removed" });
  }

  const hide = action === "hide";
  const was = post.is_hidden;
  post.is_hidden = hide;
  post.moderation_status = hide ? "rejected" : "approved";
  post.moderated_by = req.user._id;
  post.moderated_at = new Date();
  await post.save();

  await recordAudit(req, {
    action: hide ? "post.hide" : "post.unhide",
    entity_type: "CommunityPost",
    entity_id: post._id,
    entity_label: label,
    before: { is_hidden: was },
    after: { is_hidden: hide },
    reason,
  });

  res.json({ post });
});

export const moderateReview = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  const review = await Review.findById(req.params.id).populate("user_id", "email");
  if (!review) return res.status(404).json({ message: "Review not found" });

  const label = `${review.rating}★ ${String(review.comment).slice(0, 60)}`;

  if (action === "remove") {
    await Review.deleteOne({ _id: review._id });
    await recordAudit(req, {
      action: "review.remove",
      entity_type: "Review",
      entity_id: review._id,
      entity_label: label,
      before: { author: review.user_id?.email || "", comment: review.comment },
      reason,
    });
    return res.json({ message: "Review removed" });
  }

  const hide = action === "hide";
  const was = review.is_hidden;
  review.is_hidden = hide;
  await review.save();

  await recordAudit(req, {
    action: hide ? "review.hide" : "review.unhide",
    entity_type: "Review",
    entity_id: review._id,
    entity_label: label,
    before: { is_hidden: was },
    after: { is_hidden: hide },
    reason,
  });

  res.json({ review });
});

// The action trail itself. Read-only by everyone, including owners — an audit
// log an admin can edit is not an audit log.
export const listAuditLogs = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["actor_email", "action", "entity_label"],
    allowedSort: ["created_at", "action", "actor_email"],
  });
  if (req.query.entity_type) options.filter.entity_type = req.query.entity_type;
  if (req.query.action) options.filter.action = req.query.action;
  if (req.query.actor_id) options.filter.actor_id = req.query.actor_id;

  res.json(await paginate(AuditLog, options));
});

// FR-24 — Admin: Analytics Dashboard
//
// The counters stay live; the breakdowns are now grouped in the database
// rather than by downloading every trip and user into the browser to count
// them there, which is what the Overview and Reports tabs used to do.
export const getAnalytics = asyncHandler(async (req, res) => {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 5, 1);
  since.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeTrips,
    totalTrips,
    attractionCount,
    hiddenPosts,
    hiddenReviews,
    bookingCount,
    staffCount,
    tripsByStatus,
    usersByRole,
    topDestinations,
    tripsByMonth,
    budget,
    bookingValue,
  ] = await Promise.all([
    User.countDocuments(),
    Trip.countDocuments({ status: { $in: ["planned", "active"] } }),
    Trip.countDocuments(),
    Attraction.countDocuments(),
    CommunityPost.countDocuments({ is_hidden: true }),
    Review.countDocuments({ is_hidden: true }),
    Booking.countDocuments({ status: "confirmed" }),
    User.countDocuments({ role: { $in: ["moderator", "admin", "owner"] } }),
    Trip.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Trip.aggregate([
      { $group: { _id: "$destination", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Trip.aggregate([
      { $match: { created_at: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Trip.aggregate([{ $group: { _id: null, total: { $sum: "$budget" }, avg: { $avg: "$budget" } } }]),
    Booking.aggregate([
      { $match: { status: { $in: ["pending", "confirmed"] } } },
      { $group: { _id: null, total: { $sum: "$total_fare" } } },
    ]),
  ]);

  const asMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || "unknown", r.count]));

  res.json({
    totalUsers,
    activeTrips,
    totalTrips,
    attractionCount,
    hiddenPosts,
    hiddenReviews,
    bookingCount,
    staffCount,
    pendingModeration: hiddenPosts + hiddenReviews,
    tripsByStatus: asMap(tripsByStatus),
    usersByRole: asMap(usersByRole),
    topDestinations: topDestinations.map((d) => ({ destination: d._id || "—", count: d.count })),
    tripsByMonth: tripsByMonth.map((m) => ({ month: m._id, count: m.count })),
    totalBudget: budget[0]?.total || 0,
    avgBudget: Math.round(budget[0]?.avg || 0),
    bookingValue: bookingValue[0]?.total || 0,
    generated_at: new Date(),
  });
});
