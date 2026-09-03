import { useCallback, useEffect, useRef, useState } from "react";
import { readLastView } from "./useListPreferences";

// Every admin list behaves the same way, so the fetching lives here once:
// debounced search, paging, sort, filters, and a reload that keeps the
// current page. A new admin screen is then a fetcher plus a column
// definition, not another hand-rolled 150-line page.
//
//   const list = useAdminList(adminApi.users, { role: "" }, { listKey: "users" });
//   list.rows, list.total, list.page, list.setPage, list.setTerm, …
//
// Passing a `listKey` makes the view survive leaving the screen: the search,
// filters and sort an admin left it in are restored on the next visit, and
// saved views can be named against the same key (see useListPreferences).

const SEARCH_DEBOUNCE_MS = 300;

export default function useAdminList(fetcher, initialFilters = {}, { limit = 25, sort = "", listKey = "" } = {}) {
  // The defaults this list was declared with, captured once — the caller
  // passes an object literal, which is a new object on every render.
  const defaults = useRef({ filters: initialFilters, sort });
  // Read once, not on every render — useRef's argument is evaluated each time
  // even though only the first value is kept, and this one touches storage.
  const restoredRef = useRef(undefined);
  if (restoredRef.current === undefined) restoredRef.current = listKey ? readLastView(listKey) : null;
  const restored = restoredRef.current;

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [term, setTerm] = useState(restored?.term || "");
  const [debouncedTerm, setDebouncedTerm] = useState(restored?.term || "");
  const [filters, setFilters] = useState(restored?.filters || initialFilters);
  const [sortBy, setSort] = useState(restored?.sort || sort);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [term]);

  // A new search or filter starts again at page one — staying on page 7 of a
  // result set that now has two pages shows an empty table.
  useEffect(() => {
    setPage(1);
  }, [debouncedTerm, filters, sortBy]);

  // Screens that swap what they are listing (the catalogue's seven
  // collections) keep one hook. Each has its own remembered view, so
  // switching restores that collection's rather than carrying the last one
  // across — a search for "Dhaka" left over on the airports tab reads as an
  // empty catalogue.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const saved = listKey ? readLastView(listKey) : null;
    setTerm(saved?.term || "");
    setDebouncedTerm(saved?.term || "");
    setFilters(saved?.filters || defaults.current.filters);
    setSort(saved?.sort || defaults.current.sort);
    setPage(1);
  }, [listKey]);

  // The latest request wins: a slow page 1 must not overwrite a fast page 2.
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    fetcher({ q: debouncedTerm, page, limit, sort: sortBy, ...filters })
      .then((data) => {
        if (id !== requestId.current) return;
        setRows(data.rows || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setError("");
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [fetcher, debouncedTerm, page, limit, sortBy, filters]);

  useEffect(load, [load]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Clicking a column header: same field flips direction, a new field starts
  // ascending. The server ignores any field it hasn't allowed.
  const toggleSort = useCallback((field) => {
    setSort((prev) => (prev === field ? `-${field}` : prev === `-${field}` ? "" : field));
  }, []);

  const reset = useCallback(() => {
    setTerm("");
    setFilters(defaults.current.filters);
    setSort(defaults.current.sort);
    setPage(1);
  }, []);

  return {
    rows,
    total,
    page,
    pages,
    limit,
    loading,
    error,
    setError,
    term,
    setTerm,
    filters,
    setFilter,
    setFilters,
    sort: sortBy,
    setSort,
    toggleSort,
    setPage,
    reset,
    listKey,
    reload: load,
  };
}
