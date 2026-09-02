import { useState } from "react";
import { CloudRain, ArrowRight, Loader2, Check, ChevronDown, Sun, Shuffle, Repeat } from "lucide-react";
import { weatherApi } from "../lib/api";

// FR-05 × FR-11 × FR-12 — the rainy-day rewrite, on the page it affects.
//
// Preview first, apply second: the traveler sees every proposed change and
// the forecast that justifies it before anything is written. Both answers
// come from the database — no AI provider is involved, so this works with
// no keys configured and gives the same answer twice.

const KIND = {
  substitute: { icon: Shuffle, label: "Swapped for an indoor alternative" },
  reschedule: { icon: Repeat, label: "Traded with an indoor activity on a dry day" },
};

export default function RainyDayPlan({ tripId, onApplied }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  async function preview() {
    if (!open) setOpen(true);
    setLoading(true);
    setError("");
    try {
      setPlan(await weatherApi.swap(tripId, false));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setApplying(true);
    setError("");
    try {
      const result = await weatherApi.swap(tripId, true);
      setPlan(result);
      onApplied?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={preview}
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900/50 hover:text-teal-dark"
      >
        <CloudRain className="w-4 h-4" /> What if it rains?
      </button>
    );
  }

  const hasSwaps = plan?.swaps?.length > 0;

  return (
    <div className="w-full p-4 bg-surface border border-sand rounded-2xl">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-teal-light flex items-center justify-center shrink-0">
          <CloudRain className="w-4 h-4 text-teal-dark" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base text-ink-900">Rainy day plan</h3>
          {loading ? (
            <p className="flex items-center gap-2 mt-1 text-xs text-ink-900/50">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking the forecast…
            </p>
          ) : (
            <p className="text-sm text-ink-900/70 leading-relaxed mt-1">{plan?.summary}</p>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-900/30 hover:text-ink-900/60 shrink-0"
          aria-label="Close"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-sunset-dark">{error}</p>}

      {plan?.rainy_days?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {plan.rainy_days.map((d) => (
            <span
              key={d.day}
              title={`${d.city} · ${d.description}${d.rain_chance_pct != null ? ` · ${d.rain_chance_pct}%` : ""}`}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                d.severe ? "bg-sunset-light text-sunset-dark" : "bg-teal-light text-teal-dark"
              }`}
            >
              Day {d.day} · {d.description}
            </span>
          ))}
        </div>
      )}

      {hasSwaps && (
        <ul className="mt-3 space-y-2">
          {plan.swaps.map((s) => {
            const meta = KIND[s.kind] || KIND.substitute;
            const Icon = meta.icon;
            return (
              <li key={s.item_id} className="flex items-start gap-2.5 p-2.5 bg-paper border border-sand rounded-xl">
                <Icon className="w-3.5 h-3.5 text-teal-dark shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="text-ink-900/45 font-mono text-[10px]">
                    Day {s.day} · {s.time}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="text-ink-900/55 line-through">{s.from.activity}</span>
                    <ArrowRight className="w-3 h-3 text-ink-900/30 shrink-0" />
                    <span className="font-semibold text-ink-900">{s.to.activity}</span>
                  </p>
                  <p className="text-[10px] text-ink-900/40 mt-0.5">{meta.label}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {plan?.unmatched?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {plan.unmatched.map((u) => (
            <li key={u.item_id} className="text-[11px] text-ink-900/45 leading-relaxed">
              · Day {u.day} {u.time} — <span className="text-ink-900/60">{u.activity}</span>: {u.reason}
            </li>
          ))}
        </ul>
      )}

      {hasSwaps && !plan.applied && (
        <button
          onClick={apply}
          disabled={applying}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-teal text-white hover:bg-teal-dark disabled:opacity-60 transition-colors"
        >
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Apply these changes
        </button>
      )}

      {plan?.applied && (
        <p className="flex items-center gap-1.5 mt-4 text-xs font-semibold text-teal-dark">
          <Check className="w-3.5 h-3.5" /> Applied — your itinerary has been updated.
        </p>
      )}

      {plan && !hasSwaps && plan.rainy_days.length === 0 && (
        <p className="flex items-center gap-1.5 mt-3 text-xs text-ink-900/50">
          <Sun className="w-3.5 h-3.5 text-gold" /> Nothing to change.
        </p>
      )}
    </div>
  );
}
