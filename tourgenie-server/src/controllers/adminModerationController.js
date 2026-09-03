// FR-23 — moderation, as a queue rather than a scroll.
//
// Phase 3 left moderation reactive: two lists of everything ever posted, and
// a moderator noticing something bad by reading them. This adds the missing
// half — content held by the rules in services/moderationRules.js, content
// reported by travellers, and one place that shows both oldest-first with the
// reason attached.
//
// Every action here also closes the reports that asked for it, so a report is
// never answered twice and the queue empties as work is done.
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import Report, { REPORT_REASONS, REPORT_TARGETS } from "../models/Report.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseListQuery, paginate } from "../utils/adminList.js";
import { recordAudit } from "../services/auditLog.js";

const MODELS = { CommunityPost, Review };

const postLabel = (post) => `${post.place}: ${String(post.content).slice(0, 60)}`;
const reviewLabel = (review) => `${review.rating}★ ${String(review.comment).slice(0, 60)}`;

/**
 * Closes every open report against one piece of content.
 *
 * `actioned` when the moderator agreed with the reporters (hidden, removed),
 * `dismissed` when the content stays up. Either way the reporter's complaint
 * has an answer instead of sitting open forever.
 */
async function closeReportsFor(req, target_type, target_id, status, resolution) {
  const result = await Report.updateMany(
    { target_type, target_id, status: "open" },
    { $set: { status, resolved_by: req.user._id, resolved_at: new Date(), resolution: String(resolution || "").slice(0, 500) } }
  );
  return result.modifiedCount || 0;
}

