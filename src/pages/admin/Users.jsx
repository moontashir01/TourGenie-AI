import { useEffect, useState } from "react";
import { Loader2, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    adminApi
      .users()
      .then(({ users }) => setUsers(users))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(u) {
    setBusyId(u._id);
    try {
      await adminApi.setUserStatus(u._id, !u.is_active);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(u) {
    if (!confirm(`Delete ${u.name}'s account? This can't be undone.`)) return;
    setBusyId(u._id);
    try {
      await adminApi.deleteUser(u._id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
      </div>
    );
  }

  return (
    <div className="bg-white border border-sand rounded-2xl p-6">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}
      <h3 className="font-display text-lg text-ink-900 mb-5">All users ({users.length})</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">Role</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Joined</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand">
          {users.map((u) => (
            <tr key={u._id}>
              <td className="py-3 font-medium text-ink-900">{u.name}</td>
              <td className="py-3 text-ink-900/70">{u.email}</td>
              <td className="py-3 text-ink-900/70 capitalize">{u.role}</td>
              <td className="py-3">
                <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                  u.is_active ? "bg-teal-light text-teal-dark" : "bg-sunset-light text-sunset-dark"
                }`}>
                  {u.is_active ? "Active" : "Deactivated"}
                </span>
              </td>
              <td className="py-3 text-ink-900/50">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="py-3">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busyId === u._id || u._id === currentUser?.id}
                    title={u.is_active ? "Deactivate" : "Reactivate"}
                    className="text-ink-900/40 hover:text-teal-dark disabled:opacity-30"
                  >
                    {u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => removeUser(u)}
                    disabled={busyId === u._id || u._id === currentUser?.id}
                    title="Delete account"
                    className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
