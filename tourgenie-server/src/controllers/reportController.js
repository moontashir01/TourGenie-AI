// FR-19 / FR-23 — the traveller's half of moderation.
//
// There was no route from "this post is abusive" to a moderator seeing it.
// This is it: one endpoint, one report per person per thing, and a threshold
// at which the content stops waiting for a human before it comes off the feed.
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import Report, { REPORT_REASONS, REPORT_TARGETS } from "../models/Report.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// How many separate people have to report something before it is pulled from
// the feed pending review. One is too few — it hands any account a veto over
// anyone else's writing. Two still moves fast on a community this size, and a
// moderator sees every report either way.
const AUTO_PENDING_AT = 2;

const MODELS = { CommunityPost, Review };

/** The line the queue shows for a report, kept as text so it outlives the target. */
function labelFor(target_type, doc) {
  if (target_type === "CommunityPost") return `${doc.place}: ${String(doc.content).slice(0, 80)}`;
  return `${doc.rating}★ ${String(doc.comment).slice(0, 80)}`;
}

export const createReport = asyncHandler(async (req, res) => {
  const { target_type, target_id, reason = "other", details = "" } = req.body;

  if (!REPORT_TARGETS.includes(target_type) || !target_id) {
    return res.status(400).json({ message: "Tell us what you're reporting — a post or a review." });
  }
  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ message: `Reason must be one of: ${REPORT_REASONS.join(", ")}` });
  }

  const target = await MODELS[target_type].findById(target_id);
  if (!target) return res.status(404).json({ message: "That post or review no longer exists." });

  if (String(target.user_id) === String(req.user._id)) {
    return res.status(400).json({ message: "That's your own post — you can delete it instead of reporting it." });
  }

  let report;
  try {
    report = await Report.create({
      reporter_id: req.user._id,
      reporter_email: req.user.email,
      target_type,
      target_id: target._id,
      target_label: labelFor(target_type, target),
      target_author_id: target.user_id,
      reason,
      details: String(details).slice(0, 1000),
    });
  } catch (err) {
    // The unique index is the authority on "one report per person per thing";
    // the pre-check would race two taps on a slow connection.
    if (err.code === 11000) {
      return res.status(409).json({ message: "You've already reported this — a moderator will look at it." });
    }
    throw err;
  }

  // Enough separate people have objected: take it off the feed and let a
  // moderator decide. The author still sees their own post, marked as held.
  const openReports = await Report.countDocuments({
    target_type,
    target_id: target._id,
    status: "open",
  });
  if (openReports >= AUTO_PENDING_AT && target.moderation_status === "approved") {
    target.moderation_status = "pending";
    await target.save();
  }

  res.status(201).json({
    report: { _id: report._id, status: report.status, created_at: report.created_at },
    message: "Thanks — a moderator will take a look.",
  });
});

/** What this traveller has already reported, so the button can say so. */
export const listMyReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ reporter_id: req.user._id })
    .select("target_type target_id reason status created_at")
    .sort({ created_at: -1 })
    .limit(100)
    .lean();
  res.json({ reports });
});
