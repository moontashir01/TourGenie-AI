import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, CalendarClock, CalendarCheck, AlarmClock, Luggage, CloudRain, CloudLightning,
  Thermometer, Snowflake, PieChart, TrendingUp, CircleAlert, FileWarning, FileX, Sparkles,
  TicketCheck, Star, Check, Loader2, X,
} from "lucide-react";
import { notificationApi } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";

// FR-18 — the bell.
//
// Opening this is what triggers the server-side rule sweep: there is no cron
// on free-tier hosting, so notifications are generated when someone looks.
// The badge polls a count-only endpoint, which does not sweep.

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

const POLL_MS = 90_000;

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
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

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

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-900/60 hover:bg-surface hover:text-ink-900 hover:shadow-soft transition-all"
        aria-label={t("notification.title", "Notifications")}
      >
        <Bell className="w-4 h-4 text-ink-900/40" strokeWidth={1.75} />
        {t("notification.title", "Notifications")}
        {unread > 0 && (
          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-sunset text-white text-[10px] font-bold flex items-center justify-center animate-pop-in">
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
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-ink-900/55 hover:text-teal-dark hover:bg-teal-light"
                >
                  <Check className="w-3 h-3" /> {t("notification.mark_all_read", "Mark all as read")}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-ink-900/30 hover:text-ink-900/60"
                aria-label={t("common.close", "Close")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="flex items-center gap-2 px-4 py-6 text-xs text-ink-900/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading", "Loading…")}
              </p>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellOff className="w-6 h-6 mx-auto text-ink-900/20 mb-2" />
                <p className="text-xs text-ink-900/45">{t("notification.empty", "You're all caught up.")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-sand">
                {items.map((n) => {
                  const Icon = ICONS[n.icon] || Bell;
                  const tone = SEVERITY[n.severity] || SEVERITY.info;
                  return (
                    <li key={n._id}>
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
                            <p className="text-xs font-semibold text-ink-900 leading-snug flex-1">{n.title}</p>
                            {!n.is_read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${tone.dot}`} />}
                          </div>
                          <p className="text-[11px] text-ink-900/60 leading-relaxed mt-0.5 line-clamp-3">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-ink-900/35 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
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
