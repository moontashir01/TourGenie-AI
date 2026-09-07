// The "Your trips ————— See all" row. AppShell already owns the page title,
// so this is deliberately the *second* level: the heading above a grid or a
// list, with its count and its one action.

export default function SectionHeader({ title, count, description, action, className = "" }) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-5 ${className}`}>
      <div className="min-w-0">
        <h2 className="font-display text-xl text-ink-900 flex items-baseline gap-2">
          {title}
          {/* The count is information, not decoration — it goes quiet next to
              the heading rather than becoming a second badge. */}
          {count !== undefined && <span className="text-sm font-body text-ink-500 tabular-nums">{count}</span>}
        </h2>
        {description && <p className="text-sm text-ink-600 mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
