import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, Clock } from "lucide-react";
import RouteLine from "../components/RouteLine";
import { useAuth } from "../context/AuthContext";
import { consumeSessionExpiredNotice } from "../lib/api";
import AuthLayout from "../components/AuthLayout";

const STAFF_ROLES = ["moderator", "admin", "owner"];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set when the API client ended an expired session and sent us here. Read
  // once, on mount, so it doesn't reappear after a failed login attempt.
  const [expired] = useState(consumeSessionExpiredNotice);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      // Back to the page that sent them here, if there was one; otherwise
      // staff go to the portal they actually came for rather than landing on
      // a traveller dashboard and hunting for the sidebar link.
      const intended = location.state?.from?.pathname;
      navigate(intended || (STAFF_ROLES.includes(user.role) ? "/admin" : "/dashboard"), { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      headline="Plan the whole trip, not just the flight."
      sub="Your itinerary, route, hotels and spending stay in one place, and pick up wherever you left them."
    >
          <h1 className="font-display text-2xl text-paper mb-1">Welcome back</h1>
          <p className="text-sm text-paper/50 mb-6">Log in to pick up where your trip planning left off.</p>

          {expired && !error && (
            <div className="flex items-start gap-2 bg-teal/10 border border-teal/30 text-teal text-sm rounded-lg px-3 py-2.5 mb-4">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Your session ended — please log in again to pick up where you left off.</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset text-sm rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-paper/60 mb-1.5 block">Email</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <Mail className="w-4 h-4 text-paper/30" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-paper/60 mb-1.5 block">Password</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <Lock className="w-4 h-4 text-paper/30" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                />
              </div>
            </label>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-teal hover:text-teal-dark">Forgot password?</Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-fixed font-semibold text-sm py-3 rounded-lg transition-colors"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          <div className="my-6"><RouteLine className="w-full h-3" color="#1A4358" /></div>

          <p className="text-center text-sm text-paper/50">
            New to TourGenie?{" "}
            <Link to="/register" className="text-sunset font-medium hover:text-sunset-dark">
              Create an account
            </Link>
          </p>
    </AuthLayout>
  );
}
