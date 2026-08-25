// FR-18 — Smart Notifications.
//
// Reading your notifications is what runs the rule sweep: there is no cron
// on free-tier hosting, and a trip-planning app does not need one. Anything
// due since the last read is inserted first, then the list is returned.
import Notification from "../models/Notification.js";
import { sweepNotifications } from "../services/notificationEngine.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// A user hammering the bell should not re-run the sweep on every poll. The
// rules are time-based and none of them can change within a minute, so a
// short in-process cooldown costs nothing and bounds the work.
const SWEEP_COOLDOWN_MS = 60_000;
const lastSweep = new Map();

async function maybeSweep(userId, { force = false } = {}) {
  const key = String(userId);
  const previous = lastSweep.get(key) || 0;
  if (!force && Date.now() - previous < SWEEP_COOLDOWN_MS) return 0;
  lastSweep.set(key, Date.now());
  try {
    return await sweepNotifications(userId);
  } catch (err) {
    // A failing rule must not take the notification list down with it.
    console.warn("Notification sweep failed:", err.message);
    return 0;
  }
}

export const getMyNotifications = asyncHandler(async (req, res) => {
  const created = await maybeSweep(req.user._id);

  const filter = { user_id: req.user._id, deliver_at: { $lte: new Date() } };
  if (req.query.unread === "true") filter.is_read = false;

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const [notifications, unread] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).limit(limit).lean(),
    Notification.countDocuments({ user_id: req.user._id, is_read: false, deliver_at: { $lte: new Date() } }),
  ]);

  res.json({ notifications, unread, generated: created });
});

// Cheap enough to poll for the bell badge — no sweep, just a count.
export const getUnreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({
    user_id: req.user._id,
    is_read: false,
    deliver_at: { $lte: new Date() },
  });
  res.json({ unread });
});

// Forces a sweep regardless of the cooldown — used after an action the user
// knows should produce a notification, like confirming a booking.
export const refresh = asyncHandler(async (req, res) => {
  const generated = await maybeSweep(req.user._id, { force: true });
  const unread = await Notification.countDocuments({ user_id: req.user._id, is_read: false });
  res.json({ generated, unread });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id },
    { is_read: true, read_at: new Date() },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ notification });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user_id: req.user._id, is_read: false },
    { is_read: true, read_at: new Date() }
  );
  res.json({ updated: result.modifiedCount });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const removed = await Notification.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
  if (!removed) return res.status(404).json({ message: "Notification not found" });
  res.json({ message: "Notification removed" });
});
