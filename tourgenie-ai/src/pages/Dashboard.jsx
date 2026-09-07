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
import SectionHeader from "../components/ui/SectionHeader";
import PageHeroPanel from "../components/ui/PageHeroPanel";

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
    // The sidebar's NavLinks already pass viewTransition; this navigation is
    // programmatic, so it has to opt in itself or the trip title has nothing
    // to morph into.
    navigate("/itinerary", { viewTransition: true });
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
        <div className="card rounded-3xl p-8 mb-10 flex items-start justify-between gap-6" aria-hidden>
          <div className="w-full max-w-md space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-10 w-36 rounded-full mt-3" />
          </div>
          <div className="hidden sm:block space-y-2 text-right shrink-0">
            <Skeleton className="h-8 w-14 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-7 w-32" />
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
        <PageHeroPanel art className="p-8 mb-10">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide uppercase text-sunset mb-2">
                {next.status === "planned" ? "Next departure" : "Latest trip"}
              </p>
              <h2 className="font-display text-display-sm text-paper mb-1">
                {next.origin} <span className="text-sunset">→</span> {next.destination}
              </h2>
              <p className="text-paper/60 text-sm mb-6">
                {new Date(next.start_date).toLocaleDateString()} – {new Date(next.end_date).toLocaleDateString()} · {next.travelers} travelers
              </p>
              <Button onClick={() => openTrip(next._id)}>View itinerary</Button>
            </div>
            {next.status === "planned" && daysUntil(next.start_date) > 0 && (
              <div className="shrink-0 text-right">
                <p className="font-display text-display-sm text-sunset tabular-nums leading-none">
                  {daysUntil(next.start_date)}
                </p>
                <p className="text-2xs font-semibold uppercase tracking-wide text-paper/60 mt-1">
                  day{daysUntil(next.start_date) > 1 ? "s" : ""} to go
                </p>
              </div>
            )}
          </div>
        </PageHeroPanel>
      )}

      <SectionHeader
        title="My Trips"
        count={trips.length || undefined}
        action={
          <Link
            to="/plan"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal"
          >
            <Plus className="w-4 h-4" /> New trip
          </Link>
        }
      />

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
                      <p className="text-sm text-ink-900/70 mb-2.5 leading-snug">Delete this trip?</p>
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
                    <h4
                      className="font-display text-lg text-ink-900 leading-snug"
                      style={{ viewTransitionName: `trip-title-${t._id}` }}
                    >
                      {t.destination}
                    </h4>
                    <StatusBadge status={t.status} size="md" className="shrink-0" />
                  </div>
                  <p className="text-sm text-ink-500 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5" /> {new Date(t.start_date).toLocaleDateString()} – {new Date(t.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-ink-500 flex items-center gap-1.5 mb-4">
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
