// FR-19 — Review & Community, the feed side. Proposal fields (§4.1.11)
// unchanged; `is_hidden` was already in use for moderation (FR-23), and the
// additions cover multi-photo posts, replies, and the like ledger that stops
// one user liking a post twice.
import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    user_name: { type: String, default: "" },
    content: { type: String, required: true },
    is_hidden: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const communityPostSchema = new mongoose.Schema({
  // — proposal §4.1.11 —
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  place: { type: String, required: true },
  content: { type: String, required: true },
  photo_url: { type: String, default: null },
  likes: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },

  // — already in use by the app —
  is_hidden: { type: Boolean, default: false },

  // — additive —
  destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
  rating: { type: Number, min: 1, max: 5, default: null },
  photo_urls: { type: [String], default: [] }, // multi-photo posts
  tags: { type: [String], default: [] },
  // Who liked it — the counter above stays for the proposal's schema, this
  // is what makes the toggle idempotent.
  liked_by: { type: [mongoose.Schema.Types.ObjectId], default: [], ref: "User" },
  replies: { type: [replySchema], default: [] },
  reply_count: { type: Number, default: 0 },
  moderation_status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved",
  },
  moderated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  moderated_at: { type: Date, default: null },
  is_pinned: { type: Boolean, default: false }, // "Top Travel Tips" sidebar
});

communityPostSchema.index({ created_at: -1 });
communityPostSchema.index({ place: 1, is_hidden: 1, created_at: -1 });
communityPostSchema.index({ user_id: 1 });
communityPostSchema.index({ moderation_status: 1 });

export default mongoose.model("CommunityPost", communityPostSchema);
