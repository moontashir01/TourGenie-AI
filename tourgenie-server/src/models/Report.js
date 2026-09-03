// FR-19 / FR-23 — a traveller flagging someone else's writing.
//
// Until now there was no route at all from "this post is abusive" to a
// moderator seeing it: moderation was an admin scrolling the feed and
// noticing. A report is the other half of that — it puts the post in a queue
// with a stated reason and a person to answer to.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

// Why the reporter says it should come down. Free text is kept separately —
// the category is what the queue filters and counts by.
export const REPORT_REASONS = ["spam", "abuse", "misinformation", "off_topic", "unsafe", "other"];
export const REPORT_TARGETS = ["CommunityPost", "Review"];

const reportSchema = new mongoose.Schema(
  {
    reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Kept as text so the row still reads sensibly once the account is gone.
    reporter_email: { type: String, default: "" },

    target_type: { type: String, enum: REPORT_TARGETS, required: true },
    target_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Same reasoning as AuditLog.entity_label: the queue has to describe what
    // was reported even after a moderator removes it.
    target_label: { type: String, default: "" },
    target_author_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    reason: { type: String, enum: REPORT_REASONS, default: "other" },
    details: { type: String, default: "", maxlength: 1000 },

    // open → the queue owes someone an answer.
    status: { type: String, enum: ["open", "actioned", "dismissed"], default: "open" },
    resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolved_at: { type: Date, default: null },
    // What the moderator did, in their words.
    resolution: { type: String, default: "" },
  },
  TIMESTAMPS
);

// One report per person per thing. Someone who dislikes a post can say so
// once; ten reports from one account must not look like ten complaints.
reportSchema.index({ reporter_id: 1, target_type: 1, target_id: 1 }, { unique: true });
reportSchema.index({ status: 1, created_at: 1 }); // the queue: oldest first
reportSchema.index({ target_type: 1, target_id: 1 });

export default mongoose.model("Report", reportSchema);
