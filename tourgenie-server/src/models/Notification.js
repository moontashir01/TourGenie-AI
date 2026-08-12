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
  // Set when a template fires ahead of time; the UI hides it until then.
  deliver_at: { type: Date, default: Date.now },
});

notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });
notificationSchema.index({ trip_id: 1 });
// One notification per template per trip — the scheduler relies on this to
// stay idempotent when it runs more than once a day. `$gt: ""` selects any
// non-empty string; partial indexes don't accept `$ne`.
notificationSchema.index(
  { user_id: 1, trip_id: 1, template_code: 1 },
  { unique: true, partialFilterExpression: { template_code: { $gt: "" } } }
);

export default mongoose.model("Notification", notificationSchema);
