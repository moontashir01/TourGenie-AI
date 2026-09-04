import { useEffect, useRef, useState } from "react";
import { Search, User, MapPin, Ticket, MessageSquare, Loader2 } from "lucide-react";
import { adminApi } from "../../lib/api";

// One box for the question most admin work starts with: who is
// rahim@example.com, what is TG-8F3K2A, which trips go to Sajek. Choosing a
// tab first is a step that shouldn't exist.
const GROUPS = [
  { key: "users", label: "People", icon: User },
  { key: "trips", label: "Trips", icon: MapPin },
  { key: "bookings", label: "Bookings", icon: Ticket },
  { key: "posts", label: "Posts", icon: MessageSquare },
];

export default function GlobalSearch({ onPickUser, onPickTrip }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const requestId = useRef(0);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults(null);
      return undefined;
    }
    const id = setTimeout(() => {
      const mine = ++requestId.current;
      setLoading(true);
      adminApi
        .search(query)
        .then((data) => {
          // A slow earlier keystroke must not overwrite a newer answer.
          if (mine === requestId.current) setResults(data);
        })
        .catch(() => {
          if (mine === requestId.current) setResults(null);
        })
        .finally(() => {
          if (mine === requestId.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(id);
  }, [term]);

  // Click-away and Escape, so it behaves like a menu.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(action) {
    setOpen(false);
    setTerm("");
    setResults(null);
    action();
  }

  const total = results ? GROUPS.reduce((sum, g) => sum + (results[g.key]?.length || 0), 0) : 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <label className="flex items-center gap-2 bg-surface border border-sand rounded-xl px-3 focus-within:border-teal">
        <Search className="w-4 h-4 text-ink-900/30 shrink-0" />
        <input
          type="search"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search people, trips, bookings…"
          className="bg-transparent text-sm text-ink-900 py-2.5 w-full focus:outline-none placeholder:text-ink-900/30"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-ink-900/30 animate-spin shrink-0" />}
      </label>

      {open && results && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-surface border border-sand rounded-2xl shadow-lift overflow-hidden animate-pop-in max-h-96 overflow-y-auto">
          {total === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-900/50">Nothing found for “{term}”.</p>
          ) : (
            GROUPS.map(({ key, label, icon: Icon }) => {
              const rows = results[key] || [];
              if (rows.length === 0) return null;
              return (
                <div key={key} className="border-b border-sand last:border-0">
                  <p className="px-4 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-ink-900/40">
                    {label}
                  </p>
                  {rows.map((row) => (
                    <button
                      key={row._id}
                      type="button"
                      onClick={() =>
                        pick(() => {
                          if (key === "users") onPickUser?.(row._id);
                          else if (key === "trips") onPickTrip?.(row._id);
                          else if (key === "bookings") onPickTrip?.(null);
                        })
                      }
                      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-paper transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-ink-900/35 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-ink-900 truncate">{primary(key, row)}</span>
                        <span className="block text-xs text-ink-900/45 truncate">{secondary(key, row)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function primary(kind, row) {
  if (kind === "users") return row.name;
  if (kind === "trips") return `${row.origin} → ${row.destination}`;
  if (kind === "bookings") return row.reference;
  return row.place;
}

function secondary(kind, row) {
  if (kind === "users") return `${row.email} · ${row.role}${row.is_active ? "" : " · deactivated"}`;
  if (kind === "trips") return `${row.user_id?.name || "no owner"} · ${row.status}`;
  if (kind === "bookings")
    return `${row.journey?.from_city || ""} → ${row.journey?.to_city || ""} · ${row.status}`;
  return `${row.user_id?.name || "no owner"}${row.is_hidden ? " · hidden" : ""}`;
}
