import { useState } from "react";
import { adminApi } from "../../lib/api";
import useAdminList from "../../hooks/useAdminList";
import { StatusBadge } from "../../components/ui/Badge";
import { AdminToolbar, AdminSelect, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";
import TripDetail from "../../components/admin/TripDetail";

const money = (n) => `৳${Math.round(n || 0).toLocaleString()}`;
const date = (d) => (d ? new Date(d).toLocaleDateString() : "—");

// Trip oversight. The list answers "what is being planned"; the row opens the
// whole trip, including which AI wrote the itinerary and whether the fare on
// it was real.
export default function Trips() {
  const list = useAdminList(adminApi.trips, { status: "" }, { listKey: "trips" });
  const [openTripId, setOpenTripId] = useState(null);

  return (
    <div className="card p-6">
      <ErrorBanner message={list.error} onDismiss={() => list.setError("")} />

      <AdminToolbar list={list} placeholder="Search destination or origin…">
        <AdminSelect
          label="Status"
          value={list.filters.status}
          onChange={(v) => list.setFilter("status", v)}
          options={[
            { value: "", label: "Any status" },
            { value: "draft", label: "Draft" },
            { value: "planned", label: "Planned" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </AdminToolbar>

      <ListState list={list} empty="No trips match that." />

      {list.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Traveller</th>
                <th className="pb-3 font-medium">Route</th>
                <th className="pb-3 font-medium">Dates</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Budget</th>
                <th className="pb-3 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {list.rows.map((t) => (
                <tr
                  key={t._id}
                  onClick={() => setOpenTripId(t._id)}
                  className="cursor-pointer hover:bg-paper/60 transition-colors"
                >
                  <td className="py-3 font-medium text-ink-900">
                    {t.user_id?.name || <span className="text-ink-900/35 font-normal">no longer exists</span>}
                  </td>
                  <td className="py-3 text-ink-900/70">
                    {t.origin} → {t.destination}
                  </td>
                  <td className="py-3 text-ink-900/50 text-xs whitespace-nowrap">
                    {date(t.start_date)} – {date(t.end_date)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={t.status} size="md" />
                  </td>
                  <td className="py-3 font-mono text-ink-900/70">{money(t.budget)}</td>
                  <td className="py-3 text-xs text-ink-900/45 capitalize">{t.itinerary_source || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager list={list} />

      <TripDetail tripId={openTripId} onClose={() => setOpenTripId(null)} />
    </div>
  );
}
