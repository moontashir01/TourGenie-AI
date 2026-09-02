import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminApi, attractionApi } from "../../lib/api";
import { ErrorBanner } from "../../components/admin/ListShell";

// FR-24 — the dashboard.
//
// The breakdowns used to be counted in the browser, which meant downloading
// every trip and every user to draw six numbers and a bar chart. They are
// grouped in the database now; this page asks for a page of recent trips for
// the table and nothing more.
export default function Overview() {
  const [analytics, setAnalytics] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminApi.analytics(), adminApi.trips({ limit: 8 }), attractionApi.list()])
      .then(([a, t, attr]) => {
        setAnalytics(a);
        setRecentTrips(t.rows || []);
        setAttractions((attr.attractions || []).slice(0, 10));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics…
      </div>
    );
  }

  const metrics = analytics
    ? [
        { label: "Total Users", value: analytics.totalUsers },
        { label: "Staff Accounts", value: analytics.staffCount },
        { label: "Total Trips", value: analytics.totalTrips },
        { label: "Active Trips", value: analytics.activeTrips },
        { label: "Confirmed Bookings", value: analytics.bookingCount },
        { label: "Hidden Posts/Reviews", value: analytics.pendingModeration },
      ]
    : [];

  const months = analytics?.tripsByMonth || [];
  const maxCount = Math.max(1, ...months.map((m) => m.count));

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {metrics.map((m) => (
          <div key={m.label} className="bg-surface border border-sand rounded-2xl p-5">
            <p className="text-xs font-medium text-ink-900/50 mb-2">{m.label}</p>
            <p className="font-mono text-2xl font-semibold text-ink-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-6">Trips created — last 6 months</h3>
        {months.length === 0 ? (
          <p className="text-sm text-ink-900/50">No trips created yet.</p>
        ) : (
          <div className="flex items-end gap-4 h-40">
            {months.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2 justify-end h-full">
                <span className="text-xs font-mono text-ink-900/50">{m.count}</span>
                <div
                  className="w-full bg-teal rounded-t-md min-h-1"
                  style={{ height: `${(m.count / maxCount) * 100}%` }}
                />
                <span className="text-xs text-ink-900/50">{m.month}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-5">Recent trips across all travelers</h3>
        {recentTrips.length === 0 ? (
          <p className="text-sm text-ink-900/50">No trips yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                  <th className="pb-3 font-medium">Traveler</th>
                  <th className="pb-3 font-medium">Route</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {recentTrips.map((t) => (
                  <tr key={t._id}>
                    <td className="py-3 font-medium text-ink-900">
                      {t.user_id?.name || <span className="text-ink-900/35">no longer exists</span>}
                    </td>
                    <td className="py-3 text-ink-900/70">
                      {t.origin} → {t.destination}
                    </td>
                    <td className="py-3 text-ink-900/70 capitalize">{t.status}</td>
                    <td className="py-3 font-mono text-ink-900/70">৳{(t.budget || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-surface border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-5">Attractions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">City</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Entry fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {attractions.map((a) => (
                <tr key={a._id}>
                  <td className="py-3 font-medium text-ink-900">{a.name}</td>
                  <td className="py-3 text-ink-900/70">{a.city}</td>
                  <td className="py-3 text-ink-900/70">{a.category}</td>
                  <td className="py-3 font-mono text-ink-900/70">
                    {a.entry_fee === 0 ? "Free" : `৳${a.entry_fee}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-900/40 mt-4">
          Showing 10 — the Attractions tab has the full catalogue.
        </p>
      </div>
    </div>
  );
}
