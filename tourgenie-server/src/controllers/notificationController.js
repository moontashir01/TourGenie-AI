// FR-18 — Smart Notifications.
//
// Reading your notifications is what runs the rule sweep: there is no cron
// on free-tier hosting, and a trip-planning app does not need one.
//
// The badge poll sweeps too, on a longer cooldown. It didn't, and that made
// the count structurally stale: the only thing that created rows was opening
// the panel, so a notification could never appear *before* you had already
// looked. A traveller three hours from departure saw a zero until they
// clicked the bell that was supposed to be telling them.
import Notification from "../models/Notification.js";
import { sweepNotifications } from "../services/notificationEngine.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DAY_MS = 86400000;

// A user hammering the bell should not re-run the sweep on every poll. The
// rules are time-based and none of them can change within a minute.
const READ_COOLDOWN_MS = 60_000;
// The badge polls every 90s in the client, so this is the real bound on
// background work: at most one sweep per user per ten minutes, which is well
// inside the tightest rule (a 3-hour departure warning).
const BADGE_COOLDOWN_MS = 10 * 60_000;

const lastSweep = new Map();
// The map is per-process and only ever grew. Nothing here is worth keeping
// once it is older than the longest cooldown — a missing entry just means
// the next request sweeps, which is the safe direction to be wrong in.
const SWEEP_ENTRY_TTL_MS = 60 * 60_000;
let lastEviction = 0;

function evictStaleSweeps(now) {
  if (now - lastEviction < SWEEP_ENTRY_TTL_MS) return;
  lastEviction = now;
  for (const [key, at] of lastSweep) {
    if (now - at > SWEEP_ENTRY_TTL_MS) lastSweep.delete(key);
  }
}

async function maybeSweep(userId, { force = false, cooldown = READ_COOLDOWN_MS } = {}) {
  const now = Date.now();
  evictStaleSweeps(now);

  const key = String(userId);
  const previous = lastSweep.get(key) || 0;
  if (!force && now - previous < cooldown) return 0;
  lastSweep.set(key, now);
  try {
    return await sweepNotifications(userId);
  } catch (err) {
    // A failing rule must not take the notification list down with it.
    console.warn("Notification sweep failed:", err.message);
    return 0;
  }
}

// Everything the traveller can currently see: delivered, not expired.
function visibleFilter(userId) {
  return { user_id: userId, deliver_at: { $lte: new Date() } };
}

export const getMyNotifications = asyncHandler(async (req, res) => {
  const created = await maybeSweep(req.user._id);

  const filter = visibleFilter(req.user._id);
  if (req.query.unread === "true") filter.is_read = false;
  if (req.query.type) filter.type = req.query.type;

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const [notifications, unread] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).limit(limit).lean(),
    Notification.countDocuments({ ...visibleFilter(req.user._id), is_read: false }),
  ]);

  res.json({ notifications, unread, generated: created });
});

// Polled for the bell badge. Sweeps on the long cooldown so a notification
// that comes due while the app is open actually reaches the badge.
export const getUnreadCount = asyncHandler(async (req, res) => {
  await maybeSweep(req.user._id, { cooldown: BADGE_COOLDOWN_MS });
  const unread = await Notification.countDocuments({ ...visibleFilter(req.user._id), is_read: false });
  res.json({ unread });
});

// Forces a sweep regardless of the cooldown — used after an action the user
// knows should produce a notification, like confirming a booking.
export const refresh = asyncHandler(async (req, res) => {
  const generated = await maybeSweep(req.user._id, { force: true });
  const unread = await Notification.countDocuments({ ...visibleFilter(req.user._id), is_read: false });
  res.json({ generated, unread });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id },
    // Reading it starts the shorter retention clock; see the model.
    { is_read: true, read_at: new Date(), expires_at: new Date(Date.now() + 30 * DAY_MS) },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ notification });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  // Scoped to what is actually on screen. Without the deliver_at bound this
  // marked scheduled notifications read before they had ever been shown, so
  // next Tuesday's storm warning arrived pre-dismissed.
  const result = await Notification.updateMany(
    { ...visibleFilter(req.user._id), is_read: false },
    { is_read: true, read_at: new Date(), expires_at: new Date(Date.now() + 30 * DAY_MS) }
  );
  res.json({ updated: result.modifiedCount });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const removed = await Notification.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
  if (!removed) return res.status(404).json({ message: "Notification not found" });
  res.json({ message: "Notification removed" });
});

// Clearing the lot. The rows are regenerated by the next sweep if their
// trigger still holds, which is the right behaviour: dismissing "you are 90%
// through your budget" should not hide it while it is still true — it comes
// back, rather than the app quietly dropping a warning.
export const clearRead = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({ user_id: req.user._id, is_read: true });
  res.json({ removed: result.deletedCount });
});
