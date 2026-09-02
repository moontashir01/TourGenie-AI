import { useEffect, useState } from "react";
import { Droplets, Thermometer, Sun } from "lucide-react";
import { destinationsApi } from "../lib/api";

// "Best time to visit" — the twelve monthly climate normals as one strip.
//
// This answers a different question from the forecast: not "what will the
// sky do on the 14th" but "which months is this place actually good in".
// The data is described climate, so it is stable and worth showing a year
// at a time.
//
// Pass `months`/`summary` when the caller already has them (the comparison
// page fetches all its columns in one request); pass `slug` to have the
// strip fetch its own.

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Three bands rather than two: a month can be travellable without being the
// month you would choose, and flattening that loses the useful part.
function band(month) {
  if (!month.is_good_for_travel) return "avoid";
  if (month.rain_days >= 8 || month.temp_max_c >= 35) return "shoulder";
  return "ideal";
}

const BAND_STYLE = {
  ideal: { bar: "bg-teal", label: "Ideal", chip: "bg-teal-light text-teal-dark" },
  shoulder: { bar: "bg-gold", label: "Mixed", chip: "bg-gold/20 text-ink-800" },
  avoid: { bar: "bg-sunset", label: "Avoid", chip: "bg-sunset-light text-sunset-dark" },
};

export default function BestTimeStrip({ months: monthsProp, summary: summaryProp, slug, compact = false }) {
  const [months, setMonths] = useState(monthsProp || []);
  const [summary, setSummary] = useState(summaryProp || null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(Boolean(slug) && !monthsProp);

  useEffect(() => {
    if (monthsProp) {
      setMonths(monthsProp);
      setSummary(summaryProp || null);
      return;
    }
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    destinationsApi
      .climate(slug)
      .then((res) => {
        if (cancelled) return;
        setMonths(res.months || []);
        setSummary(res.summary || null);
      })
      .catch(() => {
        if (!cancelled) setMonths([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug, monthsProp, summaryProp]);

  if (loading) {
    return <div className="h-20 rounded-xl bg-sand/40 animate-pulse" />;
  }
  if (months.length === 0) {
    return (
      <p className="text-xs text-ink-900/40 py-3">
        No climate data recorded for this destination yet.
      </p>
    );
  }

  const currentMonth = new Date().getUTCMonth() + 1;
  // Bar heights are relative to the wettest month, so the shape of the
  // monsoon is visible rather than every bar looking the same.
  const maxRain = Math.max(...months.map((m) => m.rain_mm), 1);
  const detail = selected ? months.find((m) => m.month === selected) : null;

  return (
    <div>
      <div className="flex items-end gap-1">
        {months.map((m) => {
          const style = BAND_STYLE[band(m)];
          const isNow = m.month === currentMonth;
          const isSelected = m.month === selected;
          // Floor keeps a dry month visible as a sliver instead of nothing.
          const height = 14 + Math.round((m.rain_mm / maxRain) * (compact ? 22 : 38));
          return (
            <button
              key={m.month}
              type="button"
              onClick={() => setSelected(isSelected ? null : m.month)}
              title={`${MONTH_NAMES[m.month - 1]} — ${style.label}`}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              <span
                className={`w-full rounded-t-md transition-all duration-150 ${style.bar} ${
                  isSelected ? "ring-2 ring-ink-900/30" : "group-hover:opacity-80"
                }`}
                style={{ height: `${height}px` }}
              />
              <span
                className={`text-[10px] leading-none font-mono ${
                  isNow ? "text-ink-900 font-bold" : "text-ink-900/40"
                }`}
              >
                {MONTHS[m.month - 1]}
              </span>
            </button>
          );
        })}
      </div>

      {summary && (
        <p className="mt-2.5 text-xs text-ink-900/70">
          <span className="font-semibold text-teal-dark">Best: {summary.best_months_label}</span>
          {summary.peak_season && <span className="text-ink-900/45"> · peak {summary.peak_season}</span>}
        </p>
      )}

      {detail && (
        <div className="mt-2 p-3 rounded-xl bg-surface border border-sand animate-pop-in">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-semibold text-sm text-ink-900">{MONTH_NAMES[detail.month - 1]}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${BAND_STYLE[band(detail)].chip}`}>
              {BAND_STYLE[band(detail)].label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-900/70">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-sunset-dark" />
              {detail.temp_min_c}–{detail.temp_max_c} °C
            </span>
            <span className="flex items-center gap-1">
              <Droplets className="w-3 h-3 text-teal-dark" />
              {detail.rain_mm} mm over {detail.rain_days} days
            </span>
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-gold" />
              UV {detail.uv_index}
            </span>
          </div>
          {detail.travel_advice && (
            <p className="mt-2 text-xs text-ink-900/60 leading-relaxed">{detail.travel_advice}</p>
          )}
        </div>
      )}

      {!compact && !detail && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-ink-900/45">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal" /> Ideal</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gold" /> Mixed</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sunset" /> Avoid</span>
          <span className="ml-auto">Bar height = monthly rainfall · tap a month</span>
        </div>
      )}
    </div>
  );
}
