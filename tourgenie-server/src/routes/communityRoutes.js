import { Router } from "express";
import { createPost, getPosts, likePost, getPlaces } from "../controllers/communityController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// The places a post can be filed under, from the destination catalogue.
router.get("/places", getPlaces);
router.get("/", getPosts);
router.post("/", protect, createPost);
router.post("/:id/like", protect, likePost);

export default router;
