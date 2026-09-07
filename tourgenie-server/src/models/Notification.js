// FR-18 — Smart Notifications, the generated rows. Proposal fields (§4.1.10)
// unchanged; the additions link a notification back to the template and trip
// that produced it, which is also how duplicates are prevented.
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  // — proposal §4.1.10 —
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true }, // departure, weather, budget…
  message: { type: String, required: true },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },

  // — additive —
  template_code: { type: String, default: "" },
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
  title: { type: String, default: "" },
  severity: { type: String, enum: ["info", "reminder", "warning", "critical"], default: "info" },
  icon: { type: String, default: "Bell" },
  action_url: { type: String, default: "" },
  read_at: { type: Date, default: null },
  // Set when a template fires ahead of time; every read path filters on it,
  // so a weather advisory for next Tuesday can be written today and stay
  // invisible until it is worth acting on.
  deliver_at: { type: Date, default: Date.now },
  // Retention. Nothing swept these before, so rows accumulated for the life
  // of the account. Unread ones are kept six months; markAsRead pulls the
  // date in to thirty days, because a notification you have already dealt
  // with has no second use.
  expires_at: { type: Date, default: () => new Date(Date.now() + 180 * 86400000) },
});

notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });
notificationSchema.index({ trip_id: 1 });
// TTL. expireAfterSeconds: 0 means "remove when expires_at passes", which
// puts the lifetime on the document instead of the index and lets a read
// notification age out sooner than an unread one.
notificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// One notification per template per trip — the scheduler relies on this to
// stay idempotent when it runs more than once a day. `$gt: ""` selects any
// non-empty string; partial indexes don't accept `$ne`.
notificationSchema.index(
  { user_id: 1, trip_id: 1, template_code: 1 },
  { unique: true, partialFilterExpression: { template_code: { $gt: "" } } }
);

export default mongoose.model("Notification", notificationSchema);
