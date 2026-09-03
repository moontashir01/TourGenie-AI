import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Compass, LayoutGrid, MapPinned, FileStack, Users, Settings, Wallet,
  MessageCircleMore, LogOut, Building2, Landmark, Menu, X, Languages,
  Scale, Route as RouteIcon, Ticket, CalendarRange, ChevronRight, Plus, Map, RefreshCw, Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useCurrentTrip } from "../context/TripContext";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import ChatDock from "./ChatDock";
import CommandPalette from "./CommandPalette";

// The sidebar is grouped rather than a flat list because the destinations
// are not peers: three of them are things you do before a trip exists, seven
// only mean anything once one does, and two are yours regardless. A flat
// list of twelve hides that, and hides the fact that half the app silently
// depends on which trip is currently open.
//
// Labels come from the FR-17 string tables; the English text doubles as the
// fallback so a missing key never renders as a bare "nav.dashboard".
const GROUPS = [
  {
    key: "nav.discover",
    fallback: "Discover",
    links: [
      { to: "/dashboard", key: "nav.dashboard", fallback: "Dashboard", icon: LayoutGrid },
      { to: "/destinations", key: "destination.title", fallback: "Explore & Compare", icon: Scale },
      { to: "/plan", key: "trip.plan_new", fallback: "Plan New Trip", icon: MapPinned },
    ],
  },
  {
    key: "nav.this_trip",
    fallback: "This trip",
    // Everything here reads currentTripId and shows an empty state without
    // one, so the whole group is muted until a trip is open.
    needsTrip: true,
    links: [
      { to: "/itinerary", key: "nav.itinerary", fallback: "Itinerary", icon: CalendarRange },
      { to: "/attractions", key: "nav.attractions", fallback: "Attractions", icon: Landmark },
      { to: "/hotels", key: "nav.hotels", fallback: "Hotels", icon: Building2 },
      { to: "/map", key: "route.title", fallback: "Route & Map", icon: RouteIcon },
      { to: "/booking", key: "booking.title", fallback: "Ticket Booking", icon: Ticket },
      { to: "/budget", key: "budget.title", fallback: "Budget & Expenses", icon: Wallet },
      { to: "/chat", key: "chat.title", fallback: "AI Assistant", icon: MessageCircleMore },
    ],
  },
  {
    key: "nav.saved",
    fallback: "Saved",
    links: [
      { to: "/documents", key: "nav.documents", fallback: "Documents", icon: FileStack },
      { to: "/community", key: "nav.community", fallback: "Community", icon: Users },
    ],
  },
];

const STATUS_TONE = {
  draft: "bg-sand text-ink-900/60",
  planned: "bg-teal-light text-teal-dark",
  active: "bg-gold/25 text-ink-800",
  completed: "bg-surface text-ink-900/45 border border-sand",
};

// "15 – 18 Aug" for a trip inside one month, "28 Aug – 2 Sep" across two.
function formatRange(start, end) {
  if (!start || !end) return "";
  const a = new Date(start);
  const b = new Date(end);
  const month = (d) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const day = (d) => d.getUTCDate();
  return month(a) === month(b) && a.getUTCFullYear() === b.getUTCFullYear()
    ? `${day(a)} – ${day(b)} ${month(b)}`
    : `${day(a)} ${month(a)} – ${day(b)} ${month(b)}`;
}

