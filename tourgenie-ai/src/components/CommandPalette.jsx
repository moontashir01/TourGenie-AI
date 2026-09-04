import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Overlay from "./ui/Overlay";
import {
  Search, CornerDownLeft, LayoutGrid, MapPinned, CalendarRange, Landmark,
  Building2, Route as RouteIcon, Ticket, Wallet, FileStack,
  Users, Scale, Settings, LogOut, Plus, Map, Sparkles, Printer,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCurrentTrip } from "../context/TripContext";
import { useChat } from "../context/ChatContext";
import { tripsApi } from "../lib/api";

// Cmd/Ctrl-K. Twelve destinations in the sidebar plus however many trips the
// traveller has is more than a nav can surface at once — this makes all of it
// one keystroke and a few letters away.

const NAV_COMMANDS = [
  { id: "dashboard", label: "Dashboard", hint: "All your trips", to: "/dashboard", icon: LayoutGrid, group: "Go to" },
  { id: "destinations", label: "Explore & Compare", hint: "Browse destinations", to: "/destinations", icon: Scale, group: "Go to" },
  { id: "plan", label: "Plan New Trip", hint: "Start a new journey", to: "/plan", icon: MapPinned, group: "Go to" },
  { id: "itinerary", label: "Itinerary", to: "/itinerary", icon: CalendarRange, group: "This trip", needsTrip: true },
  { id: "attractions", label: "Attractions", to: "/attractions", icon: Landmark, group: "This trip", needsTrip: true },
  { id: "hotels", label: "Hotels", to: "/hotels", icon: Building2, group: "This trip", needsTrip: true },
  { id: "map", label: "Route & Map", to: "/map", icon: RouteIcon, group: "This trip", needsTrip: true },
  { id: "booking", label: "Ticket Booking", to: "/booking", icon: Ticket, group: "This trip", needsTrip: true },
  { id: "budget", label: "Budget & Expenses", to: "/budget", icon: Wallet, group: "This trip", needsTrip: true },
  { id: "print", label: "Print / save as PDF", hint: "Printable itinerary", to: "/itinerary/print", icon: Printer, group: "This trip", needsTrip: true },
  { id: "documents", label: "Documents", to: "/documents", icon: FileStack, group: "Saved" },
  { id: "community", label: "Community", to: "/community", icon: Users, group: "Saved" },
];

/**
 * Subsequence match — "bud" and "bgt" both find "Budget & Expenses". Returns
 * a score so closer matches sort first, or -1 for no match.
 */
