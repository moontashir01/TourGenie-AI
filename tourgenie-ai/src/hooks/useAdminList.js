import { useCallback, useEffect, useRef, useState } from "react";

// Every admin list behaves the same way, so the fetching lives here once:
// debounced search, paging, sort, filters, and a reload that keeps the
// current page. A new admin screen is then a fetcher plus a column
// definition, not another hand-rolled 150-line page.
//
//   const list = useAdminList(adminApi.users, { role: "" });
//   list.rows, list.total, list.page, list.setPage, list.setTerm, …

const SEARCH_DEBOUNCE_MS = 300;

export default function useAdminList(fetcher, initialFilters = {}, { limit = 25, sort = "" } = {}) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [filters, setFilters] = useState(initialFilters);
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
  }, [debouncedTerm, filters]);

  // The latest request wins: a slow page 1 must not overwrite a fast page 2.
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    fetcher({ q: debouncedTerm, page, limit, sort, ...filters })
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
  }, [fetcher, debouncedTerm, page, limit, sort, filters]);

  useEffect(load, [load]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
    setPage,
    reload: load,
  };
}
