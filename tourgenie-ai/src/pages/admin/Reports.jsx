import { useEffect, useState } from "react";
import { Loader2, Download, ShieldAlert } from "lucide-react";
import { adminApi } from "../../lib/api";
import { ErrorBanner } from "../../components/admin/ListShell";
import ConfirmPrompt from "../../components/admin/ConfirmPrompt";

// Reports tab (wireframe 3.13).
//
// Two things changed here in Phase 4. The CSV is generated server-side and
// streamed — the browser no longer pages a whole collection down to join it
// locally — and the trend chart reads AnalyticsSnapshot instead of counting
// live, so it can cover 90 days without 90 aggregations.
//
// Personal columns (email addresses) are opt-in on every export, and every
// download writes an audit entry naming the report and its row count. An
// export that includes them also asks for the admin's password: the server
// refuses `include_personal=true` without a fresh confirmation, so the prompt
// below is what supplies it rather than a courtesy.

const METRICS = [
  { key: "users_new", label: "Sign-ups" },
  { key: "trips_created", label: "Trips created" },
  { key: "bookings_created", label: "Bookings" },
  { key: "bookings_value_bdt", label: "Booking value (৳)" },
  { key: "posts_created", label: "Posts" },
  { key: "itineraries_generated", label: "Itineraries generated" },
];

const PERIODS = [
  { key: "day", limit: 30, label: "30 days" },
  { key: "day", limit: 90, label: "90 days" },
  { key: "month", limit: 12, label: "12 months" },
];

