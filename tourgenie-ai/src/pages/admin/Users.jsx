import { useState } from "react";
import { Ban, CheckCircle2, Trash2, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, AdminSelect, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";

const ROLE_TONE = {
  owner: "bg-sunset-light text-sunset-dark",
  admin: "bg-teal-light text-teal-dark",
  moderator: "bg-gold/20 text-ink-800",
  traveler: "bg-sand text-ink-900/60",
};

const ROLES = ["traveler", "moderator", "admin", "owner"];

// Changing what someone may do, and deleting an account, both ask for a
// reason — it is what the audit trail records, and it is the difference
// between a log you can act on and a list of timestamps.
function ReasonPrompt({ title, description, confirmLabel, tone = "teal", busy, onCancel, onConfirm, children }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md card p-6 animate-pop-in">
        <h3 className="font-display text-lg text-ink-900 mb-1">{title}</h3>
        <p className="text-sm text-ink-900/60 mb-4">{description}</p>
        {children}
        <label className="block mb-4">
          <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Reason (recorded in the activity log)</span>
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this happening?"
            className="input"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className={`inline-flex items-center justify-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-full transition-all disabled:opacity-50 ${
              tone === "danger" ? "bg-sunset hover:bg-sunset-dark text-ink-fixed" : "bg-teal hover:bg-teal-dark text-paper-fixed"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const list = useAdminList(adminApi.users, { role: "", status: "" });
  const [busyId, setBusyId] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null); // { user, role }
  const [deleteTarget, setDeleteTarget] = useState(null); // { user, footprint }

  const isOwner = currentUser?.role === "owner";
  const canManage = isOwner || currentUser?.role === "admin";

  async function toggleActive(user) {
    setBusyId(user._id);
    try {
      await adminApi.setUserStatus(user._id, !user.is_active);
      list.reload();
    } catch (err) {
      list.setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRole(reason) {
    setBusyId(roleTarget.user._id);
    try {
      await adminApi.setUserRole(roleTarget.user._id, roleTarget.role, reason);
      setRoleTarget(null);
      list.reload();
    } catch (err) {
      list.setError(err.message);
      setRoleTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  // The footprint is fetched first: "delete user" reads much smaller than it
  // is, and the confirmation should say what is actually about to go.
  async function openDelete(user) {
    setBusyId(user._id);
    try {
      const { footprint } = await adminApi.userFootprint(user._id);
      setDeleteTarget({ user, footprint });
    } catch (err) {
      list.setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(reason) {
    setBusyId(deleteTarget.user._id);
    try {
      await adminApi.deleteUser(deleteTarget.user._id, reason);
      setDeleteTarget(null);
      list.reload();
    } catch (err) {
      list.setError(err.message);
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  const footprintLines = deleteTarget
    ? Object.entries(deleteTarget.footprint).filter(([, count]) => count > 0)
    : [];

  return (
    <div className="card p-6">
      <ErrorBanner message={list.error} onDismiss={() => list.setError("")} />

      <AdminToolbar list={list} placeholder="Search name, email, phone, city…">
        <AdminSelect
          label="Role"
          value={list.filters.role}
          onChange={(v) => list.setFilter("role", v)}
          options={[{ value: "", label: "All roles" }, ...ROLES.map((r) => ({ value: r, label: r }))]}
        />
        <AdminSelect
          label="Status"
          value={list.filters.status}
          onChange={(v) => list.setFilter("status", v)}
          options={[
            { value: "", label: "Any status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Deactivated" },
          ]}
        />
      </AdminToolbar>

      <ListState list={list} empty="No accounts match that." />

      {list.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Last login</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {list.rows.map((u) => {
                const self = u._id === currentUser?.id;
                return (
                  <tr key={u._id} className={busyId === u._id ? "opacity-50" : ""}>
                    <td className="py-3 font-medium text-ink-900">
                      {u.name}
                      {self && <span className="text-[11px] text-ink-900/40 ml-1.5">(you)</span>}
                    </td>
                    <td className="py-3 text-ink-900/70">{u.email}</td>
                    <td className="py-3">
                      {isOwner && !self ? (
                        <select
                          value={u.role}
                          onChange={(e) => setRoleTarget({ user: u, role: e.target.value })}
                          className="bg-paper border border-sand rounded-lg text-xs text-ink-900 px-2 py-1 focus:outline-none focus:border-teal capitalize"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${ROLE_TONE[u.role] || ROLE_TONE.traveler}`}
                        >
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                          u.is_active ? "bg-teal-light text-teal-dark" : "bg-sunset-light text-sunset-dark"
                        }`}
                      >
                        {u.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-3 text-ink-900/50 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={!canManage || busyId === u._id || self}
                          title={canManage ? (u.is_active ? "Deactivate" : "Reactivate") : "Admins only"}
                          className="text-ink-900/40 hover:text-teal-dark disabled:opacity-30"
                        >
                          {u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openDelete(u)}
                          disabled={!isOwner || busyId === u._id || self}
                          title={isOwner ? "Delete account and all its content" : "Owners only"}
                          className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager list={list} />

      {roleTarget && (
        <ReasonPrompt
          title={`Make ${roleTarget.user.name} a ${roleTarget.role}?`}
          description={
            roleTarget.role === "traveler"
              ? "They lose access to the admin portal immediately."
              : `They will be able to sign in to the admin portal as a ${roleTarget.role}.`
          }
          confirmLabel="Change role"
          busy={busyId === roleTarget.user._id}
          onCancel={() => setRoleTarget(null)}
          onConfirm={confirmRole}
        >
          <div className="flex items-center gap-2 text-xs text-ink-900/60 bg-paper border border-sand rounded-lg px-3 py-2.5 mb-4">
            <ShieldCheck className="w-4 h-4 text-teal-dark shrink-0" />
            <span className="capitalize">
              {roleTarget.user.role} → {roleTarget.role}
            </span>
          </div>
        </ReasonPrompt>
      )}

      {deleteTarget && (
        <ReasonPrompt
          title={`Delete ${deleteTarget.user.name}'s account?`}
          description="This cannot be undone. Everything the account owns is removed with it."
          confirmLabel="Delete permanently"
          tone="danger"
          busy={busyId === deleteTarget.user._id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        >
          <div className="bg-sunset/5 border border-sunset/30 rounded-lg px-3 py-2.5 mb-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-sunset-dark mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Also deleted
            </p>
            {footprintLines.length === 0 ? (
              <p className="text-xs text-ink-900/60">Nothing — this account has no content.</p>
            ) : (
              <ul className="text-xs text-ink-900/70 grid grid-cols-2 gap-x-4 gap-y-0.5">
                {footprintLines.map(([label, count]) => (
                  <li key={label} className="tabular-nums">
                    {count} {label.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ReasonPrompt>
      )}
    </div>
  );
}
