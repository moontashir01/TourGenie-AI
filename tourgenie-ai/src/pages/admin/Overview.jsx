import { useEffect, useState } from "react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { adminApi } from "../../lib/api";
import { ErrorBanner } from "../../components/admin/ListShell";
import { writeLastView } from "../../hooks/useListPreferences";

// FR-24 — the dashboard, in three bands.
//
// It used to be six counters and a bar chart, which told an admin how the
// platform had been and nothing about what to do next. The bands answer
// three different questions:
//
//   Now       — what is true this minute. Every tile that has rows behind it
//               links to them, already filtered.
//   Trend     — how that has moved, read from AnalyticsSnapshot rather than
//               counted live, so 90 days costs one query instead of ninety.
//   Attention — the work queue. Counts of things outstanding, each with the
//               screen that clears it. This is the part that makes the page
//               worth opening in the morning.

const METRICS = [
  { key: "trips_created", label: "Trips created" },
  { key: "users_new", label: "Sign-ups" },
  { key: "bookings_created", label: "Bookings" },
  { key: "bookings_value_bdt", label: "Booking value (৳)" },
  { key: "itineraries_generated", label: "Itineraries generated" },
];

const PERIODS = [
  { key: "day", limit: 30, label: "30 days" },
  { key: "day", limit: 90, label: "90 days" },
  { key: "month", limit: 12, label: "12 months" },
];

export default function Overview({ onNavigate }) {
  const [analytics, setAnalytics] = useState(null);
  const [queue, setQueue] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [trend, setTrend] = useState(null);
  const [period, setPeriod] = useState(0);
  const [metric, setMetric] = useState("trips_created");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminApi.analytics(), adminApi.attention(), adminApi.trips({ limit: 8 })])
      .then(([a, q, t]) => {
        setAnalytics(a);
        setQueue(q);
        setRecentTrips(t.rows || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const chosen = PERIODS[period];
    adminApi
      .trends({ period: chosen.key, limit: chosen.limit })
      .then(setTrend)
      .catch((err) => setError(err.message));
  }, [period]);

  // A tile or a queue row lands on the rows behind its number: the target
  // list's remembered view is set first, then the tab switches, and
  // useAdminList picks the view up when it mounts.
  function go(target) {
    if (!target?.tab || !onNavigate) return;
    if (target.view?.listKey) {
      writeLastView(target.view.listKey, { filters: target.view.filters || {} });
    }
    onNavigate(target.tab);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-500 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading the dashboard…
      </div>
    );
  }

  const now = queue?.now || {};
  const tiles = [
    { label: "Travellers", value: now.users, tab: "users" },
    { label: "Signed up today", value: now.signups_today, tab: "users" },
    { label: "Active trips", value: now.active_trips, tab: "trips", view: { listKey: "trips", filters: { status: "active" } } },
    { label: "Booked today", value: now.bookings_today, tab: "bookings" },
    { label: "Awaiting moderation", value: now.pending_moderation, tab: "moderation" },
    { label: "Open reports", value: now.open_reports, tab: "moderation" },
  ];

  const outstanding = (queue?.attention || []).filter((row) => row.count > 0);
  const clear = (queue?.attention || []).filter((row) => row.count === 0);

  const points = trend?.points || [];
  const peak = Math.max(1, ...points.map((p) => p[metric] || 0));

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {/* — now — */}
      <section>
        <h3 className="font-display text-xl text-ink-900 mb-4">Now</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tiles.map((tile) => (
            <button
              key={tile.label}
              type="button"
              onClick={() => go(tile)}
              disabled={!onNavigate}
              className="group text-left card card-hover p-5 disabled:pointer-events-none"
            >
              <p className="text-xs font-medium text-ink-500 mb-2 flex items-center gap-1.5">
                {tile.label}
                {onNavigate && (
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </p>
              <p className="font-mono text-2xl font-semibold text-ink-900">{(tile.value ?? 0).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </section>

      {/* — trend — */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h3 className="font-display text-xl text-ink-900 mr-auto">Trend</h3>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="bg-paper border border-sand rounded-lg text-xs text-ink-900 px-2.5 py-1.5 focus:outline-none focus:border-teal"
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPeriod(i)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  period === i
                    ? "bg-ink-900 border-ink-900 text-paper"
                    : "bg-surface border-sand text-ink-600 hover:border-teal/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {points.length === 0 ? (
          <p className="text-sm text-ink-500">No snapshots for that period yet.</p>
        ) : (
          <>
            <div className="flex items-end gap-[3px] h-40">
              {points.map((point) => {
                const value = point[metric] || 0;
                return (
                  <div
                    key={point.key}
                    title={`${point.key}: ${value.toLocaleString()}`}
                    className="flex-1 flex flex-col justify-end h-full"
                  >
                    <div
                      className="w-full bg-teal hover:bg-teal-dark rounded-t-sm min-h-[2px] transition-colors"
                      style={{ height: `${(value / peak) * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-ink-500 mt-2">
              <span>{points[0]?.key}</span>
              <span className="tabular-nums">peak {peak.toLocaleString()}</span>
              <span>{points.at(-1)?.key} (partial)</span>
            </div>
            {/* A chart that doesn't admit its own staleness is worse than no
                chart: the last point is still being written to. */}
            <p className="text-2xs text-ink-500 mt-2">
              From the daily roll-up
              {trend?.points?.at(-1)?.computed_at &&
                ` · last computed ${new Date(trend.points.at(-1).computed_at).toLocaleString()}`}
            </p>
          </>
        )}
      </section>

      {/* — attention — */}
      <section>
        <h3 className="font-display text-xl text-ink-900 mb-4">Needs attention</h3>

        {outstanding.length === 0 ? (
          <div className="flex items-center gap-2.5 bg-teal-light/40 border border-teal/30 rounded-2xl px-5 py-4 text-sm text-teal-dark">
            <CheckCircle2 className="w-4 h-4" />
            Nothing outstanding — the queue, the reports and the catalogue are all clear.
          </div>
        ) : (
          <ul className="space-y-2">
            {outstanding.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => go(row)}
                  disabled={!row.tab || !onNavigate}
                  className="w-full text-left flex items-center gap-4 card card-hover px-5 py-4 disabled:pointer-events-none"
                >
                  <span className="font-mono text-xl font-semibold text-sunset-dark tabular-nums w-12 shrink-0">
                    {row.count.toLocaleString()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-900">{row.label}</span>
                    <span className="block text-xs text-ink-500">{row.detail}</span>
                  </span>
                  {row.tab && onNavigate && <ArrowRight className="w-4 h-4 text-ink-900/30 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {clear.length > 0 && outstanding.length > 0 && (
          <p className="text-2xs text-ink-500 mt-3">
            Clear: {clear.map((row) => row.label.toLowerCase()).join(", ")}.
          </p>
        )}
      </section>

      {/* — the latest activity, for context rather than action — */}
      <section className="card p-6">
        <h3 className="font-display text-xl text-ink-900 mb-5">Latest trips</h3>
        {recentTrips.length === 0 ? (
          <p className="text-sm text-ink-500">No trips yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-500 border-b border-sand">
                  <th className="pb-3 font-medium">Traveller</th>
                  <th className="pb-3 font-medium">Route</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {recentTrips.map((t) => (
                  <tr key={t._id}>
                    <td className="py-3 font-medium text-ink-900">
                      {t.user_id?.name || <span className="text-ink-500">no longer exists</span>}
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
        <p className="text-2xs text-ink-500 mt-4">
          {analytics?.totalTrips?.toLocaleString()} trips in total — the Trips tab has all of them.
        </p>
      </section>
    </div>
  );
}
