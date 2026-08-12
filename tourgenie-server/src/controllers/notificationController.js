import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-18 — Smart Notifications
export const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user_id: req.user._id }).sort({ created_at: -1 });
  res.json({ notifications });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id },
    { is_read: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ notification });
});
