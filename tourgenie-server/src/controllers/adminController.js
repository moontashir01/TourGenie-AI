import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Attraction from "../models/Attraction.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import AuditLog from "../models/AuditLog.js";
import Report from "../models/Report.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseListQuery, paginate } from "../utils/adminList.js";
import { recordAudit } from "../services/auditLog.js";
import { maybeRoll, getTrend } from "../services/analyticsRoller.js";
import {
  deleteAccountAndContent,
  summariseAccountFootprint,
  anonymiseAccount,
} from "../services/accountDeletion.js";
import { ROLES } from "../middleware/auth.js";
import { issueReauthToken, REAUTH_TTL_SECONDS } from "../middleware/reauth.js";
import { reauthLimiter } from "../middleware/rateLimit.js";

// FR-20 — Admin: User Management
export const listUsers = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["name", "email", "phone", "country", "city"],
    allowedSort: ["created_at", "name", "email", "role", "last_login_at"],
  });

  // Filters are additive on top of the search term.
  if (req.query.role && ROLES.includes(req.query.role)) options.filter.role = req.query.role;

  // Deleted accounts are hidden unless asked for, which is what makes the
  // delete reversible rather than merely invisible. "Inactive" means
  // deactivated and still there — a deleted account is deactivated too, and
  // listing it under both would make the count of live accounts wrong.
  if (req.query.status === "deleted") {
    options.filter.deleted_at = { $ne: null };
  } else {
    options.filter.deleted_at = null;
    if (req.query.status === "active") options.filter.is_active = true;
    if (req.query.status === "inactive") options.filter.is_active = false;
  }

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
  // Reactivating a deleted account through the status toggle would leave it
  // live and still marked deleted, which is neither state.
  if (user.deleted_at) {
    return res.status(409).json({ message: "That account is deleted — restore it first." });
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

  res.json({ user: publicShape(user) });
});

/** True when this account is the last active owner. */
async function lastOwner(exceptId) {
  const others = await User.countDocuments({
    role: "owner",
    is_active: true,
    deleted_at: null,
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

  res.json({ user: publicShape(user) });
});

// What deleting this account would take with it — the confirmation screen
// asks for this first, because "delete user" reads much smaller than it is.
export const getUserFootprint = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("name email role");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user, footprint: await summariseAccountFootprint(user._id) });
});

/**
 * Soft by default, like the catalogue.
 *
 * Deleting an account used to mean the cascade and nothing else: forty
 * documents gone, no way back, and the wrong answer to the ordinary case of
 * a support mistake or someone who asks to come back next week. The row is
 * now marked and deactivated, and `?hard=true` still runs the real cascade —
 * owner-only, and behind a password confirmation and the account's own email
 * typed out.
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const hard = req.query.hard === "true";

  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: "You can't delete your own account while logged in as it" });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.role === "owner" && (await lastOwner(user._id))) {
    return res.status(400).json({ message: "This is the only owner — promote someone else first" });
  }

  if (!hard) {
    if (user.deleted_at) return res.status(409).json({ message: "That account is already deleted" });

    user.deleted_at = new Date();
    user.deleted_by = req.user._id;
    // Every query that already asks for active accounts — the login path
    // included — treats it as closed from here without knowing about
    // deletion at all.
    user.is_active = false;
    await user.save();

    await recordAudit(req, {
      action: "user.delete",
      entity_type: "User",
      entity_id: user._id,
      entity_label: user.email,
      before: { is_active: true, deleted_at: null },
      after: { is_active: false, deleted_at: user.deleted_at },
      reason: req.body?.reason,
    });

    return res.json({ message: "Account deleted — it can be restored from the Deleted filter", user: publicShape(user) });
  }

  // The floor for the cascade is higher than for the route, because the route
  // also serves the reversible delete.
  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Only an owner can remove an account for good." });
  }

  // Everything the account owns goes with it; the counts are recorded,
  // because "removed 1 user" hides the forty documents that went too.
  const removed = await deleteAccountAndContent(user._id);

  await recordAudit(req, {
    action: "user.hard_delete",
    entity_type: "User",
    entity_id: user._id,
    entity_label: user.email,
    before: { name: user.name, email: user.email, role: user.role },
    after: removed,
    reason: req.body?.reason,
  });

  res.json({ message: "Account and all of its content removed", removed });
});

/**
 * The third option, between deactivating and destroying.
 *
 * A traveller asking to be removed is asking about themselves, not about the
 * 12 trips that make up part of every destination average in the app.
 * Anonymising answers the request without answering it with the analytics:
 * the identity goes, the history stays attached to nobody.
 *
 * Owner-only, password-confirmed and typed out in the UI, because the name
 * cannot be put back — nothing is kept that could.
 */
