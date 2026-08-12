import { Router } from "express";
import { getMyNotifications, markAsRead } from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.get("/", getMyNotifications);
router.patch("/:id/read", markAsRead);

export default router;
