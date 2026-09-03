import { useState } from "react";
import { Ban, CheckCircle2, Trash2, ShieldCheck, AlertTriangle, RotateCcw, Flame } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, AdminSelect, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";
import UserDetail from "../../components/admin/UserDetail";
import ConfirmPrompt from "../../components/admin/ConfirmPrompt";

const ROLE_TONE = {
  owner: "bg-sunset-light text-sunset-dark",
  admin: "bg-teal-light text-teal-dark",
  moderator: "bg-gold/20 text-ink-800",
  traveler: "bg-sand text-ink-900/60",
};

const ROLES = ["traveler", "moderator", "admin", "owner"];

// Changing what someone may do and deleting an account both ask for a reason
// — it is what the audit trail records — and for the admin's own password,
// because the server refuses either without a fresh confirmation. See
// components/admin/ConfirmPrompt and middleware/reauth.js.

export default function Users() {
  const { user: currentUser } = useAuth();
  const list = useAdminList(adminApi.users, { role: "", status: "" }, { listKey: "users" });
  const [busyId, setBusyId] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null); // { user, role }
  const [softTarget, setSoftTarget] = useState(null); // the reversible delete
  const [deleteTarget, setDeleteTarget] = useState(null); // { user, footprint }
  const [openUserId, setOpenUserId] = useState(null);

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

  async function confirmRole({ reason, password }) {
    setBusyId(roleTarget.user._id);
    try {
      const { reauth_token } = await adminApi.reauth(password);
      await adminApi.setUserRole(roleTarget.user._id, roleTarget.role, reason, reauth_token);
      setRoleTarget(null);
      list.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmSoftDelete({ reason }) {
    setBusyId(softTarget._id);
    try {
      await adminApi.deleteUser(softTarget._id, reason);
      setSoftTarget(null);
      list.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function restoreUser(user) {
    setBusyId(user._id);
    try {
      await adminApi.restoreUser(user._id, "restored from the Deleted filter");
      list.reload();
    } catch (err) {
      list.setError(err.message);
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

  async function confirmDelete({ reason, password }) {
    setBusyId(deleteTarget.user._id);
    try {
      const { reauth_token } = await adminApi.reauth(password);
      await adminApi.deleteUser(deleteTarget.user._id, reason, { hard: true, reauthToken: reauth_token });
      setDeleteTarget(null);
      list.reload();
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
            { value: "deleted", label: "Deleted" },
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
                      <button
                        type="button"
                        onClick={() => setOpenUserId(u._id)}
                        className="hover:text-teal-dark hover:underline text-left"
                        title="Open this account"
                      >
                        {u.name}
                      </button>
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
                          u.deleted_at
                            ? "bg-sunset-light text-sunset-dark"
                            : u.is_active
                              ? "bg-teal-light text-teal-dark"
                              : "bg-sand text-ink-900/60"
                        }`}
                      >
                        {u.deleted_at ? "Deleted" : u.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-3 text-ink-900/50 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-3">
                        {u.deleted_at ? (
                          <>
                            <button
                              onClick={() => restoreUser(u)}
                              disabled={!canManage || busyId === u._id}
                              title={canManage ? "Restore this account" : "Admins only"}
                              className="text-ink-900/40 hover:text-teal-dark disabled:opacity-30"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDelete(u)}
                              disabled={!isOwner || busyId === u._id || self}
                              title={isOwner ? "Remove the account and all its content for good" : "Owners only"}
                              className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-30"
                            >
                              <Flame className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => toggleActive(u)}
                              disabled={!canManage || busyId === u._id || self}
                              title={canManage ? (u.is_active ? "Deactivate" : "Reactivate") : "Admins only"}
                              className="text-ink-900/40 hover:text-teal-dark disabled:opacity-30"
                            >
                              {u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setSoftTarget(u)}
                              disabled={!canManage || busyId === u._id || self}
                              title={canManage ? "Delete — reversible from the Deleted filter" : "Admins only"}
                              className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
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

      <UserDetail userId={openUserId} onClose={() => setOpenUserId(null)} />

      {roleTarget && (
        <ConfirmPrompt
          title={`Make ${roleTarget.user.name} a ${roleTarget.role}?`}
          description={
            roleTarget.role === "traveler"
              ? "They lose access to the admin portal immediately."
              : `They will be able to sign in to the admin portal as a ${roleTarget.role}.`
          }
          confirmLabel="Change role"
          requirePassword
          passwordNote="Granting portal access is confirmed with your own password."
          onCancel={() => setRoleTarget(null)}
          onConfirm={confirmRole}
        >
          <div className="flex items-center gap-2 text-xs text-ink-900/60 bg-paper border border-sand rounded-lg px-3 py-2.5 mb-4">
            <ShieldCheck className="w-4 h-4 text-teal-dark shrink-0" />
            <span className="capitalize">
              {roleTarget.user.role} → {roleTarget.role}
            </span>
          </div>
        </ConfirmPrompt>
      )}

      {softTarget && (
        <ConfirmPrompt
          title={`Delete ${softTarget.name}'s account?`}
          description="They are signed out and can no longer log in. Nothing they own is removed, and the account can be restored from the Deleted filter."
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setSoftTarget(null)}
          onConfirm={confirmSoftDelete}
        />
      )}

      {deleteTarget && (
        <ConfirmPrompt
          title={`Permanently delete ${deleteTarget.user.name}'s account?`}
          description="This cannot be undone. Everything the account owns is removed with it."
          confirmLabel="Delete permanently"
          tone="danger"
          requirePassword
          confirmPhrase={deleteTarget.user.email}
          passwordNote="Nothing here can be restored, so it is confirmed with your own password."
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
        </ConfirmPrompt>
      )}
    </div>
  );
}
