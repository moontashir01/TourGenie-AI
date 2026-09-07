import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, CalendarClock, CalendarCheck, AlarmClock, Luggage, CloudRain, CloudLightning,
  Thermometer, Snowflake, PieChart, TrendingUp, CircleAlert, FileWarning, FileX, Sparkles,
  TicketCheck, Star, Check, Loader2, X, Trash2,
} from "lucide-react";
import { notificationApi } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { useCurrentTrip } from "../context/TripContext";

// FR-18 — the bell.
//
// There is no cron on free-tier hosting, so notifications are generated when
// someone looks. Both the panel and the badge poll run the sweep — the badge
// on a much longer server-side cooldown — because when only the panel swept,
// a notification could never reach the badge before you had already opened
// the panel it was meant to send you to.

// Templates name their own lucide icon; anything unrecognised falls back to
// a bell rather than crashing the panel.
const ICONS = {
  Bell, CalendarClock, CalendarCheck, AlarmClock, Luggage, CloudRain, CloudLightning,
  Thermometer, Snowflake, PieChart, TrendingUp, CircleAlert, FileWarning, FileX,
  Sparkles, TicketCheck, Star,
};

const SEVERITY = {
  info: { dot: "bg-teal", tone: "text-teal-dark", bg: "bg-teal-light" },
  reminder: { dot: "bg-gold", tone: "text-ink-800", bg: "bg-gold/15" },
  warning: { dot: "bg-sunset", tone: "text-sunset-dark", bg: "bg-sunset-light" },
  critical: { dot: "bg-sunset-dark", tone: "text-sunset-dark", bg: "bg-sunset-light" },
};

// Short enough for a 22rem panel. The key is the template's `type`.
const TYPE_LABELS = {
  departure: "Trip",
  weather: "Weather",
  budget: "Budget",
  document: "Documents",
  booking: "Bookings",
  moderation: "Held",
  itinerary: "Itinerary",
  review: "Reviews",
};

const ALL = "all";
const POLL_MS = 90_000;
// Below this the filter row costs more space than it saves.
const FILTER_FROM = 6;