// FR-17 — the switcher itself. Languages come from the API; the choice is
// remembered in localStorage and applies instantly, RTL included.
function LanguageSwitcher() {
  const { lang, setLang, languages } = useLanguage();
  if (languages.length < 2) return null;
  return (
    <label className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 bg-surface/70 border border-sand rounded-xl cursor-pointer">
      <Languages className="w-4 h-4 text-teal-dark shrink-0" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="flex-1 min-w-0 bg-transparent text-sm text-ink-900 focus:outline-none cursor-pointer"
        aria-label="Language"
      >
        {languages.map((l) => (
          <option key={l.lang} value={l.lang}>
            {l.flag ? `${l.flag} ` : ""}{l.native_label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-2">
      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center shadow-soft shrink-0">
        <Compass className="w-5 h-5 text-paper-fixed" strokeWidth={1.75} />
      </span>
      <span className="font-display text-lg text-ink-900">
        TourGenie <span className="text-sunset">AI</span>
      </span>
    </Link>
  );
}

// Names the trip the seven trip-scoped pages are operating on. Without this
// the sidebar gives no clue which journey "Budget" or "Route & Map" is
// about, which is the single most confusing thing about the old nav.
function CurrentTripCard({ onNavigate }) {
  const { currentTripId, currentTrip, loadingTrip, tripError, refreshCurrentTrip } = useCurrentTrip();
  const { t } = useLanguage();

  if (loadingTrip && !currentTrip) {
    return <div className="mx-1 mb-3 h-14 rounded-xl bg-sand/40 animate-pulse" />;
  }

  if (!currentTrip && currentTripId && tripError) {
    return (
      <button
        type="button"
        onClick={refreshCurrentTrip}
        className="group flex items-center gap-2.5 w-[calc(100%-0.5rem)] mx-1 mb-3 px-3 py-2.5 rounded-xl border border-sunset/40 bg-sunset-light/50 hover:bg-sunset-light text-left transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-surface border border-sunset/30 flex items-center justify-center shrink-0">
          <RefreshCw className="w-3.5 h-3.5 text-sunset-dark" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-900/75">Trip didn't load</span>
          <span className="block text-[11px] text-ink-900/55 leading-snug">Still open — tap to retry</span>
        </span>
      </button>
    );
  }

  if (!currentTrip) {
    return (
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="group flex items-center gap-2.5 mx-1 mb-3 px-3 py-2.5 rounded-xl border border-dashed border-sand hover:border-teal/50 hover:bg-surface/60 transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-paper border border-sand flex items-center justify-center shrink-0">
          <Map className="w-4 h-4 text-ink-900/30" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-900/70">
            {t("nav.no_trip_selected", "No trip selected")}
          </span>
          <span className="block text-[11px] text-ink-900/45 leading-snug">
            {t("nav.choose_trip", "Choose one from your trips")}
          </span>
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-ink-900/25 group-hover:text-teal-dark shrink-0" />
      </Link>
    );
  }

  const status = currentTrip.status || "draft";
  return (
    <Link
      to="/itinerary"
      onClick={onNavigate}
      className="group block mx-1 mb-3 px-3 py-2.5 rounded-xl bg-surface border border-sand hover:border-teal/50 hover:shadow-soft transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-display text-sm text-ink-900 truncate">
            {currentTrip.destination}
          </span>
          <span className="block text-[11px] text-ink-900/50 truncate">
            {currentTrip.origin} → {currentTrip.destination}
          </span>
        </span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0 ${STATUS_TONE[status]}`}>
          {t(`trip.status_${status}`, status)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-sand">
        <span className="text-[11px] font-mono text-ink-900/45">
          {formatRange(currentTrip.start_date, currentTrip.end_date)}
        </span>
        <span className="text-[10px] text-ink-900/35 group-hover:text-teal-dark">
          {t("nav.change", "Change")}
        </span>
      </div>
    </Link>
  );
}

// A shortcut nobody knows about may as well not exist, so the sidebar advertises
// it. Clicking dispatches the same key event the palette already listens for,
// which keeps the open/close logic in one place.
function SearchHint() {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: isMac, ctrlKey: !isMac, bubbles: true })
        )
      }
      className="flex items-center gap-2 w-[calc(100%-0.5rem)] mx-1 mb-3 px-3 py-2 rounded-xl border border-sand bg-white/60 hover:bg-white hover:border-teal/40 text-left transition-colors group"
    >
      <Search className="w-3.5 h-3.5 text-ink-900/30 group-hover:text-teal-dark shrink-0" />
      <span className="text-xs text-ink-900/40 flex-1">Search…</span>
      <kbd className="text-[10px] font-mono text-ink-900/35 border border-sand rounded px-1.5 py-0.5 bg-paper">
        {isMac ? "⌘" : "Ctrl "}K
      </kbd>
    </button>
  );
}

function NavLinks({ onNavigate }) {
  const { t } = useLanguage();
  const { currentTripId } = useCurrentTrip();

  return (
    <nav className="flex flex-col gap-3">
      {GROUPS.map((group) => {
        const muted = group.needsTrip && !currentTripId;
        return (
          <div key={group.key}>
            <p className="px-4 mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-900/30">
              {t(group.key, group.fallback)}
            </p>

            {muted && (
              <p className="px-4 mb-1.5 text-[10px] text-ink-900/35 leading-snug">
                {t("nav.pick_trip_hint", "Pick a trip to use these")}
              </p>
            )}

            <div className="flex flex-col gap-0.5">
              {group.links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-teal-light text-teal-dark shadow-soft"
                        : muted
                          ? "text-ink-900/30 hover:bg-surface/60 hover:text-ink-900/60"
                          : "text-ink-900/60 hover:bg-surface hover:text-ink-900 hover:shadow-soft"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-teal" />}
                      <l.icon
                        className={`w-4 h-4 transition-transform duration-150 group-hover:scale-110 ${
                          isActive ? "text-teal-dark" : muted ? "text-ink-900/25" : "text-ink-900/40 group-hover:text-teal-dark"
                        }`}
                        strokeWidth={1.75}
                      />
                      {t(l.key, l.fallback)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function UserFooter({ user, onLogout, onNavigate }) {
  const { t } = useLanguage();
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const adminLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive ? "bg-ink-900 text-paper" : "text-ink-900/60 hover:bg-surface hover:text-ink-900 hover:shadow-soft"
    }`;

  return (
    <div className="flex flex-col gap-1 pt-2.5 mt-2.5 border-t border-sand shrink-0">
      <NotificationBell />
      <div className="flex items-center gap-1.5">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      {["moderator", "admin", "owner"].includes(user?.role) && (
        <NavLink to="/admin" className={adminLinkClass} onClick={onNavigate}>
          <Settings className="w-4 h-4" strokeWidth={1.75} />
          {t("nav.admin", "Admin console")}
        </NavLink>
      )}
      <div className="flex items-center gap-1 px-1 py-1 mt-1 bg-surface/70 border border-sand rounded-xl">
        {/* The account card is the way into settings — clicking your own name
            is where people look for it, and a thirteenth nav link isn't. */}
        <NavLink
          to="/settings"
          onClick={onNavigate}
          title={t("nav.settings", "Account settings")}
          className={({ isActive }) =>
            `flex items-center gap-3 flex-1 min-w-0 px-2 py-1.5 rounded-lg transition-colors ${
              isActive ? "bg-teal-light" : "hover:bg-surface"
            }`
          }
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sunset to-sunset-dark text-paper-fixed flex items-center justify-center text-xs font-bold shrink-0 shadow-soft">
            {initials || "?"}
          </div>
          <div className="text-xs flex-1 min-w-0">
            <p className="font-semibold text-ink-900 truncate">{user?.name || "…"}</p>
            <p className="text-ink-900/50 capitalize">{user?.role || ""}</p>
          </div>
        </NavLink>
        <button
          onClick={onLogout}
          title={t("nav.logout", "Log out")}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-900/40 hover:text-sunset-dark hover:bg-sunset/10 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// The nav is the tall part and the footer must stay reachable, so the links
// scroll inside their own region rather than pushing the account card off
// the bottom of a short window.
function SidebarBody({ onNavigate }) {
  return (
    <>
      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-y-auto -mr-2 pr-2">
          <CurrentTripCard onNavigate={onNavigate} />
          <SearchHint />
          <NavLinks onNavigate={onNavigate} />
        </div>
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-paper/90 to-transparent" />
      </div>
    </>
  );
}

export default function AppShell({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex bg-paper bg-paper-texture">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sand bg-surface/50 backdrop-blur-sm py-6 px-4 sticky top-0 h-screen">
        <div className="mb-5 shrink-0">
          <Brand />
        </div>
        <SidebarBody />
        <UserFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile slide-over nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-paper flex flex-col py-6 px-4 shadow-lift animate-fade-up">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-900/50 hover:bg-surface"
                aria-label={t("common.close", "Close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
            <UserFooter user={user} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Mobile top bar — the sidebar is hidden below md, this is the nav */}
        <div className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-paper/90 backdrop-blur border-b border-sand px-4 h-14">
          <Brand />
          <div className="flex items-center gap-1">
            <Link
              to="/plan"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-teal-dark hover:bg-teal-light"
              aria-label={t("trip.plan_new", "Plan New Trip")}
            >
              <Plus className="w-5 h-5" />
            </Link>
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-900/60 hover:bg-surface"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(title || subtitle) && (
          <header className="border-b border-sand bg-surface/40 px-6 md:px-10 py-6">
            {title && <h1 className="font-display text-2xl text-ink-900">{title}</h1>}
            {subtitle && <p className="text-sm text-ink-900/60 mt-1">{subtitle}</p>}
          </header>
        )}
        <main className="px-6 md:px-10 py-8 animate-fade-up">{children}</main>
      </div>

      {/* Available from every authenticated page. */}
      <CommandPalette />
      <ChatDock />
    </div>
  );
}
