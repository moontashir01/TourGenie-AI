import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { adminApi } from "../../lib/api";

// Reports tab (wireframe 3.13). Pulls the same data the rest of the admin
// console uses and derives breakdowns + a downloadable CSV client-side, so
// it needs no extra backend endpoint beyond what already exists.
export default function Reports() {
  const [analytics, setAnalytics] = useState(null);
  const [trips, setTrips] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminApi.analytics(), adminApi.trips(), adminApi.users()])
      .then(([a, t, u]) => {
        setAnalytics(a);
        setTrips(t.trips);
        setUsers(u.users);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Building reports…
      </div>
    );
  }

  // ---- Derived breakdowns ----
  const tripsByStatus = countBy(trips, (t) => t.status || "unknown");
  const usersByRole = countBy(users, (u) => u.role || "traveler");
  const topDestinations = Object.entries(countBy(trips, (t) => t.destination || "—"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalBudget = trips.reduce((sum, t) => sum + (t.budget || 0), 0);
  const avgBudget = trips.length ? Math.round(totalBudget / trips.length) : 0;

  function exportTripsCsv() {
    const header = ["Traveler", "Email", "Origin", "Destination", "Status", "Budget", "Created"];
    const rows = trips.map((t) => [
      t.user_id?.name || "",
      t.user_id?.email || "",
      t.origin || "",
      t.destination || "",
      t.status || "",
      t.budget ?? "",
      t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : "",
    ]);
    downloadCsv("tourgenie-trips-report.csv", [header, ...rows]);
  }

  return (
    <div className="space-y-8">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-900">Platform reports</h3>
        <button
          onClick={exportTripsCsv}
          disabled={trips.length === 0}
          className="inline-flex items-center gap-2 bg-teal hover:bg-teal-dark disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-full transition-colors"
        >
          <Download className="w-4 h-4" /> Export trips (CSV)
        </button>
      </div>

      {/* Headline figures */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Stat label="Total trips" value={analytics?.totalTrips ?? trips.length} />
        <Stat label="Confirmed bookings" value={analytics?.bookingCount ?? 0} />
        <Stat label="Total budget planned" value={`৳${totalBudget.toLocaleString()}`} />
        <Stat label="Avg budget / trip" value={`৳${avgBudget.toLocaleString()}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <BreakdownCard title="Trips by status" rows={Object.entries(tripsByStatus)} total={trips.length} />
        <BreakdownCard title="Users by role" rows={Object.entries(usersByRole)} total={users.length} />
      </div>

      <div className="bg-white border border-sand rounded-2xl p-6">
        <h4 className="font-display text-base text-ink-900 mb-5">Top destinations</h4>
        {topDestinations.length === 0 ? (
          <p className="text-sm text-ink-900/50">No trips yet.</p>
        ) : (
          <div className="space-y-3">
            {topDestinations.map(([place, count]) => {
              const max = topDestinations[0][1] || 1;
              return (
                <div key={place} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-ink-900/70 truncate">{place}</span>
                  <div className="flex-1 bg-sand/60 rounded-full h-3 overflow-hidden">
                    <div className="bg-teal h-full rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-xs text-ink-900/60">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-sand rounded-2xl p-6">
        <h4 className="font-display text-base text-ink-900 mb-4">Moderation summary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <MiniStat label="Hidden posts" value={analytics?.hiddenPosts ?? 0} />
          <MiniStat label="Hidden reviews" value={analytics?.hiddenReviews ?? 0} />
          <MiniStat label="Attractions listed" value={analytics?.attractionCount ?? 0} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-sand rounded-2xl p-5">
      <p className="text-xs font-medium text-ink-900/50 mb-2">{label}</p>
      <p className="font-mono text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="font-mono text-xl font-semibold text-ink-900">{value}</p>
      <p className="text-xs text-ink-900/50 mt-0.5">{label}</p>
    </div>
  );
}

function BreakdownCard({ title, rows, total }) {
  return (
    <div className="bg-white border border-sand rounded-2xl p-6">
      <h4 className="font-display text-base text-ink-900 mb-4">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-900/50">No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(([key, count]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="capitalize text-ink-900/70">{key}</span>
              <span className="font-mono text-ink-900/60">
                {count}
                <span className="text-ink-900/40"> · {total ? Math.round((count / total) * 100) : 0}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function countBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const k = keyFn(item);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
