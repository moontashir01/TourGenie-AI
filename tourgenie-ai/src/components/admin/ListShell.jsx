import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2, Search, Bookmark, X, Columns3 } from "lucide-react";
import { useSavedViews } from "../../hooks/useListPreferences";

// The chrome every admin list shares: a search box, a filter row, an error
// banner, empty and loading states, and the pager. Pairs with useAdminList,
// so a screen supplies its columns and its actions and nothing else.

/**
 * Keyboard shortcuts, scoped to the admin portal.
 *
 * Everything an admin does repeatedly — search, page, clear — needed the
 * mouse. These are the four that matter, and each is ignored while the
 * caret is in a field, so typing "/" into a search box types a slash.
 */
function useListKeys(list, searchRef) {
  useEffect(() => {
    function onKey(event) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);

      // Escape works from inside the search box too — it is how you get out.
      if (event.key === "Escape" && target === searchRef.current) {
        list.setTerm("");
        target.blur();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "[" || event.key === "ArrowLeft") {
        if (list.page > 1) list.setPage(list.page - 1);
      } else if (event.key === "]" || event.key === "ArrowRight") {
        if (list.page < list.pages) list.setPage(list.page + 1);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, searchRef]);
}

export function AdminToolbar({ list, placeholder = "Search…", children }) {
  const searchRef = useRef(null);
  useListKeys(list, searchRef);

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 flex-1 min-w-56 bg-paper border border-sand rounded-lg px-3 focus-within:border-teal">
          <Search className="w-4 h-4 text-ink-900/30 shrink-0" />
          <input
            ref={searchRef}
            type="search"
            value={list.term}
            onChange={(e) => list.setTerm(e.target.value)}
            placeholder={placeholder}
            className="bg-transparent text-sm text-ink-900 py-2 w-full focus:outline-none placeholder:text-ink-900/30"
          />
          <kbd className="hidden sm:block text-3xs text-ink-900/30 border border-sand rounded px-1.5 py-0.5 shrink-0">
            /
          </kbd>
        </label>
        {children}
        <span className="text-xs text-ink-900/45 ml-auto tabular-nums">
          {list.loading ? "…" : `${list.total} result${list.total === 1 ? "" : "s"}`}
        </span>
      </div>
      {list.listKey && <SavedViews list={list} />}
    </div>
  );
}

/**
 * Named filter sets, per browser.
 *
 * An admin who opens the same list every morning and filters it the same way
 * had to rebuild that filter every time. The last view comes back on its own
 * (useAdminList restores it); this is for the two or three worth naming.
 */
function SavedViews({ list }) {
  const { views, save, remove, apply, isDefault } = useSavedViews(list.listKey, list);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  if (views.length === 0 && isDefault) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <Bookmark className="w-3.5 h-3.5 text-ink-900/30" />
      {views.map((view) => (
        <span
          key={view.name}
          className="inline-flex items-center gap-1 text-xs font-medium bg-paper border border-sand rounded-full pl-3 pr-1.5 py-1"
        >
          <button type="button" onClick={() => apply(view)} className="text-ink-900/70 hover:text-teal-dark">
            {view.name}
          </button>
          <button
            type="button"
            onClick={() => remove(view.name)}
            aria-label={`Forget the ${view.name} view`}
            className="text-ink-900/30 hover:text-sunset-dark"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {naming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(name);
            setName("");
            setNaming(false);
          }}
          className="inline-flex items-center gap-1"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNaming(false)}
            placeholder="Name this view"
            className="text-xs bg-paper border border-sand rounded-full px-3 py-1 focus:outline-none focus:border-teal"
          />
        </form>
      ) : (
        !isDefault && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="text-xs font-semibold text-ink-900/45 hover:text-teal-dark px-2 py-1"
          >
            Save this view
          </button>
        )
      )}

      {!isDefault && (
        <button
          type="button"
          onClick={list.reset}
          className="text-xs text-ink-900/40 hover:text-ink-900 px-2 py-1"
        >
          Clear filters
        </button>
      )}
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

/**
 * Show and hide columns, remembered per list. Only the hidden ones are
 * stored, so a column added to the app later appears for everyone rather
 * than staying invisible to anyone who used the screen before it existed.
 */
export function ColumnPicker({ columns, hidden, onToggle, onReset }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm text-ink-900/70 bg-paper border border-sand rounded-lg px-3 py-2 hover:border-teal"
      >
        <Columns3 className="w-4 h-4" />
        Columns
        {hidden.length > 0 && <span className="text-xs text-ink-900/40">({columns.length - hidden.length})</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-surface border border-sand rounded-xl shadow-lift p-2">
            {columns.map((column) => (
              <label
                key={column.key}
                className="flex items-center gap-2 text-sm text-ink-900/75 px-2 py-1.5 rounded-lg hover:bg-paper cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!hidden.includes(column.key)}
                  onChange={() => onToggle(column.key)}
                  className="accent-teal"
                />
                {column.label}
              </label>
            ))}
            {hidden.length > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="w-full text-left text-xs text-ink-900/45 hover:text-teal-dark px-2 py-1.5 border-t border-sand mt-1 pt-2"
              >
                Show all columns
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** A sortable table header. Silent when the list has no sort support. */
export function SortableHeader({ list, field, children, className = "" }) {
  if (!field || !list.toggleSort) {
    return <th className={`pb-3 font-medium ${className}`}>{children}</th>;
  }
  const active = list.sort === field || list.sort === `-${field}`;
  const descending = list.sort === `-${field}`;

  return (
    <th className={`pb-3 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => list.toggleSort(field)}
        className={`inline-flex items-center gap-0.5 hover:text-ink-900 ${active ? "text-ink-900" : ""}`}
      >
        {children}
        {active &&
          (descending ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
      </button>
    </th>
  );
}

export function Pager({ list }) {
  if (list.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-sand">
      <p className="text-xs text-ink-900/50 tabular-nums">
        Page {list.page} of {list.pages}
        <span className="hidden sm:inline text-ink-900/30"> · [ and ] to move</span>
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
