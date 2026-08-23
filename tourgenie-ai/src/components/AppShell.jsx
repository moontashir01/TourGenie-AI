import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Compass,
  LayoutGrid,
  MapPinned,
  FileStack,
  Users,
  Settings,
  Wallet,
  MessageCircleMore,
  LogOut,
  Building2,
  Landmark,
  Menu,
  X,
  Languages,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

// Labels come from the FR-17 string tables; the English text doubles as the
// fallback so a missing key never renders as a bare "nav.dashboard".
const links = [
  { to: "/dashboard", key: "nav.dashboard", fallback: "Dashboard", icon: LayoutGrid },
  { to: "/plan", key: "trip.plan_new", fallback: "Plan New Trip", icon: MapPinned },
  { to: "/attractions", key: "admin.attractions", fallback: "Attractions", icon: Landmark },
  { to: "/hotels", key: "admin.hotels", fallback: "Hotels", icon: Building2 },
  { to: "/budget", key: "budget.title", fallback: "Budget & Expenses", icon: Wallet },
  { to: "/chat", key: "chat.title", fallback: "AI Assistant", icon: MessageCircleMore },
  { to: "/community", key: "nav.community", fallback: "Community", icon: Users },
  { to: "/documents", key: "nav.documents", fallback: "Documents", icon: FileStack },
];

// FR-17 — the switcher itself. Languages come from the API; the choice is
// remembered in localStorage and applies instantly, RTL included.
function LanguageSwitcher() {
  const { lang, setLang, languages } = useLanguage();
  if (languages.length < 2) return null;
  return (
    <label className="flex items-center gap-2 px-3 py-2 bg-white/70 border border-sand rounded-xl cursor-pointer">
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
        <Compass className="w-5 h-5 text-paper" strokeWidth={1.75} />
      </span>
      <span className="font-display text-lg text-ink-900">
        TourGenie <span className="text-sunset">AI</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }) {
  const { t } = useLanguage();
  const linkClass = ({ isActive }) =>
    `group relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
      isActive
        ? "bg-teal-light text-teal-dark shadow-soft"
        : "text-ink-900/60 hover:bg-white hover:text-ink-900 hover:shadow-soft"
    }`;

  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} className={linkClass} onClick={onNavigate}>
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-teal" />}
              <l.icon
                className={`w-4 h-4 transition-transform duration-150 group-hover:scale-110 ${
                  isActive ? "text-teal-dark" : "text-ink-900/40 group-hover:text-teal-dark"
                }`}
                strokeWidth={1.75}
              />
              {t(l.key, l.fallback)}
            </>
          )}
        </NavLink>
      ))}
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
      isActive ? "bg-ink-900 text-paper" : "text-ink-900/60 hover:bg-white hover:text-ink-900 hover:shadow-soft"
    }`;

  return (
    <div className="mt-auto flex flex-col gap-1">
      <LanguageSwitcher />
      {user?.role === "admin" && (
        <NavLink to="/admin" className={adminLinkClass} onClick={onNavigate}>
          <Settings className="w-4 h-4" strokeWidth={1.75} />
          {t("nav.admin", "Admin console")}
        </NavLink>
      )}
      <div className="flex items-center gap-3 px-3 py-3 mt-2 bg-white/70 border border-sand rounded-xl">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sunset to-sunset-dark text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-soft">
          {initials || "?"}
        </div>
        <div className="text-xs flex-1 min-w-0">
          <p className="font-semibold text-ink-900 truncate">{user?.name || "…"}</p>
          <p className="text-ink-900/50 capitalize">{user?.role || ""}</p>
        </div>
        <button
          onClick={onLogout}
          title="Log out"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-900/40 hover:text-sunset-dark hover:bg-sunset/10 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex bg-paper bg-paper-texture">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sand bg-white/50 backdrop-blur-sm py-6 px-4 sticky top-0 h-screen">
        <div className="mb-8">
          <Brand />
        </div>
        <NavLinks />
        <UserFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile slide-over nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-paper flex flex-col py-6 px-4 shadow-lift animate-fade-up">
            <div className="flex items-center justify-between mb-8">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-900/50 hover:bg-white"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <UserFooter user={user} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Mobile top bar — the sidebar is hidden below md, this is the nav */}
        <div className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-paper/90 backdrop-blur border-b border-sand px-4 h-14">
          <Brand />
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-900/60 hover:bg-white"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {(title || subtitle) && (
          <header className="border-b border-sand bg-white/40 px-6 md:px-10 py-6">
            {title && <h1 className="font-display text-2xl text-ink-900">{title}</h1>}
            {subtitle && <p className="text-sm text-ink-900/60 mt-1">{subtitle}</p>}
          </header>
        )}
        <main className="px-6 md:px-10 py-8 animate-fade-up">{children}</main>
      </div>
    </div>
  );
}
