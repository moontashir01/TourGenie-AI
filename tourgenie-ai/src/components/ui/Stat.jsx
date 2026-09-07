import useCountUp from "../../hooks/useCountUp";

// A figure with its label. The admin dashboard, the budget page and the trip
// header each had their own version of this tile at slightly different
// paddings, which is why the three screens never quite looked related.
//
// `value` takes either a number (tweened) or a node — the Money component
// does its own currency conversion and must not be turned into a raw float
// on the way through here.

const TONES = {
  default: "text-ink-900",
  teal: "text-teal-dark",
  sunset: "text-sunset-dark",
  muted: "text-ink-500",
};

export default function Stat({
  label,
  value,
  // How to render the tweened number — thousands separators, a unit, a
  // rounding rule. Without it a count-up shows fourteen decimal places.
  format = (n) => Math.round(n).toLocaleString(),
  hint,
  icon: Icon,
  tone = "default",
  className = "",
}) {
  const animated = useCountUp(value);
  const shown = typeof value === "number" ? format(animated) : value;

  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-500 shrink-0" aria-hidden />}
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      </div>
      {/* tabular-nums so a tweening figure doesn't jitter its own width as
          the digits change. */}
      <p className={`font-display text-2xl tabular-nums ${TONES[tone] || TONES.default}`}>{shown}</p>
      {hint && <p className="text-sm text-ink-500 mt-1">{hint}</p>}
    </div>
  );
}
