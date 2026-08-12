import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminApi, attractionApi } from "../../lib/api";

export default function Overview() {
  const [analytics, setAnalytics] = useState(null);
  const [trips, setTrips] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminApi.analytics(), adminApi.trips(), attractionApi.list()])
      .then(([a, t, attr]) => {
        setAnalytics(a);
        setTrips(t.trips);
        setAttractions(attr.attractions);
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
        { label: "Total Trips", value: analytics.totalTrips },
        { label: "Active Trips", value: analytics.activeTrips },
        { label: "Attractions Listed", value: analytics.attractionCount },
        { label: "Confirmed Bookings", value: analytics.bookingCount },
        { label: "Hidden Posts/Reviews", value: analytics.hiddenPosts + analytics.hiddenReviews },
      ]
    : [];

  // Group real trips by creation month for the chart.
  const monthCounts = {};
  trips.forEach((t) => {
    const d = new Date(t.created_at);
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });
  const monthEntries = Object.entries(monthCounts).slice(-6);
  const maxCount = Math.max(1, ...monthEntries.map(([, v]) => v));

  return (
    <div className="space-y-8">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white border border-sand rounded-2xl p-5">
            <p className="text-xs font-medium text-ink-900/50 mb-2">{m.label}</p>
            <p className="font-mono text-2xl font-semibold text-ink-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-6">Trips created (last {monthEntries.length || 0} months with activity)</h3>
        {monthEntries.length === 0 ? (
          <p className="text-sm text-ink-900/50">No trips created yet.</p>
        ) : (
          <div className="flex items-end gap-4 h-40">
            {monthEntries.map(([month, count]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-teal rounded-t-md" style={{ height: `${(count / maxCount) * 100}%` }} />
                <span className="text-xs text-ink-900/50">{month}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-5">Recent trips across all travelers</h3>
        {trips.length === 0 ? (
          <p className="text-sm text-ink-900/50">No trips yet.</p>
        ) : (
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
              {trips.slice(0, 8).map((t) => (
                <tr key={t._id}>
                  <td className="py-3 font-medium text-ink-900">{t.user_id?.name || "—"}</td>
                  <td className="py-3 text-ink-900/70">{t.origin} → {t.destination}</td>
                  <td className="py-3 text-ink-900/70 capitalize">{t.status}</td>
                  <td className="py-3 font-mono text-ink-900/70">৳{t.budget.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border border-sand rounded-2xl p-6">
        <h3 className="font-display text-lg text-ink-900 mb-5">Attractions</h3>
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
                <td className="py-3 font-mono text-ink-900/70">{a.entry_fee === 0 ? "Free" : `৳${a.entry_fee}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
