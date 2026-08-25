import { Router } from "express";
import {
  getMyNotifications,
  getUnreadCount,
  refresh,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

// Static paths before "/:id" so they aren't swallowed as ids.
router.get("/unread-count", getUnreadCount);
router.post("/refresh", refresh);
router.patch("/read-all", markAllAsRead);

router.get("/", getMyNotifications);
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;
