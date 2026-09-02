import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

// The chrome every admin list shares: a search box, a filter row, an error
// banner, empty and loading states, and the pager. Pairs with useAdminList,
// so a screen supplies its columns and its actions and nothing else.

export function AdminToolbar({ list, placeholder = "Search…", children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <label className="flex items-center gap-2 flex-1 min-w-56 bg-paper border border-sand rounded-lg px-3 focus-within:border-teal">
        <Search className="w-4 h-4 text-ink-900/30 shrink-0" />
        <input
          type="search"
          value={list.term}
          onChange={(e) => list.setTerm(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-sm text-ink-900 py-2 w-full focus:outline-none placeholder:text-ink-900/30"
        />
      </label>
      {children}
      <span className="text-xs text-ink-900/45 ml-auto tabular-nums">
        {list.loading ? "…" : `${list.total} result${list.total === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}

export function AdminSelect({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="bg-paper border border-sand rounded-lg text-sm text-ink-900 px-3 py-2 focus:outline-none focus:border-teal"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Pager({ list }) {
  if (list.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-sand">
      <p className="text-xs text-ink-900/50 tabular-nums">
        Page {list.page} of {list.pages}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => list.setPage(Math.max(1, list.page - 1))}
          disabled={list.page <= 1}
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-sand text-ink-900/70 hover:border-teal disabled:opacity-40 disabled:hover:border-sand"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>
        <button
          type="button"
          onClick={() => list.setPage(Math.min(list.pages, list.page + 1))}
          disabled={list.page >= list.pages}
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-sand text-ink-900/70 hover:border-teal disabled:opacity-40 disabled:hover:border-sand"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Loading, error and empty states, so no screen has to spell them out. */
export function ListState({ list, empty = "Nothing here yet." }) {
  if (list.loading && list.rows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-ink-900/50 text-sm py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!list.loading && list.rows.length === 0) {
    return <p className="text-sm text-ink-900/50 text-center py-10">{empty}</p>;
  }
  return null;
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-4">
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-xs font-semibold underline">
          Dismiss
        </button>
      )}
    </div>
  );
}
