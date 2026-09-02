import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { adminApi } from "../../lib/api";
import { ErrorBanner } from "../../components/admin/ListShell";

// Reports tab (wireframe 3.13).
//
// The breakdowns are computed in the database now rather than by downloading
// every trip and user into the browser. The CSV still exports the trip rows
// themselves, so it pages through the admin list instead of relying on an
// endpoint that returns everything at once.
export default function Reports() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .analytics()
      .then(setAnalytics)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function exportTripsCsv() {
    setExporting(true);
    setError("");
    try {
      // Paged rather than one giant request — the same reason the lists are
      // paginated. 100 is the server's ceiling per page.
      const rows = [];
      let page = 1;
      let pages = 1;
      do {
        const data = await adminApi.trips({ page, limit: 100 });
        rows.push(...(data.rows || []));
        pages = data.pages || 1;
        page += 1;
      } while (page <= pages && page <= 50); // 5,000 rows is enough for a CSV

      const header = ["Traveler", "Email", "Origin", "Destination", "Status", "Budget", "Created"];
      const body = rows.map((t) => [
        t.user_id?.name || "",
        t.user_id?.email || "",
        t.origin || "",
        t.destination || "",
        t.status || "",
        t.budget ?? "",
        t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : "",
      ]);
      downloadCsv("tourgenie-trips-report.csv", [header, ...body]);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Building reports…
      </div>
    );
  }

  const tripsByStatus = Object.entries(analytics?.tripsByStatus || {});
  const usersByRole = Object.entries(analytics?.usersByRole || {});
  const topDestinations = analytics?.topDestinations || [];

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg text-ink-900">Platform reports</h3>
          {analytics?.generated_at && (
            <p className="text-xs text-ink-900/45 mt-0.5">
              Computed {new Date(analytics.generated_at).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={exportTripsCsv}
          disabled={exporting}
          className="inline-flex items-center gap-2 bg-teal hover:bg-teal-dark disabled:opacity-50 text-paper-fixed font-semibold text-sm px-4 py-2 rounded-full transition-colors"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Collecting…" : "Export trips (CSV)"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Stat label="Total trips" value={analytics?.totalTrips ?? 0} />
        <Stat label="Confirmed bookings" value={analytics?.bookingCount ?? 0} />
        <Stat label="Total budget planned" value={`৳${(analytics?.totalBudget || 0).toLocaleString()}`} />
        <Stat label="Avg budget / trip" value={`৳${(analytics?.avgBudget || 0).toLocaleString()}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <BreakdownCard title="Trips by status" rows={tripsByStatus} total={analytics?.totalTrips || 0} />
        <BreakdownCard title="Users by role" rows={usersByRole} total={analytics?.totalUsers || 0} />
      </div>

      <div className="bg-surface border border-sand rounded-2xl p-6">
        <h4 className="font-display text-base text-ink-900 mb-5">Top destinations</h4>
        {topDestinations.length === 0 ? (
          <p className="text-sm text-ink-900/50">No trips yet.</p>
        ) : (
          <div className="space-y-3">
            {topDestinations.map((row) => {
              const max = topDestinations[0].count || 1;
              return (
                <div key={row.destination} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-ink-900/70 truncate">{row.destination}</span>
                  <div className="flex-1 bg-sand/60 rounded-full h-3 overflow-hidden">
                    <div className="bg-teal h-full rounded-full" style={{ width: `${(row.count / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-xs text-ink-900/60">{row.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-surface border border-sand rounded-2xl p-6">
        <h4 className="font-display text-base text-ink-900 mb-4">Moderation & catalogue</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <MiniStat label="Hidden posts" value={analytics?.hiddenPosts ?? 0} />
          <MiniStat label="Hidden reviews" value={analytics?.hiddenReviews ?? 0} />
          <MiniStat label="Attractions listed" value={analytics?.attractionCount ?? 0} />
          <MiniStat label="Booking value" value={`৳${(analytics?.bookingValue || 0).toLocaleString()}`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-surface border border-sand rounded-2xl p-5">
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
    <div className="bg-surface border border-sand rounded-2xl p-6">
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
