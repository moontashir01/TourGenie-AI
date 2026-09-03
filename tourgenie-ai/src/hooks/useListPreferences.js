import { useCallback, useEffect, useMemo, useState } from "react";

// Phase 5 — the parts of an admin screen that should survive leaving it.
//
// Every list resets to page one, no search and every column on each time it
// is opened. That is fine for a screen visited once; it is a papercut on the
// one an admin lives in, who filters to the same thing every morning.
//
// All of it is per-browser: these are working preferences, not account
// settings, and putting them on the server would mean a migration and a
// round trip to answer a question the browser already knows.

const STORAGE_PREFIX = "tourgenie_admin";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // Private mode, cleared storage, or a value written by an older build.
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the preference simply doesn't persist.
  }
}

/**
 * Remembers one list's view (search term, filters, sort, page size) and any
 * views the admin has named and saved.
 *
 * @param {string} listKey  stable id for the screen, e.g. "catalogue:hotels"
 */
export function useSavedViews(listKey, list) {
  const [views, setViews] = useState(() => read(`views:${listKey}`, []));

  // The state worth restoring. Deliberately not the page number: coming back
  // to page 7 of a list that has changed underneath is disorienting.
  const current = useMemo(
    () => ({ term: list.term, filters: list.filters, sort: list.sort }),
    [list.term, list.filters, list.sort]
  );

  // The last view is restored on the next visit without being named.
  useEffect(() => {
    write(`last:${listKey}`, current);
  }, [listKey, current]);

  const save = useCallback(
    (name) => {
      const trimmed = String(name || "").trim();
      if (!trimmed) return;
      setViews((prev) => {
        // Saving over a name replaces it rather than making a second one.
        const next = [...prev.filter((v) => v.name !== trimmed), { name: trimmed, ...current }];
        write(`views:${listKey}`, next);
        return next;
      });
    },
    [listKey, current]
  );

  const remove = useCallback(
    (name) => {
      setViews((prev) => {
        const next = prev.filter((v) => v.name !== name);
        write(`views:${listKey}`, next);
        return next;
      });
    },
    [listKey]
  );

  const apply = useCallback(
    (view) => {
      list.setTerm(view.term || "");
      list.setFilters(view.filters || {});
      if (view.sort !== undefined) list.setSort(view.sort);
      list.setPage(1);
    },
    [list]
  );

  // True when nothing is filtered — the "Save this view" button has nothing
  // to save, and the reset button nothing to reset.
  const isDefault =
    !current.term && !current.sort && Object.values(current.filters || {}).every((v) => !v);

  return { views, save, remove, apply, isDefault };
}

/** The view the admin left this list in, for useAdminList's initial state. */
export function readLastView(listKey) {
  return read(`last:${listKey}`, null);
}

/**
 * Which columns a list shows. `columns` is the full set; the hook stores only
 * the hidden keys, so a column added to the app later shows up by default
 * instead of being invisible to everyone who ever opened the screen.
 */
export function useColumnPreferences(listKey, columns) {
  const [hidden, setHidden] = useState(() => read(`columns:${listKey}`, []));

  useEffect(() => {
    setHidden(read(`columns:${listKey}`, []));
  }, [listKey]);

  const toggle = useCallback(
    (key) => {
      setHidden((prev) => {
        const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        write(`columns:${listKey}`, next);
        return next;
      });
    },
    [listKey]
  );

  const reset = useCallback(() => {
    setHidden([]);
    write(`columns:${listKey}`, []);
  }, [listKey]);

  const visible = useMemo(() => columns.filter((c) => !hidden.includes(c.key)), [columns, hidden]);

  return { visible, hidden, toggle, reset };
}
