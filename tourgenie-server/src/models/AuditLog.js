// Admin action trail (supports FR-20 through FR-23) — who changed what, when.
// Every destructive or moderating admin route writes one of these.
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actor_email: { type: String, default: "" }, // kept even if the account is deleted
  actor_role: { type: String, default: "admin" },

  action: { type: String, required: true }, // user.deactivate, attraction.update…
  entity_type: { type: String, required: true }, // User, Attraction, Review…
  entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  entity_label: { type: String, default: "" }, // human-readable, survives deletion

  // Only the fields that actually changed, not whole documents.
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },

  reason: { type: String, default: "" },
  ip: { type: String, default: "" },
  user_agent: { type: String, default: "" },
  created_at: { type: Date, default: Date.now },
});

auditLogSchema.index({ created_at: -1 });
auditLogSchema.index({ actor_id: 1, created_at: -1 });
auditLogSchema.index({ entity_type: 1, entity_id: 1 });

export default mongoose.model("AuditLog", auditLogSchema);