export default function Reports() {
  const [analytics, setAnalytics] = useState(null);
  const [moderation, setModeration] = useState(null);
  const [exports, setExports] = useState([]);
  const [trend, setTrend] = useState(null);
  const [period, setPeriod] = useState(0);
  const [metric, setMetric] = useState("trips_created");
  const [includePersonal, setIncludePersonal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [passwordFor, setPasswordFor] = useState(""); // report key awaiting confirmation
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([adminApi.analytics(), adminApi.moderationStats(), adminApi.exports.list()])
      .then(([a, m, e]) => {
        setAnalytics(a);
        setModeration(m);
        setExports(e.reports || []);
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

  // Without email addresses this runs straight away; with them it goes
  // through the password prompt first.
  function startExport(key) {
    setError("");
    setNotice("");
    if (includePersonal) return setPasswordFor(key);
    runExport(key);
  }

  async function runExport(key, reauthToken) {
    setExporting(key);
    try {
      const { filename } = await adminApi.exports.run(key, { includePersonal, reauthToken });
      setNotice(`Downloaded ${filename}. The download is recorded in the activity log.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting("");
    }
  }

  // Thrown errors keep the prompt open with the message inside it, which is
  // what a mistyped password should do.
  async function confirmPersonalExport({ password }) {
    const { reauth_token } = await adminApi.reauth(password);
    const key = passwordFor;
    setPasswordFor("");
    await runExport(key, reauth_token);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-500 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Building reports…
      </div>
    );
  }

  const tripsByStatus = Object.entries(analytics?.tripsByStatus || {});
  const usersByRole = Object.entries(analytics?.usersByRole || {});
  const topDestinations = analytics?.topDestinations || [];
  const points = trend?.points || [];
  const max = Math.max(1, ...points.map((p) => p[metric] || 0));

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      {notice && (
        <div className="flex items-start gap-2 bg-teal-light border border-teal/30 text-teal-dark text-sm rounded-lg px-4 py-3">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      <div>
        <h3 className="font-display text-xl text-ink-900">Platform reports</h3>
        {analytics?.generated_at && (
          <p className="text-xs text-ink-500 mt-0.5">
            Counters computed {new Date(analytics.generated_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Stat label="Total trips" value={analytics?.totalTrips ?? 0} />
        <Stat label="Confirmed bookings" value={analytics?.bookingCount ?? 0} />
        <Stat label="Total budget planned" value={`৳${(analytics?.totalBudget || 0).toLocaleString()}`} />
        <Stat label="Avg budget / trip" value={`৳${(analytics?.avgBudget || 0).toLocaleString()}`} />
      </div>

      {/* — trends, from AnalyticsSnapshot — */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h4 className="font-display text-base text-ink-900">Trend</h4>
            <p className="text-xs text-ink-500 mt-0.5">
              From the daily roll-up, not counted live.
              {points.at(-1)?.computed_at && (
                <> Latest period computed {new Date(points.at(-1).computed_at).toLocaleString()}.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              aria-label="Metric"
              className="bg-paper border border-sand rounded-lg text-sm text-ink-900 px-3 py-2 focus:outline-none focus:border-teal"
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="flex rounded-full border border-sand overflow-hidden">
              {PERIODS.map((p, index) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPeriod(index)}
                  className={`text-xs font-semibold px-3 py-2 transition-colors ${
                    period === index ? "bg-teal text-paper-fixed" : "text-ink-600 hover:bg-paper"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {points.length === 0 ? (
          <p className="text-sm text-ink-500">No snapshots for that period yet.</p>
        ) : (
          <>
            <div className="flex items-end gap-[3px] h-44">
              {points.map((point, index) => {
                const value = point[metric] || 0;
                // The last point is today (or this month) — still being
                // written to, so it is shown lighter rather than read as a
                // sudden fall-off.
                const partial = index === points.length - 1;
                return (
                  <div
                    key={point.key}
                    title={`${point.key}: ${value.toLocaleString()}${partial ? " (so far)" : ""}`}
                    className="flex-1 flex flex-col justify-end h-full min-w-[3px]"
                  >
                    <div
                      className={`w-full rounded-t-sm min-h-[2px] ${partial ? "bg-teal/40" : "bg-teal"}`}
                      style={{ height: `${(value / max) * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-ink-500 mt-2">
              <span>{points[0]?.key}</span>
              <span className="tabular-nums">peak {max.toLocaleString()}</span>
              <span>{points.at(-1)?.key} (partial)</span>
            </div>
          </>
        )}
      </div>

      {/* — exports — */}
      <div className="card p-6">
        <h4 className="font-display text-base text-ink-900 mb-1">Exports</h4>
        <p className="text-sm text-ink-600 mb-4">
          Streamed from the database as CSV. Each download is recorded in the activity log.
        </p>

        <label className="flex items-start gap-2 bg-paper border border-sand rounded-lg px-4 py-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={includePersonal}
            onChange={(e) => setIncludePersonal(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-ink-900/70">
            <span className="font-medium text-ink-900 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-sunset-dark" /> Include email addresses
            </span>
            Off by default. An export is the easiest way for personal data to leave the system by accident.
          </span>
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          {exports.map((report) => (
            <button
              key={report.key}
              type="button"
              onClick={() => startExport(report.key)}
              disabled={Boolean(exporting)}
              className="flex items-center gap-3 text-left border border-sand rounded-xl px-4 py-3 hover:border-teal disabled:opacity-50 transition-colors"
            >
              {exporting === report.key ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-teal shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink-900 truncate">{report.label}</span>
                <span className="block text-xs text-ink-500 font-mono truncate">{report.key}.csv</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <BreakdownCard title="Trips by status" rows={tripsByStatus} total={analytics?.totalTrips || 0} />
        <BreakdownCard title="Users by role" rows={usersByRole} total={analytics?.totalUsers || 0} />
      </div>

      <div className="card p-6">
        <h4 className="font-display text-base text-ink-900 mb-5">Top destinations</h4>
        {topDestinations.length === 0 ? (
          <p className="text-sm text-ink-500">No trips yet.</p>
        ) : (
          <div className="space-y-3">
            {topDestinations.map((row) => {
              const peak = topDestinations[0].count || 1;
              return (
                <div key={row.destination} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-ink-900/70 truncate">{row.destination}</span>
                  <div className="flex-1 bg-sand/60 rounded-full h-3 overflow-hidden">
                    <div className="bg-teal h-full rounded-full" style={{ width: `${(row.count / peak) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-xs text-ink-600">{row.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h4 className="font-display text-base text-ink-900 mb-4">Moderation throughput</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-5">
          <MiniStat label="Open reports" value={moderation?.reports?.open ?? 0} />
          <MiniStat label="Posts held" value={moderation?.pending?.posts ?? 0} />
          <MiniStat label="Reviews held" value={moderation?.pending?.reviews ?? 0} />
          <MiniStat
            label="Closed in 30 days"
            value={
              (moderation?.resolved_last_30_days?.actioned || 0) +
              (moderation?.resolved_last_30_days?.dismissed || 0)
            }
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <MiniStat label="Hidden posts" value={analytics?.hiddenPosts ?? 0} />
          <MiniStat label="Hidden reviews" value={analytics?.hiddenReviews ?? 0} />
          <MiniStat label="Attractions listed" value={analytics?.attractionCount ?? 0} />
          <MiniStat label="Booking value" value={`৳${(analytics?.bookingValue || 0).toLocaleString()}`} />
        </div>
        {Object.keys(moderation?.by_reason || {}).length > 0 && (
          <p className="text-xs text-ink-500 mt-5">
            Reported for:{" "}
            {Object.entries(moderation.by_reason)
              .map(([reason, count]) => `${reason.replace("_", " ")} (${count})`)
              .join(", ")}
          </p>
        )}
      </div>

      {passwordFor && (
        <ConfirmPrompt
          title="Export email addresses?"
          description="This file carries travellers' email addresses out of the system. It is logged against your account."
          confirmLabel="Confirm and download"
          tone="danger"
          requireReason={false}
          requirePassword
          passwordNote="Personal data leaving the system is confirmed with your own password."
          onCancel={() => setPasswordFor("")}
          onConfirm={confirmPersonalExport}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-ink-500 mb-2">{label}</p>
      <p className="font-mono text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="font-mono text-xl font-semibold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500 mt-0.5">{label}</p>
    </div>
  );
}

function BreakdownCard({ title, rows, total }) {
  return (
    <div className="card p-6">
      <h4 className="font-display text-base text-ink-900 mb-4">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(([key, count]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="capitalize text-ink-900/70">{key}</span>
              <span className="font-mono text-ink-600">
                {count}
                <span className="text-ink-500"> · {total ? Math.round((count / total) * 100) : 0}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
