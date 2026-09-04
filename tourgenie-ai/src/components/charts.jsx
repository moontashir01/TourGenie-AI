// Shared chart furniture, so every chart in the app reads as one system
// instead of several different hand-rolled looks. Recharts draws the
// geometry; the tokens these use live in lib/chartTheme.js.

/** Recharts' default tooltip is a plain white box; this matches the app's cards. */
export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface/95 backdrop-blur border border-sand rounded-xl shadow-lift px-3 py-2 text-xs">
      {label != null && (
        <p className="font-display text-ink-900 mb-1.5">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: entry.color || entry.payload?.fill }}
            />
            <span className="text-ink-900/60">{entry.name}</span>
            <span className="font-mono text-ink-900 ml-auto pl-3">
              {formatter ? formatter(entry.value, entry.name, entry) : entry.value?.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legend row shared by the donuts and the stacked bars. */
export function ChartLegend({ items, className = "" }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-900/60 ${className}`}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
          {item.label}
          {item.value != null && <span className="font-mono text-ink-900/80">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}
