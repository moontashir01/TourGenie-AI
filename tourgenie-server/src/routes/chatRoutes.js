import { Router } from "express";
import { getQuickActions, getSession, sendMessage } from "../controllers/chatController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/quick-actions", protect, getQuickActions);
router.get("/session", protect, getSession);
router.post("/messages", protect, sendMessage);

export default router;
