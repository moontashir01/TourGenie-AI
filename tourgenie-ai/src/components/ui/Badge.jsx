// The status pill, which sixteen files were spelling out by hand — and four
// of them kept their own copy of the same trip-status map, so `active` was
// gold in the sidebar and sunset on the dashboard for no reason anyone
// intended. STATUS_TONE below is now the one map.

const TONES = {
  neutral: "bg-sand text-ink-900/60",
  teal: "bg-teal-light text-teal-dark",
  sunset: "bg-sunset-light text-sunset-dark",
  gold: "bg-gold/25 text-ink-800",
  // For anything finished or inactive — present, deliberately quiet.
  muted: "bg-ink-900/10 text-ink-900/50",
  outline: "bg-surface text-ink-900/45 border border-sand",
};

// The four chip sizes actually in use across the app, measured off the
// existing markup rather than invented — 9px in the sidebar, 10px on inline
// meta, 11px in tables and cards, 12px where a badge is the main label.
const SIZES = {
  xs: "text-4xs px-1.5 py-0.5 font-bold",
  sm: "text-3xs px-2 py-0.5 font-semibold",
  md: "text-2xs px-2 py-1 font-semibold",
  lg: "text-xs px-2.5 py-1 font-semibold",
};

/** Trip status → tone. One map, so the sidebar and the dashboard agree. */
export const STATUS_TONE = {
  draft: "neutral",
  planned: "teal",
  active: "sunset",
  completed: "muted",
};

export default function Badge({
  tone = "neutral",
  size = "sm",
  // Separate from size, because the app uppercases a *status* at every size
  // and never uppercases a count or a name.
  uppercase = false,
  icon: Icon,
  className = "",
  children,
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full whitespace-nowrap",
        uppercase ? "uppercase tracking-wide" : "",
        TONES[tone] || TONES.neutral,
        SIZES[size] || SIZES.sm,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

/** The same pill keyed straight off a trip's status field. */
export function StatusBadge({ status = "draft", label, size = "xs", className = "" }) {
  return (
    <Badge tone={STATUS_TONE[status] || "neutral"} size={size} uppercase className={className}>
      {label || status}
    </Badge>
  );
}
