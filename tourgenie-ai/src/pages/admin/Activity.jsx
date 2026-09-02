import { adminApi } from "../../lib/api";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, AdminSelect, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";

// FR-20–23 — the action trail. Read-only for everyone, owners included: an
// audit log an admin can edit is not an audit log.

const ENTITY_TYPES = ["User", "Attraction", "Hotel", "TransportOption", "CommunityPost", "Review"];

const ACTION_TONE = [
  { match: /delete|remove/, tone: "bg-sunset-light text-sunset-dark" },
  { match: /hide|deactivate/, tone: "bg-gold/20 text-ink-800" },
  { match: /role_change/, tone: "bg-teal-light text-teal-dark" },
];

function toneFor(action) {
  return ACTION_TONE.find((t) => t.match.test(action))?.tone || "bg-sand text-ink-900/60";
}

function timeAgo(value) {
  const seconds = Math.floor((Date.now() - new Date(value)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

/** "role: traveler → moderator" — only the fields that actually changed. */
function Changes({ before, after }) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  if (keys.length === 0) return <span className="text-ink-900/30">—</span>;

  return (
    <div className="space-y-0.5">
      {keys.slice(0, 4).map((key) => (
        <p key={key} className="text-[11px] text-ink-900/60 font-mono truncate max-w-xs">
          <span className="text-ink-900/40">{key}:</span>{" "}
          {before?.[key] !== undefined && <span className="line-through opacity-60">{format(before[key])}</span>}{" "}
          {after?.[key] !== undefined && <span>{format(after[key])}</span>}
        </p>
      ))}
      {keys.length > 4 && <p className="text-[11px] text-ink-900/40">+{keys.length - 4} more</p>}
    </div>
  );
}

function format(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function Activity() {
  const list = useAdminList(adminApi.auditLogs, { entity_type: "" });

  return (
    <div className="card p-6">
      <ErrorBanner message={list.error} onDismiss={() => list.setError("")} />

      <AdminToolbar list={list} placeholder="Search actor, action, or what was changed…">
        <AdminSelect
          label="Entity"
          value={list.filters.entity_type}
          onChange={(v) => list.setFilter("entity_type", v)}
          options={[{ value: "", label: "Everything" }, ...ENTITY_TYPES.map((t) => ({ value: t, label: t }))]}
        />
      </AdminToolbar>

      <ListState
        list={list}
        empty="No admin actions recorded yet. Every change made from this portal appears here."
      />

      {list.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">When</th>
                <th className="pb-3 font-medium">Who</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Target</th>
                <th className="pb-3 font-medium">Changed</th>
                <th className="pb-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {list.rows.map((row) => (
                <tr key={row._id}>
                  <td className="py-3 text-ink-900/50 text-xs whitespace-nowrap" title={new Date(row.created_at).toLocaleString()}>
                    {timeAgo(row.created_at)}
                  </td>
                  <td className="py-3 text-ink-900/70 text-xs">
                    {row.actor_email || "—"}
                    <span className="block text-ink-900/35 capitalize">{row.actor_role}</span>
                  </td>
                  <td className="py-3">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full font-mono ${toneFor(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="py-3 text-ink-900/70 text-xs max-w-[16rem] truncate" title={row.entity_label}>
                    {row.entity_label || "—"}
                    <span className="block text-ink-900/35">{row.entity_type}</span>
                  </td>
                  <td className="py-3">
                    <Changes before={row.before} after={row.after} />
                  </td>
                  <td className="py-3 text-ink-900/60 text-xs max-w-[12rem]">
                    {row.reason || <span className="text-ink-900/25">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager list={list} />
    </div>
  );
}