function timeAgo(value) {
  const seconds = Math.floor((Date.now() - new Date(value)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toISOString().slice(0, 10);
}

export default function NotificationBell() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setCurrentTripId } = useCurrentTrip();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [filter, setFilter] = useState(ALL);
  const panelRef = useRef(null);
  const previousUnread = useRef(0);

  const pollCount = useCallback(() => {
    notificationApi
      .unreadCount()
      .then(({ unread: n }) => setUnread(n || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    pollCount();
    const id = setInterval(pollCount, POLL_MS);
    return () => clearInterval(id);
  }, [pollCount]);

  // The poll is silent by design, so something arriving mid-session used to
  // change a number nobody was looking at. One shake is enough to catch the
  // eye — and only on an *increase*, or reading your notifications would make
  // the bell wave at you on the way down.
  useEffect(() => {
    if (unread > previousUnread.current) {
      setRinging(true);
      const id = setTimeout(() => setRinging(false), 600);
      previousUnread.current = unread;
      return () => clearTimeout(id);
    }
    previousUnread.current = unread;
    return undefined;
  }, [unread]);

  // Click-away and Escape, so the panel behaves like a menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
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

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;

    setFilter(ALL);
    setLoading(true);
    // This call runs the sweep server-side, so new notifications appear the
    // moment the traveler looks for them.
    notificationApi
      .list({ limit: 30 })
      .then(({ notifications, unread: n }) => {
        setItems(notifications || []);
        setUnread(n || 0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  async function openItem(item) {
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, is_read: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
      notificationApi.markRead(item._id).catch(() => {});
    }

    // Switch to the trip the notification is about before navigating. The
    // trip-scoped pages read whatever TripContext holds, so without this an
    // over-budget warning for Sylhet opened the *currently* open trip's
    // budget page and quietly showed the wrong numbers.
    if (item.trip_id) setCurrentTripId(item.trip_id);

    if (item.action_url) {
      setOpen(false);
      // Templates store deep links like /trips/:id/budget; the app routes on
      // the current trip rather than a trip id in the path, so only the
      // trailing section is meaningful here.
      const section = item.action_url.split("/").pop();
      const known = ["itinerary", "budget", "booking", "packing", "documents", "community"];
      navigate(known.includes(section) ? `/${section === "packing" ? "documents" : section}` : "/dashboard");
    }
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    notificationApi.markAllRead().catch(() => {});
  }

  // Optimistic: the row goes now, the server catches up. A failed delete
  // reappears on the next open rather than blocking the click.
  function dismiss(item) {
    setItems((prev) => prev.filter((n) => n._id !== item._id));
    if (!item.is_read) setUnread((n) => Math.max(0, n - 1));
    notificationApi.remove(item._id).catch(() => {});
  }

  function clearRead() {
    setItems((prev) => prev.filter((n) => !n.is_read));
    notificationApi.clearRead().catch(() => {});
  }

  // Only the types actually present, so the row never offers an empty filter.
  const types = useMemo(() => [...new Set(items.map((n) => n.type).filter(Boolean))], [items]);
  const visible = filter === ALL ? items : items.filter((n) => n.type === filter);
  const showFilters = items.length >= FILTER_FROM && types.length > 1;
  const readCount = items.filter((n) => n.is_read).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-600 hover:bg-surface hover:text-ink-900 hover:shadow-soft transition"
        aria-label={t("notification.title", "Notifications")}
      >
        <Bell
          className={`w-4 h-4 text-ink-500 origin-top ${ringing ? "animate-shake" : ""}`}
          strokeWidth={1.75}
        />
        {t("notification.title", "Notifications")}
        {unread > 0 && (
          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-sunset text-paper-fixed text-3xs font-bold flex items-center justify-center animate-pop-in">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-[22rem] max-w-[calc(100vw-2rem)] bg-paper border border-sand rounded-2xl shadow-lift overflow-hidden animate-pop-in">
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-sand bg-surface/60">
            <span className="font-display text-sm text-ink-900">
              {t("notification.title", "Notifications")}
            </span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAll}
                  title={t("notification.mark_all_read", "Mark all as read")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs text-ink-600 hover:text-teal-dark hover:bg-teal-light transition-colors"
                >
                  <Check className="w-3 h-3" /> {t("notification.mark_all_read", "Mark all as read")}
                </button>
              )}
              {unread === 0 && readCount > 0 && (
                <button
                  onClick={clearRead}
                  title={t("notification.clear_read", "Clear the ones you've read")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs text-ink-600 hover:text-sunset-dark hover:bg-sunset-light transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> {t("notification.clear_read", "Clear read")}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-ink-900/30 hover:text-ink-600 transition-colors"
                aria-label={t("common.close", "Close")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {showFilters && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-sand overflow-x-auto">
              {[ALL, ...types].map((value) => {
                const active = filter === value;
                const count = value === ALL ? items.length : items.filter((n) => n.type === value).length;
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-2xs font-semibold transition-colors ${
                      active ? "bg-teal-light text-teal-dark" : "text-ink-500 hover:text-ink-900/80 hover:bg-sand/40"
                    }`}
                  >
                    {value === ALL ? t("common.all", "All") : TYPE_LABELS[value] || value}
                    <span className="ml-1 opacity-60 tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="flex items-center gap-2 px-4 py-6 text-xs text-ink-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading", "Loading…")}
              </p>
            ) : visible.length === 0 ? (
              <div className="px-4 py-8 text-center animate-fade-in">
                <BellOff className="w-6 h-6 mx-auto text-ink-900/20 mb-2" />
                <p className="text-sm text-ink-500">
                  {filter === ALL
                    ? t("notification.empty", "You're all caught up.")
                    : t("notification.empty_filtered", "Nothing here under this filter.")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-sand">
                {visible.map((n) => {
                  const Icon = ICONS[n.icon] || Bell;
                  const tone = SEVERITY[n.severity] || SEVERITY.info;
                  return (
                    <li key={n._id} className="group/row relative">
                      <button
                        onClick={() => openItem(n)}
                        className={`w-full flex items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface ${
                          n.is_read ? "opacity-60" : ""
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone.bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${tone.tone}`} strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1.5">
                            {/* pr-5 keeps the title clear of the dismiss
                                button that appears over this corner. */}
                            <p className="text-sm font-semibold text-ink-900 leading-snug flex-1 pr-5">{n.title}</p>
                            {!n.is_read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${tone.dot}`} />}
                          </div>
                          <p className="text-2xs text-ink-600 leading-relaxed mt-0.5 line-clamp-3">
                            {n.message}
                          </p>
                          <p className="text-3xs text-ink-500 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </button>
                      {/* A sibling of the row button, not a child of it —
                          nesting one button inside another is invalid and
                          the inner one never receives the click. */}
                      <button
                        type="button"
                        onClick={() => dismiss(n)}
                        aria-label={t("notification.dismiss", "Dismiss")}
                        title={t("notification.dismiss", "Dismiss")}
                        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-ink-900/30 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-sunset-dark hover:bg-sunset-light transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
