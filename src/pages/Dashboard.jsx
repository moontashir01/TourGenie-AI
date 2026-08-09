import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Waves, Mountain, Trees, Clock, Users2, Loader2 } from "lucide-react";
import AppShell from "../components/AppShell";
import { tripsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";

const coverIcons = [Waves, Mountain, Trees];
const statusStyle = {
  draft: "bg-sand text-ink-900/60",
  planned: "bg-teal-light text-teal-dark",
  active: "bg-sunset-light text-sunset-dark",
  completed: "bg-ink-900/10 text-ink-900/50",
};

export default function Dashboard() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { setCurrentTripId } = useCurrentTrip();
  const navigate = useNavigate();

  useEffect(() => {
    tripsApi
      .list()
      .then(({ trips }) => setTrips(trips))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function openTrip(id) {
    setCurrentTripId(id);
    navigate("/itinerary");
  }

  const next = trips.find((t) => t.status === "planned") || trips[0];

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your trips…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard" subtitle="Everything about your trips, in one place.">
      {error && (
        <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">
          Couldn't load trips: {error}
        </div>
      )}

      {next && (
        <div className="bg-ink-900 rounded-2xl p-8 mb-10 relative overflow-hidden">
          <svg className="absolute right-0 top-0 h-full w-1/2 opacity-20" viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 120 Q 100 40, 200 90 T 300 60" fill="none" stroke="#EF8354" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" />
          </svg>
          <p className="text-xs font-semibold tracking-wide uppercase text-sunset mb-2 relative z-10">
            {next.status === "planned" ? "Next departure" : "Latest trip"}
          </p>
          <h2 className="font-display text-2xl text-paper relative z-10 mb-1">{next.origin} → {next.destination}</h2>
          <p className="text-paper/60 text-sm relative z-10 mb-6">
            {new Date(next.start_date).toLocaleDateString()} – {new Date(next.end_date).toLocaleDateString()} · {next.travelers} travelers
          </p>
          <button
            onClick={() => openTrip(next._id)}
            className="relative z-10 inline-flex items-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
          >
            View itinerary
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-xl text-ink-900">My Trips</h3>
        <Link
          to="/plan"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal"
        >
          <Plus className="w-4 h-4" /> New trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="bg-white border border-dashed border-sand rounded-2xl p-12 text-center">
          <p className="text-ink-900/60 mb-4">You haven't planned a trip yet.</p>
          <Link
            to="/plan"
            className="inline-flex items-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
          >
            <Plus className="w-4 h-4" /> Plan your first trip
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trips.map((t, i) => {
            const Icon = coverIcons[i % coverIcons.length];
            return (
              <div key={t._id} className="bg-white border border-sand rounded-2xl overflow-hidden hover:border-teal/40 transition-colors">
                <div className="h-28 bg-teal-light flex items-center justify-center">
                  <Icon className="w-10 h-10 text-teal-dark" strokeWidth={1.5} />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-display text-lg text-ink-900">{t.destination}</h4>
                    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${statusStyle[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-ink-900/50 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5" /> {new Date(t.start_date).toLocaleDateString()} – {new Date(t.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-ink-900/50 flex items-center gap-1.5 mb-4">
                    <Users2 className="w-3.5 h-3.5" /> {t.travelers} travelers · ৳{t.budget.toLocaleString()} budget
                  </p>
                  <button
                    onClick={() => openTrip(t._id)}
                    className="text-sm font-semibold text-teal-dark hover:text-teal"
                  >
                    Open trip →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