// ── the queue ────────────────────────────────────────────────────────
//
// Three signals feed it: posts and reviews the rules held, and anything a
// traveller reported (which may still be live — one report is below the
// auto-hide threshold, and a moderator should see it before a second one
// arrives).
export const getModerationQueue = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

  const [pendingPosts, pendingReviews, openReports] = await Promise.all([
    CommunityPost.find({ moderation_status: "pending" })
      .populate("user_id", "name email")
      .sort({ created_at: 1 })
      .limit(200)
      .lean(),
    Review.find({ moderation_status: "pending" })
      .populate("user_id", "name email")
      .populate("attraction_id", "name city")
      .sort({ created_at: 1 })
      .limit(200)
      .lean(),
    Report.find({ status: "open" }).sort({ created_at: 1 }).limit(300).lean(),
  ]);

  // Reports against content that is still live — the held items above are
  // already in hand, so only the missing targets need loading.
  const seen = new Set([
    ...pendingPosts.map((p) => `CommunityPost:${p._id}`),
    ...pendingReviews.map((r) => `Review:${r._id}`),
  ]);
  const missing = { CommunityPost: [], Review: [] };
  for (const report of openReports) {
    const key = `${report.target_type}:${report.target_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      missing[report.target_type].push(report.target_id);
    }
  }

  const [reportedPosts, reportedReviews] = await Promise.all([
    missing.CommunityPost.length
      ? CommunityPost.find({ _id: { $in: missing.CommunityPost } }).populate("user_id", "name email").lean()
      : [],
    missing.Review.length
      ? Review.find({ _id: { $in: missing.Review } })
          .populate("user_id", "name email")
          .populate("attraction_id", "name city")
          .lean()
      : [],
  ]);

  // Reports grouped by what they are about, so each queue entry carries the
  // complaints that put it there.
  const reportsByTarget = new Map();
  for (const report of openReports) {
    const key = `${report.target_type}:${report.target_id}`;
    if (!reportsByTarget.has(key)) reportsByTarget.set(key, []);
    reportsByTarget.get(key).push({
      _id: report._id,
      reason: report.reason,
      details: report.details,
      reporter_email: report.reporter_email,
      created_at: report.created_at,
    });
  }

  const entry = (kind, doc) => {
    const reports = reportsByTarget.get(`${kind === "post" ? "CommunityPost" : "Review"}:${doc._id}`) || [];
    return {
      kind,
      _id: doc._id,
      author: doc.user_id ? { name: doc.user_id.name, email: doc.user_id.email } : null,
      subject: kind === "post" ? doc.place : doc.attraction_id?.name || "—",
      excerpt: kind === "post" ? doc.content : doc.comment,
      rating: kind === "review" ? doc.rating : null,
      created_at: doc.created_at,
      moderation_status: doc.moderation_status || "approved",
      is_hidden: Boolean(doc.is_hidden),
      reports,
      // Why it is in the queue at all, in one phrase.
      trigger: doc.moderation_status === "pending"
        ? reports.length
          ? "Held after being reported"
          : "Held by the posting rules"
        : "Reported by a traveller",
    };
  };

  const rows = [
    ...pendingPosts.map((p) => entry("post", p)),
    ...reportedPosts.map((p) => entry("post", p)),
    ...pendingReviews.map((r) => entry("review", r)),
    ...reportedReviews.map((r) => entry("review", r)),
  ]
    // Oldest first: a queue that shows the newest complaint first never
    // reaches the bottom.
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  res.json({
    rows: rows.slice(0, limit),
    total: rows.length,
    counts: {
      pending_posts: pendingPosts.length,
      pending_reviews: pendingReviews.length,
      open_reports: openReports.length,
    },
  });
});

// ── reports ──────────────────────────────────────────────────────────
export const listReports = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["reporter_email", "target_label", "details", "resolution"],
    allowedSort: ["created_at", "status", "reason"],
  });
  if (["open", "actioned", "dismissed"].includes(req.query.status)) options.filter.status = req.query.status;
  if (REPORT_TARGETS.includes(req.query.target_type)) options.filter.target_type = req.query.target_type;
  if (REPORT_REASONS.includes(req.query.reason)) options.filter.reason = req.query.reason;

  res.json(
    await paginate(Report, options, (q) =>
      q.populate("reporter_id", "name email").populate("resolved_by", "name email")
    )
  );
});

// Closing a report without touching the content — "looked at it, it's fine",
// or the content was already dealt with elsewhere.
export const resolveReport = asyncHandler(async (req, res) => {
  const { status, resolution } = req.body;
  if (!["actioned", "dismissed"].includes(status)) {
    return res.status(400).json({ message: "A report is closed as either actioned or dismissed" });
  }

  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.status !== "open") {
    return res.status(400).json({ message: "That report has already been closed" });
  }

  report.status = status;
  report.resolved_by = req.user._id;
  report.resolved_at = new Date();
  report.resolution = String(resolution || "").slice(0, 500);
  await report.save();

  await recordAudit(req, {
    action: `report.${status}`,
    entity_type: "Report",
    entity_id: report._id,
    entity_label: report.target_label,
    before: { status: "open" },
    after: { status },
    reason: resolution,
  });

  res.json({ report });
});

// ── the two moderated collections ────────────────────────────────────
// Lists ALL posts and reviews, hidden and held included — the public
// endpoints only show what a traveller may read, which is exactly what a
// moderator cannot work from.
export const listCommunityPosts = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["place", "content"],
    allowedSort: ["created_at", "place", "likes"],
  });
  if (req.query.visibility === "hidden") options.filter.is_hidden = true;
  if (req.query.visibility === "visible") options.filter.is_hidden = false;
  if (["pending", "approved", "rejected"].includes(req.query.moderation)) {
    options.filter.moderation_status = req.query.moderation;
  }

  res.json(await paginate(CommunityPost, options, (q) => q.populate("user_id", "name email")));
});

export const listReviews = asyncHandler(async (req, res) => {
  const options = parseListQuery(req.query, {
    searchFields: ["comment"],
    allowedSort: ["created_at", "rating"],
  });
  if (req.query.visibility === "hidden") options.filter.is_hidden = true;
  if (req.query.visibility === "visible") options.filter.is_hidden = false;
  if (["pending", "approved", "rejected"].includes(req.query.moderation)) {
    options.filter.moderation_status = req.query.moderation;
  }

  res.json(
    await paginate(Review, options, (q) =>
      q.populate("user_id", "name email").populate("attraction_id", "name city")
    )
  );
});

const ACTIONS = ["approve", "hide", "unhide", "remove"];

/**
 * One decision path for both collections: approve puts it on the feed, hide
 * takes it off reversibly, remove is final, unhide undoes a hide.
 */
async function moderate({ req, res, Model, kind, label }) {
  const { action, reason } = req.body;
  if (!ACTIONS.includes(action)) {
    return res.status(400).json({ message: `Action must be one of: ${ACTIONS.join(", ")}` });
  }

  const query = Model.findById(req.params.id).populate("user_id", "email");
  const doc = await query;
  if (!doc) return res.status(404).json({ message: kind === "post" ? "Post not found" : "Review not found" });

  const entity_type = kind === "post" ? "CommunityPost" : "Review";
  const entity_label = label(doc);

  if (action === "remove") {
    await Model.deleteOne({ _id: doc._id });
    const closed = await closeReportsFor(req, entity_type, doc._id, "actioned", reason || "Content removed");
    await recordAudit(req, {
      action: `${kind}.remove`,
      entity_type,
      entity_id: doc._id,
      entity_label,
      before: {
        author: doc.user_id?.email || "",
        content: kind === "post" ? doc.content : doc.comment,
        moderation_status: doc.moderation_status,
      },
      after: { reports_closed: closed },
      reason,
    });
    return res.json({ message: kind === "post" ? "Post removed" : "Review removed", reports_closed: closed });
  }

  const was = { is_hidden: doc.is_hidden, moderation_status: doc.moderation_status };

  if (action === "hide") {
    doc.is_hidden = true;
    doc.moderation_status = "rejected";
  } else {
    // approve and unhide land in the same place: on the feed, decided.
    doc.is_hidden = false;
    doc.moderation_status = "approved";
  }
  doc.moderated_by = req.user._id;
  doc.moderated_at = new Date();
  await doc.save();

  // Agreeing with the reporters closes their reports as actioned; leaving
  // the content up closes them as dismissed. Both are an answer.
  const closed = await closeReportsFor(
    req,
    entity_type,
    doc._id,
    action === "hide" ? "actioned" : "dismissed",
    reason || (action === "hide" ? "Content hidden" : "Reviewed and kept")
  );

  await recordAudit(req, {
    action: `${kind}.${action}`,
    entity_type,
    entity_id: doc._id,
    entity_label,
    before: was,
    after: { is_hidden: doc.is_hidden, moderation_status: doc.moderation_status, reports_closed: closed },
    reason,
  });

  res.json({ [kind]: doc, reports_closed: closed });
}

export const moderatePost = asyncHandler((req, res) =>
  moderate({ req, res, Model: CommunityPost, kind: "post", label: postLabel })
);

export const moderateReview = asyncHandler((req, res) =>
  moderate({ req, res, Model: Review, kind: "review", label: reviewLabel })
);

// ── throughput ───────────────────────────────────────────────────────
// What the moderation team actually did, for the reports tab.
export const getModerationStats = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);

  const [byStatus, byReason, held, decided] = await Promise.all([
    Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: "$reason", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Promise.all([
      CommunityPost.countDocuments({ moderation_status: "pending" }),
      Review.countDocuments({ moderation_status: "pending" }),
    ]).then(([posts, reviews]) => ({ posts, reviews })),
    Report.aggregate([
      { $match: { resolved_at: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const asMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || "unknown", r.count]));

  res.json({
    reports: asMap(byStatus),
    by_reason: asMap(byReason),
    pending: held,
    resolved_last_30_days: asMap(decided),
    generated_at: new Date(),
  });
});
