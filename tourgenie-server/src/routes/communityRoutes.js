import { Router } from "express";
import { createPost, getPosts, likePost, getPlaces } from "../controllers/communityController.js";
import { protect, optionalAuth } from "../middleware/auth.js";

const router = Router();

// The places a post can be filed under, from the destination catalogue.
router.get("/places", getPlaces);
// Readable logged out; a token, when there is one, marks your own likes.
router.get("/", optionalAuth, getPosts);
router.post("/", protect, createPost);
router.post("/:id/like", protect, likePost);

export default router;