export const anonymiseUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: "You can't anonymise your own account while logged in as it" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.role === "owner" && (await lastOwner(user._id))) {
    return res.status(400).json({ message: "This is the only owner — promote someone else first" });
  }
  if (user.email.endsWith("@removed.invalid")) {
    return res.status(409).json({ message: "That account is already anonymised" });
  }

  const cleared = await anonymiseAccount(user._id, req.user._id);

  // The audit entry keeps the old address on purpose: it is the only record
  // left that this row was ever that person, and it is what makes the
  // erasure itself auditable.
  await recordAudit(req, {
    action: "user.anonymise",
    entity_type: "User",
    entity_id: user._id,
    entity_label: user.email,
    before: { name: user.name, email: user.email },
    after: cleared,
    reason: req.body?.reason,
  });

  res.json({ message: "Account anonymised — their trips and bookings are kept, their identity is gone", cleared });
});

export const restoreUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!user.deleted_at) return res.status(409).json({ message: "That account isn't deleted" });

  user.deleted_at = null;
  user.deleted_by = null;
  user.is_active = true;
  await user.save();

  await recordAudit(req, {
    action: "user.restore",
    entity_type: "User",
    entity_id: user._id,
    entity_label: user.email,
    after: { is_active: true },
    reason: req.body?.reason,
  });

  res.json({ message: "Account restored", user: publicShape(user) });
});

/** The user document minus the hash, which the three handlers above return. */
function publicShape(user) {
  return { ...user.toObject(), password_hash: undefined };
}

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

// FR-21/22 and the hotel catalogue now live in adminCatalogueController.js,
// which gives all seven collections the same paging, soft delete, referential
// guards and audit trail instead of three of them having their own.

// FR-23 — moderation moved to adminModerationController.js when it grew a
// queue, traveller reports and an approve action; the two list endpoints
// went with it so all of moderation reads as one thing.

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

  // Reading the dashboard is what keeps the snapshots current — the same
  // trick notificationController uses for the rule sweep, because there is
  // no cron on free-tier hosting. Not awaited: the tiles below are live
  // counts and must not wait on the roll-up behind them.
  maybeRoll();

  const [
    totalUsers,
    activeTrips,
    totalTrips,
    attractionCount,
    hiddenPosts,
    hiddenReviews,
    pendingPosts,
    pendingReviews,
    openReports,
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
    CommunityPost.countDocuments({ moderation_status: "pending" }),
    Review.countDocuments({ moderation_status: "pending" }),
    Report.countDocuments({ status: "open" }),
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
    pendingPosts,
    pendingReviews,
    openReports,
    // What the queue actually owes an answer to. It used to count hidden
    // content — work already done — which read as a backlog that never
    // cleared no matter how much moderating happened.
    pendingModeration: pendingPosts + pendingReviews + openReports,
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

// FR-24 — the time series, from AnalyticsSnapshot rather than re-aggregating
// every collection per point. The snapshots were modelled and seeded from the
// start and nothing read them; this is the reader.
//
// The answer says when each period was computed, because a chart that doesn't
// admit its own staleness is worse than no chart.
export const getAnalyticsTrends = asyncHandler(async (req, res) => {
  await maybeRoll();

  const period = req.query.period === "month" ? "month" : "day";
  const limit = Number(req.query.limit) || (period === "month" ? 12 : 30);
  const snapshots = await getTrend({ period, limit });

  res.json({
    period,
    points: snapshots.map((snapshot) => ({
      key: snapshot.period_key,
      date: snapshot.date,
      computed_at: snapshot.computed_at,
      ...snapshot.metrics,
    })),
    // Today and this month are still being written to; everything before
    // them is final. The client labels the last point accordingly.
    latest_is_partial: snapshots.length > 0,
    top_destinations: snapshots.at(-1)?.top_destinations || [],
    top_interests: snapshots.at(-1)?.top_interests || [],
  });
});

// The password prompt behind role changes, account deletion and any export
// carrying email addresses. Hands back a two-minute confirmation the client
// attaches to that one request; see middleware/reauth.js for why it is a
// token and not the password again.
export const confirmPassword = asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ message: "Enter your password to confirm." });

  // `password_hash` is select:false on the model, so it has to be asked for.
  const me = await User.findById(req.user._id).select("+password_hash");
  if (!me) return res.status(404).json({ message: "Account not found" });

  if (!(await bcrypt.compare(password, me.password_hash))) {
    // Only wrong answers are counted, so an admin working through six
    // deletions in a row never meets the limit.
    reauthLimiter.penalise(req);
    // A wrong password on a privileged prompt is worth recording: it is what
    // a session someone else is holding looks like from the server's side.
    await recordAudit(req, {
      action: "admin.reauth_failed",
      entity_type: "User",
      entity_id: me._id,
      entity_label: me.email,
    });
    // 403, not 401 — a 401 on a request carrying a token ends the session,
    // and a typo shouldn't log an admin out.
    return res.status(403).json({ message: "That password is not right.", code: "reauth_failed" });
  }

  res.json({ reauth_token: issueReauthToken(me), expires_in: REAUTH_TTL_SECONDS });
});
