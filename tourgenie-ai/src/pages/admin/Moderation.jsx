import { useCallback, useEffect, useState } from "react";
import { Check, EyeOff, Trash2, Loader2, Flag, Star, RefreshCw, ShieldCheck } from "lucide-react";
import { adminApi } from "../../lib/api";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, AdminSelect, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";
import Overlay from "../../components/ui/Overlay";
import Button from "../../components/ui/Button";

// FR-23 — moderation as a work queue.
//
// The Reviews tab lists everything ever posted; this lists only what is
// waiting for a decision — content the posting rules held, and content a
// traveller reported — oldest first, with the reason attached. Working from
// the top of this list is the whole job.

const REASON_LABELS = {
  spam: "Spam",
  abuse: "Abuse",
  misinformation: "Misinformation",
  off_topic: "Off topic",
  unsafe: "Unsafe",
  other: "Other",
};

const REPORT_STATUS = [
  { value: "open", label: "Open" },
  { value: "", label: "All" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
];

// Hiding or removing someone's writing asks for a reason, which the audit
// trail keeps. Approving does not — putting a post on the feed is what was
// supposed to happen anyway.
function DecisionPrompt({ target, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const removing = target.action === "remove";
  const needsReason = target.action !== "approve";

  return (
    <Overlay open onClose={onCancel} size="md" label="Moderation decision" dismissable={!busy} className="p-6">
        <h3 className="font-display text-lg text-ink-900 mb-1">
          {removing ? "Remove this permanently?" : target.action === "hide" ? "Hide this from the feed?" : "Put this on the feed?"}
        </h3>
        <p className="text-sm text-ink-900/60 mb-4">
          {removing
            ? "It is deleted for good. Hiding it is reversible; this is not."
            : target.action === "hide"
              ? "The author keeps it, but nobody else sees it. You can unhide it later."
              : "It becomes visible to everyone, and any open reports about it are closed."}
        </p>
        <blockquote className="text-xs text-ink-900/70 bg-paper border border-sand rounded-lg px-3 py-2.5 mb-4 max-h-24 overflow-y-auto">
          {target.excerpt}
        </blockquote>
        <label className="block mb-4">
          <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">
            {needsReason ? "Reason (recorded in the activity log)" : "Note (optional)"}
          </span>
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={needsReason ? "Spam, abuse, off-topic…" : "Nothing wrong with it"}
            className="input"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            // Approving isn't destructive, so it doesn't wear the danger ring.
            variant={target.action === "approve" ? "teal" : "danger"}
            loading={busy}
            disabled={needsReason && !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {removing ? "Remove" : target.action === "hide" ? "Hide" : "Approve"}
          </Button>
        </div>
    </Overlay>
  );
}

export default function Moderation() {
  const [queue, setQueue] = useState([]);
  const [counts, setCounts] = useState({ pending_posts: 0, pending_reviews: 0, open_reports: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [prompt, setPrompt] = useState(null);

  const reports = useAdminList(adminApi.reports, { status: "open" }, { listKey: "moderation:reports" });

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .moderationQueue(50)
      .then((data) => {
        setQueue(data.rows || []);
        setCounts(data.counts || {});
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function decide(entry, action, reason) {
    setBusyId(entry._id);
    try {
      if (entry.kind === "post") await adminApi.moderatePost(entry._id, action, reason);
      else await adminApi.moderateReview(entry._id, action, reason);
      load();
      // A decision closes the reports behind it, so that list moves too.
      reports.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
      setPrompt(null);
    }
  }

  async function closeReport(id, status) {
    try {
      await adminApi.resolveReport(id, status, status === "dismissed" ? "No action needed" : "Handled");
      reports.reload();
      load();
    } catch (err) {
      reports.setError(err.message);
    }
  }

  const total = (counts.pending_posts || 0) + (counts.pending_reviews || 0) + (counts.open_reports || 0);

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="grid sm:grid-cols-3 gap-5">
        <Stat label="Posts held" value={counts.pending_posts ?? 0} />
        <Stat label="Reviews held" value={counts.pending_reviews ?? 0} />
        <Stat label="Open reports" value={counts.open_reports ?? 0} />
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="font-display text-lg text-ink-900">Waiting for a decision</h3>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900/60 hover:text-teal-dark"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <p className="text-sm text-ink-900/55 mb-5">
          Oldest first. Approving puts it on the feed and closes any reports about it.
        </p>

        {loading && queue.length === 0 ? (
          <div className="flex items-center gap-2 text-ink-900/50 text-sm py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading the queue…
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-8 h-8 text-teal mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-ink-900/60">Nothing is waiting. {total === 0 ? "The queue is empty." : ""}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {queue.map((entry) => (
              <li
                key={`${entry.kind}-${entry._id}`}
                className={`border border-sand rounded-xl p-4 ${busyId === entry._id ? "opacity-50" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 flex items-center gap-2">
                      {entry.kind === "post" ? entry.subject : (
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-gold fill-current" /> {entry.rating} · {entry.subject}
                        </span>
                      )}
                      <span className="text-2xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-sand text-ink-900/60">
                        {entry.kind}
                      </span>
                    </p>
                    <p className="text-xs text-ink-900/50 mt-0.5">
                      {entry.author?.name || "deleted account"} · {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-2xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-gold/15 text-ink-900/70 shrink-0">
                    {entry.trigger}
                  </span>
                </div>

                <p className="text-sm text-ink-900/80 leading-relaxed mb-3">{entry.excerpt}</p>

                {entry.reports.length > 0 && (
                  <ul className="space-y-1.5 mb-3 border-l-2 border-sunset/30 pl-3">
                    {entry.reports.map((report) => (
                      <li key={report._id} className="text-xs text-ink-900/60">
                        <Flag className="w-3 h-3 inline mr-1 text-sunset-dark" />
                        <span className="font-semibold">{REASON_LABELS[report.reason] || report.reason}</span>
                        {report.details ? ` — ${report.details}` : ""}
                        <span className="text-ink-900/35"> · {report.reporter_email}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2">
                  <QueueAction
                    icon={Check}
                    label="Approve"
                    tone="teal"
                    disabled={busyId === entry._id}
                    onClick={() => setPrompt({ ...entry, action: "approve" })}
                  />
                  <QueueAction
                    icon={EyeOff}
                    label="Hide"
                    tone="gold"
                    disabled={busyId === entry._id}
                    onClick={() => setPrompt({ ...entry, action: "hide" })}
                  />
                  <QueueAction
                    icon={Trash2}
                    label="Remove"
                    tone="sunset"
                    disabled={busyId === entry._id}
                    onClick={() => setPrompt({ ...entry, action: "remove" })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-1">Reports</h3>
        <p className="text-sm text-ink-900/55 mb-4">
          Every complaint a traveller has raised, and what was done about it.
        </p>
        <ErrorBanner message={reports.error} onDismiss={() => reports.setError("")} />
        <AdminToolbar list={reports} placeholder="Search reporter, content or resolution…">
          <AdminSelect
            label="Status"
            value={reports.filters.status}
            onChange={(v) => reports.setFilter("status", v)}
            options={REPORT_STATUS}
          />
        </AdminToolbar>

        <ListState list={reports} empty="No reports match that." />

        {reports.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                  <th className="pb-3 font-medium">Raised</th>
                  <th className="pb-3 font-medium">Reporter</th>
                  <th className="pb-3 font-medium">Reason</th>
                  <th className="pb-3 font-medium">Content</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {reports.rows.map((report) => (
                  <tr key={report._id}>
                    <td className="py-3 text-ink-900/60 text-xs whitespace-nowrap">
                      {new Date(report.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-ink-900/70 text-xs">
                      {report.reporter_id?.name || report.reporter_email || "deleted account"}
                    </td>
                    <td className="py-3 text-ink-900/70">
                      {REASON_LABELS[report.reason] || report.reason}
                      {report.details && (
                        <span className="block text-xs text-ink-900/45 max-w-xs truncate" title={report.details}>
                          {report.details}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-ink-900/70 max-w-xs truncate" title={report.target_label}>
                      {report.target_label}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-2xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                          report.status === "open"
                            ? "bg-sunset-light text-sunset-dark"
                            : "bg-teal-light text-teal-dark"
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {report.status === "open" ? (
                        <button
                          type="button"
                          onClick={() => closeReport(report._id, "dismissed")}
                          className="text-xs font-semibold text-ink-900/60 hover:text-teal-dark"
                        >
                          Dismiss
                        </button>
                      ) : (
                        <span className="text-xs text-ink-900/35">
                          {report.resolved_by?.name || "closed"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={reports} />
      </section>

      {prompt && (
        <DecisionPrompt
          target={prompt}
          busy={busyId === prompt._id}
          onCancel={() => setPrompt(null)}
          onConfirm={(reason) => decide(prompt, prompt.action, reason)}
        />
      )}
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

const TONES = {
  teal: "border-teal/40 text-teal-dark hover:bg-teal-light",
  gold: "border-gold/40 text-gold hover:bg-gold/10",
  sunset: "border-sunset/40 text-sunset-dark hover:bg-sunset-light",
};

function QueueAction({ icon: Icon, label, tone, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${TONES[tone]}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
