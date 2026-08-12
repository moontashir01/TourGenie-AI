import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, Mail, Lock, User, AlertCircle, Globe2 } from "lucide-react";
import RouteLine from "../components/RouteLine";
import { useAuth } from "../context/AuthContext";
import { destinationsApi } from "../lib/api";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("BD");
  const [countries, setCountries] = useState([
    { country_code: "BD", name: "Bangladesh" },
    { country_code: "TH", name: "Thailand" },
    { country_code: "MY", name: "Malaysia" },
    { country_code: "IN", name: "India" },
    { country_code: "NP", name: "Nepal" },
  ]);

  useEffect(() => {
    destinationsApi.list({ limit: 1 }).then(({ countries: rows }) => {
      const core = (rows || []).filter((country) => country.is_core);
      if (core.length) setCountries(core);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, "en", countryCode);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <svg className="absolute -top-10 -right-10 w-72 h-72 opacity-20" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="90" fill="none" stroke="#EF8354" strokeWidth="1" strokeDasharray="1 8" />
      </svg>
      <div className="w-full max-w-sm relative z-10">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Compass className="w-7 h-7 text-sunset" strokeWidth={1.75} />
          <span className="font-display text-xl text-paper">TourGenie <span className="text-sunset">AI</span></span>
        </Link>

        <div className="bg-ink-800 border border-ink-700 rounded-2xl p-8">
          <h1 className="font-display text-2xl text-paper mb-1">Create your account</h1>
          <p className="text-sm text-paper/50 mb-6">Start planning your first AI-generated trip.</p>

          {error && (
            <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset text-sm rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-xs font-medium text-paper/60 mb-1.5 block">Full name</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <User className="w-4 h-4 text-paper/30" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-paper/60 mb-1.5 block">Home country</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <Globe2 className="w-4 h-4 text-paper/30" />
                <select
                  required
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="bg-ink-900 text-paper text-sm py-2.5 w-full focus:outline-none"
                >
                  {countries.map((country) => (
                    <option key={country.country_code} value={country.country_code}>{country.name}</option>
                  ))}
                </select>
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-paper/60 mb-1.5 block">Email</span>
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
              <span className="text-xs font-medium text-paper/60 mb-1.5 block">Password</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <Lock className="w-4 h-4 text-paper/30" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-paper/60 mb-1.5 block">Confirm password</span>
              <div className="flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 focus-within:border-teal">
                <Lock className="w-4 h-4 text-paper/30" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent text-paper text-sm py-2.5 w-full focus:outline-none placeholder:text-paper/30"
                />
              </div>
            </label>

            <label className="flex items-start gap-2 text-xs text-paper/50">
              <input type="checkbox" required className="mt-0.5 accent-sunset" />
              I agree to the Terms of Service and Privacy Policy.
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-900 font-semibold text-sm py-3 rounded-lg transition-colors"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="my-6"><RouteLine className="w-full h-3" color="#1A4358" /></div>

          <p className="text-center text-sm text-paper/50">
            Already have an account?{" "}
            <Link to="/login" className="text-sunset font-medium hover:text-sunset-dark">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
