import { Link, useNavigate } from "react-router-dom";
import { Compass, Mail, Lock } from "lucide-react";
import RouteLine from "../components/RouteLine";

export default function Login() {
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-6 relative overflow-hidden">
      <svg className="absolute -bottom-10 -left-10 w-72 h-72 opacity-20" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="90" fill="none" stroke="#1C8C82" strokeWidth="1" strokeDasharray="1 8" />
      </svg>
      <div className="w-full max-w-sm relative z-10">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Compass className="w-7 h-7 text-sunset" strokeWidth={1.75} />
          <span className="font-display text-xl text-paper">TourGenie <span className="text-sunset">AI</span></span>
        </Link>

        <div className="bg-ink-800 border border-ink-700 rounded-2xl p-8">
          <h1 className="font-display text-2xl text-paper mb-1">Welcome back</h1>
          <p className="text-sm text-paper/50 mb-6">Log in to pick up where your trip planning left off.</p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-xs font-medium text-paper/60 mb-1.5 block">Email</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <Mail className="w-4 h-4 text-paper/30" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-paper/60 mb-1.5 block">Password</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <Lock className="w-4 h-4 text-paper/30" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                />
              </div>
            </label>

            <div className="flex justify-end">
              <a href="#forgot" className="text-xs text-teal hover:text-teal-dark">Forgot password?</a>
            </div>

            <button
              type="submit"
              className="w-full bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm py-3 rounded-lg transition-colors"
            >
              Log in
            </button>
          </form>

          <div className="my-6"><RouteLine className="w-full h-3" color="#1A4358" /></div>

          <p className="text-center text-sm text-paper/50">
            New to TourGenie?{" "}
            <Link to="/register" className="text-sunset font-medium hover:text-sunset-dark">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
