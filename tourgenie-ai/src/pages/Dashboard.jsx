import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Waves, Mountain, Trees, Clock, Users2, X, MapPinned } from "lucide-react";
import AppShell from "../components/AppShell";
import Skeleton, { CardSkeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/ui/Badge";
import EmptyState from "../components/ui/States";
import Button from "../components/ui/Button";
import { tripsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useLanguage } from "../context/LanguageContext";

const coverIcons = [Waves, Mountain, Trees];
// Distinct card artwork per position so a wall of trips doesn't read as one
// repeated teal block.
const coverArt = [
  "from-teal-light via-teal-light to-teal/30",
  "from-sunset-light via-sunset-light to-gold/30",
  "from-sand/70 via-teal-light/70 to-teal/20",
];
function daysUntil(date) {
  return Math.ceil((new Date(date) - Date.now()) / 86400000);
}

export default function Dashboard() {
  const { t } = useLanguage();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
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

  async function handleDelete(trip) {
    setDeletingId(trip._id);
    try {
      await tripsApi.remove(trip._id);
      setTrips((prev) => prev.filter((t) => t._id !== trip._id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  const next = trips.find((t) => t.status === "planned") || trips[0];

  if (loading) {
    return (
      <AppShell title={t("nav.dashboard", "Dashboard")} subtitle="Everything about your trips, in one place.">
        <Skeleton className="h-52 rounded-2xl mb-10" />
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("nav.dashboard", "Dashboard")} subtitle="Everything about your trips, in one place.">
      {error && (
        <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">
          Couldn't load trips: {error}
        </div>
      )}

      {next && (
        <div className="theme-ink bg-ink-900 bg-ink-glow rounded-2xl p-8 mb-10 relative overflow-hidden shadow-lift">
          <svg className="absolute right-0 top-0 h-full w-1/2 opacity-25" viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 120 Q 100 40, 200 90 T 300 60" fill="none" stroke="#EF8354" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" />
            <circle cx="8" cy="118" r="4" fill="#EF8354" />
            <path d="M300 60 L288 53 L288 67 Z" fill="#EF8354" />
          </svg>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <p className="text-xs font-semibold tracking-wide uppercase text-sunset">
                {next.status === "planned" ? "Next departure" : "Latest trip"}
              </p>
              {next.status === "planned" && daysUntil(next.start_date) > 0 && (
                <span className="text-2xs font-bold bg-sunset/15 text-sunset px-2.5 py-1 rounded-full">
                  in {daysUntil(next.start_date)} day{daysUntil(next.start_date) > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <h2 className="font-display text-3xl text-paper mb-1">
              {next.origin} <span className="text-sunset">→</span> {next.destination}
            </h2>
            <p className="text-paper/60 text-sm mb-6">
              {new Date(next.start_date).toLocaleDateString()} – {new Date(next.end_date).toLocaleDateString()} · {next.travelers} travelers
            </p>
            <button onClick={() => openTrip(next._id)} className="btn-primary">
              View itinerary
            </button>
          </div>
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
        <EmptyState
          icon={MapPinned}
          title="No trips yet"
          description="Plan one and it turns up here with its itinerary, budget and bookings attached."
          action={
            <Button as={Link} to="/plan" icon={Plus}>
              Plan your first trip
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trips.map((t, i) => {
            const Icon = coverIcons[i % coverIcons.length];
            return (
              <div
                key={t._id}
                role="button"
                tabIndex={0}
                onClick={() => (confirmId === t._id ? setConfirmId(null) : openTrip(t._id))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  if (confirmId === t._id) setConfirmId(null);
                  else openTrip(t._id);
                }}
                className="group relative text-left card card-hover overflow-hidden flex flex-col cursor-pointer"
              >
                <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
                  {confirmId === t._id ? (
                    <div className="w-40 origin-top-right animate-pop-in bg-surface border border-sand rounded-xl shadow-lift p-3">
                      <p className="text-xs text-ink-900/70 mb-2.5 leading-snug">Delete this trip?</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-full border border-sand text-ink-900/70 hover:bg-sand/40 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          disabled={deletingId === t._id}
                          className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-full bg-sunset hover:bg-sunset-dark text-ink-fixed transition-colors disabled:opacity-60"
                        >
                          {deletingId === t._id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(t._id)}
                      title="Delete trip"
                      aria-label={`Delete trip to ${t.destination}`}
                      className="p-1.5 rounded-full bg-ink-900/60 text-paper opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-sunset transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className={`h-28 bg-gradient-to-br ${coverArt[i % coverArt.length]} flex items-center justify-center relative overflow-hidden`}>
                  <svg className="absolute inset-x-0 bottom-2 w-full h-5 opacity-30" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 14 Q 75 4, 150 12 T 300 8" fill="none" stroke="#0B1F2E" strokeWidth="1.5" strokeDasharray="1 7" strokeLinecap="round" />
                  </svg>
                  <Icon
                    className="w-10 h-10 text-teal-dark transition-transform duration-base group-hover:scale-110 group-hover:-rotate-3"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-display text-lg text-ink-900 leading-snug">{t.destination}</h4>
                    <StatusBadge status={t.status} size="md" className="shrink-0" />
                  </div>
                  <p className="text-xs text-ink-900/50 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5" /> {new Date(t.start_date).toLocaleDateString()} – {new Date(t.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-ink-900/50 flex items-center gap-1.5 mb-4">
                    <Users2 className="w-3.5 h-3.5" /> {t.travelers} travelers · ৳{t.budget.toLocaleString()} budget
                  </p>
                  <span className="mt-auto text-sm font-semibold text-teal-dark inline-flex items-center gap-1 transition-[gap] duration-base ease-tg-out group-hover:gap-2">
                    Open trip <span aria-hidden>→</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
