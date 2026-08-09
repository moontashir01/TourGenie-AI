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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/plan", label: "Plan New Trip", icon: MapPinned },
  { to: "/budget", label: "Budget & Expenses", icon: Wallet },
  { to: "/chat", label: "AI Assistant", icon: MessageCircleMore },
  { to: "/community", label: "Community", icon: Users },
  { to: "/documents", label: "Documents", icon: FileStack },
];

export default function AppShell({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-teal-light text-teal-dark"
        : "text-ink-900/70 hover:bg-paper hover:text-ink-900"
    }`;

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sand bg-white/60 py-6 px-4">
        <Link to="/" className="flex items-center gap-2 px-2 mb-8">
          <Compass className="w-6 h-6 text-teal" strokeWidth={1.75} />
          <span className="font-display text-lg text-ink-900">TourGenie <span className="text-sunset">AI</span></span>
        </Link>
        <nav className="flex flex-col gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              <l.icon className="w-4 h-4" strokeWidth={1.75} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          {user?.role === "admin" && (
            <NavLink to="/admin" className={linkClass}>
              <Settings className="w-4 h-4" strokeWidth={1.75} />
              Admin console
            </NavLink>
          )}
          <div className="flex items-center gap-3 px-4 py-3 mt-2 border-t border-sand">
            <div className="w-8 h-8 rounded-full bg-sunset/20 text-sunset-dark flex items-center justify-center text-xs font-semibold shrink-0">
              {initials || "?"}
            </div>
            <div className="text-xs flex-1 min-w-0">
              <p className="font-medium text-ink-900 truncate">{user?.name || "…"}</p>
              <p className="text-ink-900/50 capitalize">{user?.role || ""}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="text-ink-900/40 hover:text-sunset-dark shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {(title || subtitle) && (
          <header className="border-b border-sand bg-white/40 px-6 md:px-10 py-6">
            {title && <h1 className="font-display text-2xl text-ink-900">{title}</h1>}
            {subtitle && <p className="text-sm text-ink-900/60 mt-1">{subtitle}</p>}
          </header>
        )}
        <main className="px-6 md:px-10 py-8">{children}</main>
      </div>
    </div>
  );
}
