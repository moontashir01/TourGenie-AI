import { Router } from "express";
import { createPost, getPosts, likePost } from "../controllers/communityController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", getPosts);
router.post("/", protect, createPost);
router.post("/:id/like", protect, likePost);

export default router;
