import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Database, Mail, Server } from "lucide-react";
import { adminApi } from "../../lib/api";
import { ErrorBanner } from "../../components/admin/ListShell";

// System health.
//
// Every integration in this app is optional: with no keys at all the database
// answers everything and the traveller-facing UI says the data is seeded. The
// price of that is that failure is invisible — a dead flight API, an
// unconfigured mailbox and a perfect deployment look identical from outside.
// This is the screen where they stop looking identical.

export default function Health() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .health()
      .then(setHealth)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking…
      </div>
    );
  }

  const db = health?.database || {};
  const missing = db.missing_reference_data || [];

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <section className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-1 flex items-center gap-2">
          <Database className="w-4 h-4 text-teal" /> Database
        </h3>
        <p className="text-sm text-ink-900/55 mb-5">
          {db.name || "—"} on {db.host || "—"} · {db.state}
        </p>

        {missing.length > 0 ? (
          <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 rounded-lg px-4 py-3 mb-5">
            <AlertTriangle className="w-4 h-4 text-sunset-dark mt-0.5 shrink-0" />
            <div className="text-sm text-sunset-dark">
              <p className="font-semibold mb-1">
                {missing.length} reference collection{missing.length === 1 ? " is" : "s are"} empty
              </p>
              <ul className="text-xs space-y-0.5">
                {missing.map((row) => (
                  <li key={row.collection}>
                    <span className="font-mono">{row.collection}</span> — {row.feature} answers nothing
                  </li>
                ))}
              </ul>
              <p className="text-xs mt-2">Run <span className="font-mono">npm run seed</span> to rebuild them.</p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-teal-dark mb-5">
            <CheckCircle2 className="w-4 h-4" /> Every reference collection the app reads from has data.
          </p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 max-h-72 overflow-y-auto pr-2">
          {(db.collections || []).map((collection) => (
            <div key={collection.name} className="flex items-baseline justify-between gap-2 text-sm border-b border-sand/60 py-1">
              <span className="font-mono text-xs text-ink-900/60 truncate">{collection.name}</span>
              <span className={`font-mono text-xs tabular-nums ${collection.count ? "text-ink-900/70" : "text-sunset-dark"}`}>
                {collection.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-900/45 mt-4 tabular-nums">
          {(db.total_documents || 0).toLocaleString()} documents across {(db.collections || []).length} collections
        </p>
      </section>

      <section className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-1">External providers</h3>
        <p className="text-sm text-ink-900/55 mb-5">
          All optional. Without a key the database answers instead, and the traveller-facing screens label the
          result as seeded — which is why a failing provider is otherwise silent.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Provider</th>
                <th className="pb-3 font-medium">Used for</th>
                <th className="pb-3 font-medium">Key</th>
                <th className="pb-3 font-medium">Last call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {(health?.providers || []).map((provider) => (
                <tr key={provider.key}>
                  <td className="py-3 font-medium text-ink-900">{provider.label}</td>
                  <td className="py-3 text-ink-900/60 text-xs">{provider.purpose}</td>
                  <td className="py-3">
                    {provider.configured ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-dark">
                        <CheckCircle2 className="w-3.5 h-3.5" /> set
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-900/40">
                        <MinusCircle className="w-3.5 h-3.5" /> not set
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-xs">
                    <LastCall call={provider.last_call} configured={provider.configured} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-900/40 mt-4">
          "Not called yet" is counted from this server process starting, not from the last deploy.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="card p-6">
          <h3 className="font-display text-lg text-ink-900 mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-teal" /> Outgoing email
          </h3>
          <dl className="space-y-2.5 text-sm">
            <Row label="Mode" value={health?.mail?.mode} warn={!health?.mail?.configured} />
            <Row label="Host" value={health?.mail?.host} />
            <Row label="From" value={health?.mail?.from || "—"} />
          </dl>
          {!health?.mail?.configured && (
            <p className="text-xs text-ink-900/55 mt-4">
              Password reset codes are written to the server log instead of being sent
              {health?.mail?.production ? " — which in production means nobody receives them." : "."}
            </p>
          )}
        </section>

        <section className="card p-6">
          <h3 className="font-display text-lg text-ink-900 mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-teal" /> Server and seed
          </h3>
          <dl className="space-y-2.5 text-sm">
            <Row label="Environment" value={health?.server?.env} />
            <Row label="Node" value={health?.server?.node} />
            <Row
              label="Up since"
              value={health?.server?.started_at ? new Date(health.server.started_at).toLocaleString() : "—"}
            />
            <Row label="Seed version" value={health?.seed?.version} />
            <Row
              label="Last seeded"
              value={health?.seed?.last_run ? new Date(health.seed.last_run).toLocaleString() : "unknown"}
            />
            <Row
              label="Latest snapshot"
              value={
                health?.seed?.latest_snapshot
                  ? `${health.seed.latest_snapshot.period_key} · computed ${new Date(
                      health.seed.latest_snapshot.computed_at
                    ).toLocaleString()}`
                  : "none"
              }
            />
          </dl>
        </section>
      </div>

      {health?.generated_at && (
        <p className="text-xs text-ink-900/40">Checked {new Date(health.generated_at).toLocaleString()}</p>
      )}
    </div>
  );
}

function LastCall({ call, configured }) {
  if (!configured) return <span className="text-ink-900/35">—</span>;
  if (!call) return <span className="text-ink-900/45">not called yet</span>;
  return (
    <span className={`inline-flex items-start gap-1.5 ${call.ok ? "text-teal-dark" : "text-sunset-dark"}`}>
      {call.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
      <span>
        {call.ok ? "worked" : "failed"} · {new Date(call.at).toLocaleTimeString()}
        {call.detail && <span className="block text-ink-900/50 max-w-xs">{call.detail}</span>}
      </span>
    </span>
  );
}

function Row({ label, value, warn }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-900/55 text-xs">{label}</dt>
      <dd className={`text-right ${warn ? "text-sunset-dark font-medium" : "text-ink-900/80"}`}>{value || "—"}</dd>
    </div>
  );
}
