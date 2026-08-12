import { Link, NavLink } from "react-router-dom";
import { Compass } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user } = useAuth();

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? "text-sunset" : "text-paper/80 hover:text-paper"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-ink-900/95 backdrop-blur border-b border-ink-700">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-paper">
          <Compass className="w-6 h-6 text-sunset" strokeWidth={1.75} />
          <span className="font-display text-lg tracking-tight">TourGenie <span className="text-sunset">AI</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <NavLink to="/" className={linkClass} end>Home</NavLink>
          <a href="/#features" className="text-sm font-medium text-paper/80 hover:text-paper transition-colors">Features</a>
          <NavLink to="/community" className={linkClass}>Community</NavLink>
          <a href="/#about" className="text-sm font-medium text-paper/80 hover:text-paper transition-colors">About</a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="text-sm font-semibold bg-sunset hover:bg-sunset-dark text-ink-900 px-4 py-2 rounded-full transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-paper/90 hover:text-paper px-3 py-2">
                Log in
              </Link>
              <Link
                to="/register"
                className="text-sm font-semibold bg-sunset hover:bg-sunset-dark text-ink-900 px-4 py-2 rounded-full transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
