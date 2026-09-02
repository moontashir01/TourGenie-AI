// The admin action trail. `AuditLog` has carried the right shape since the
// schema was written — actor, action, entity, before/after, reason, IP — and
// nothing wrote to it, so an admin could deactivate an account, delete a
// user or rewrite a hotel's prices and leave no record of who did it or why.
//
// Every mutating admin route calls recordAudit(). It never throws: failing to
// write the trail must not fail the action the admin actually asked for, and
// a swallowed error here is visible in the server log.
import AuditLog from "../models/AuditLog.js";

/**
 * The fields that actually changed, as { before, after } pairs — not whole
 * documents. A hotel has 30 fields; a price edit should read as a price edit.
 */
export function diffFields(before, after, fields) {
  const from = {};
  const to = {};
  for (const field of fields) {
    const was = before?.[field];
    const now = after?.[field];
    // Dates and ObjectIds don't compare with ===; JSON is close enough for a
    // human-readable trail.
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    from[field] = was ?? null;
    to[field] = now ?? null;
  }
  return Object.keys(to).length ? { before: from, after: to } : { before: null, after: null };
}

export async function recordAudit(req, entry) {
  try {
    await AuditLog.create({
      actor_id: req.user?._id,
      // Kept as text so the row still reads sensibly if the actor's own
      // account is later deleted.
      actor_email: req.user?.email || "",
      actor_role: req.user?.role || "",
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      entity_label: entry.entity_label || "",
      before: entry.before ?? null,
      after: entry.after ?? null,
      reason: String(entry.reason || "").slice(0, 500),
      ip: req.ip || "",
      user_agent: String(req.headers?.["user-agent"] || "").slice(0, 300),
    });
  } catch (err) {
    console.warn("[audit] failed to record", entry.action, "-", err.message);
  }
}
