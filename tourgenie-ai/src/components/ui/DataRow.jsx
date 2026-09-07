// A label and its value. Four screens each had their own — the trip snapshot,
// the account panel, the booking summary, the printed itinerary — at four
// different label sizes, and only one of them set tabular numerals, so a
// column of figures lined up on one page and not on the next.
//
// Belongs inside a <dl>. `tone="inverse"` is for the ink panels, where the
// muted label is paper at low alpha rather than ink-500.

const LABEL = {
  default: "text-ink-500",
  inverse: "text-paper/50",
};

const VALUE = {
  default: "text-ink-900",
  inverse: "text-paper",
};

export default function DataRow({
  label,
  value,
  tone = "default",
  // Label above value instead of beside it — the right shape when the value
  // is an email or a timestamp that would otherwise wrap against its label.
  stacked = false,
  // Figures get tabular numerals; names and dates don't need them and look
  // worse spaced out.
  numeric = false,
  className = "",
  children,
}) {
  const shown = value ?? children;
  return (
    <div className={`${stacked ? "" : "flex items-baseline justify-between gap-4"} ${className}`}>
      <dt className={`${stacked ? "text-2xs" : ""} ${LABEL[tone] || LABEL.default}`}>{label}</dt>
      <dd
        className={`${VALUE[tone] || VALUE.default} ${numeric ? "tabular-nums" : ""} ${
          stacked ? "break-words" : "text-right"
        }`}
      >
        {shown}
      </dd>
    </div>
  );
}