function fuzzyScore(haystack, needle) {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  const direct = h.indexOf(n);
  if (direct !== -1) return direct === 0 ? 1000 : 500 - direct;

  let score = 0;
  let hi = 0;
  let lastHit = -1;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return -1;
    // Consecutive characters are worth more than scattered ones.
    score += found === lastHit + 1 ? 6 : 1;
    lastHit = found;
    hi = found + 1;
  }
  return score;
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentTripId, setCurrentTripId } = useCurrentTrip();
  const { setOpen: setChatOpen } = useChat();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [trips, setTrips] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Trips are fetched once the palette is first opened, not on mount, so the
  // shortcut costs nothing to anyone who never presses it.
  useEffect(() => {
    if (!open || trips.length > 0) return;
    tripsApi
      .list()
      .then(({ trips: list }) => setTrips(list || []))
      .catch(() => setTrips([]));
  }, [open, trips.length]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Focus after paint, or the input isn't in the document yet.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo(() => {
    const list = NAV_COMMANDS.filter((c) => !c.needsTrip || currentTripId).map((c) => ({
      ...c,
      run: () => navigate(c.to),
    }));

    // Built in group order — nav, then trips, then actions — because the
    // headers are drawn by watching for the group changing between rows, so a
    // group split in two would print its heading twice.
    for (const trip of trips) {
      list.push({
        id: `trip-${trip._id}`,
        label: trip.destination,
        hint: `${trip.origin} → ${trip.destination} · ${trip.status}`,
        icon: Map,
        group: "Switch trip",
        run: () => {
          setCurrentTripId(trip._id);
          navigate("/itinerary");
        },
      });
    }

    list.push({
      id: "open-chat",
      label: "Ask the AI Assistant",
      hint: "Opens the chat dock",
      icon: Sparkles,
      group: "Actions",
      run: () => setChatOpen(true),
    });
    list.push({ id: "new-trip", label: "Plan a new trip", icon: Plus, group: "Actions", run: () => navigate("/plan") });

    if (user?.role === "admin") {
      list.push({ id: "admin", label: "Admin console", icon: Settings, group: "Actions", run: () => navigate("/admin") });
    }

    list.push({
      id: "logout",
      label: "Log out",
      icon: LogOut,
      group: "Actions",
      run: () => {
        logout();
        navigate("/");
      },
    });

    return list;
  }, [currentTripId, trips, user, navigate, setCurrentTripId, setChatOpen, logout]);

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((c) => ({ c, score: Math.max(fuzzyScore(c.label, query), fuzzyScore(c.hint || "", query) - 50) }))
      .filter(({ score }) => score > -1)
      .sort((a, b) => b.score - a.score)
      .map(({ c }) => c);
  }, [commands, query]);

  // A shrinking result list can leave the cursor past the end.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function runAt(index) {
    const cmd = results[index];
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  }

  // Escape is Overlay's, which stops it at the document in capture — only
  // the list navigation is this component's business.
  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(cursor);
    }
  }

  // With a query the rows are ordered by relevance, which interleaves the
  // groups — so headings are only meaningful on the unfiltered list.
  const showGroups = !query.trim();
  let lastGroup = null;

  return (
    <Overlay
      open={open}
      onClose={() => setOpen(false)}
      variant="palette"
      size="lg"
      label="Command palette"
      initialFocus={inputRef}
    >
        <div className="flex items-center gap-3 px-4 border-b border-sand">
          <Search className="w-4 h-4 text-ink-900/35 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, trips and actions…"
            className="flex-1 bg-transparent py-3.5 text-sm text-ink-900 placeholder:text-ink-900/30 focus:outline-none"
          />
          <kbd className="hidden sm:block text-3xs font-mono text-ink-900/35 border border-sand rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-900/45">
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((cmd, i) => {
              const showGroup = showGroups && cmd.group !== lastGroup;
              lastGroup = cmd.group;
              const activeRow = i === cursor;
              return (
                <div key={cmd.id}>
                  {showGroup && (
                    <p className="px-4 pt-2.5 pb-1 text-3xs font-bold uppercase tracking-wider text-ink-900/30">
                      {cmd.group}
                    </p>
                  )}
                  <button
                    data-index={i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => runAt(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      activeRow ? "bg-teal-light" : "hover:bg-paper"
                    }`}
                  >
                    <cmd.icon
                      className={`w-4 h-4 shrink-0 ${activeRow ? "text-teal-dark" : "text-ink-900/35"}`}
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm truncate ${activeRow ? "text-teal-dark font-semibold" : "text-ink-900"}`}>
                        {cmd.label}
                      </span>
                      {cmd.hint && <span className="block text-2xs text-ink-900/45 truncate">{cmd.hint}</span>}
                    </span>
                    {activeRow && <CornerDownLeft className="w-3.5 h-3.5 text-teal-dark shrink-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <footer className="flex items-center gap-4 px-4 py-2 border-t border-sand bg-paper/60 text-3xs text-ink-900/40">
          <span className="inline-flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span className="inline-flex items-center gap-1"><kbd className="font-mono">↵</kbd> open</span>
          <span className="ml-auto inline-flex items-center gap-1">
            <kbd className="font-mono">⌘K</kbd> toggle
          </span>
        </footer>
    </Overlay>
  );
}
