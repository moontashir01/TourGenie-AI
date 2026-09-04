import { useEffect, useMemo, useState } from "react";
import {
  Search, Scale, X, Check, Loader2, ArrowLeft, Navigation, Clock, Wallet, Leaf,
  Landmark, Building2, CalendarRange, Plane, Train, Ship, Bus, Car, TriangleAlert, Star,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { CardSkeleton } from "../components/Skeleton";
import BestTimeStrip from "../components/BestTimeStrip";
import { destinationsApi, tripsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useLanguage } from "../context/LanguageContext";

// Explore the catalogue, then put up to four destinations side by side.
//
// The comparison answers the question people actually have before they can
// fill in a Plan Trip form — "which of these should I go to, and when" —
// which is a question the planner itself cannot help with.

const MAX_COMPARE = 4;

const MODE_ICON = { flight: Plane, train: Train, launch: Ship, bus: Bus, driving: Car };

const TYPE_TONE = {
  beach: "bg-teal-light text-teal-dark",
  island: "bg-teal-light text-teal-dark",
  hill: "bg-gold/20 text-ink-800",
  forest: "bg-teal-light text-teal-dark",
  nature: "bg-teal-light text-teal-dark",
  heritage: "bg-sunset-light text-sunset-dark",
  city: "bg-sand/60 text-ink-800",
  metro: "bg-sand/60 text-ink-800",
};

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// A row that renders across all columns, so the eye can scan one attribute
// at a time rather than reading four cards top to bottom.
function CompareRow({ label, icon: Icon, children }) {
  return (
    <div className="border-t border-sand pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-900/40 mb-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      {children}
    </div>
  );
}

export default function Destinations() {
  const { currentTripId } = useCurrentTrip();
  const { t } = useLanguage();

  const [destinations, setDestinations] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [selected, setSelected] = useState([]);

  const [origin, setOrigin] = useState("Dhaka");
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setLoading(true);
    destinationsApi
      .list({ limit: 200 })
      .then((res) => {
        setDestinations(res.destinations || []);
        setCountries(res.countries || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Default the "getting there" origin to the trip the traveller has open,
  // since that is the journey they are actually costing.
  useEffect(() => {
    if (!currentTripId) return;
    tripsApi
      .get(currentTripId)
      .then(({ trip }) => trip?.origin && setOrigin(trip.origin))
      .catch(() => {});
  }, [currentTripId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return destinations.filter((d) => {
      if (country && d.country_code !== country) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.summary?.toLowerCase().includes(q) ||
        d.tags?.some((tag) => tag.includes(q)) ||
        d.country?.toLowerCase().includes(q)
      );
    });
  }, [destinations, query, country]);

  function toggle(slug) {
    setComparison(null);
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, slug]
    );
  }

  function runComparison() {
    if (selected.length < 2) return;
    setComparing(true);
    setError("");
    destinationsApi
      .compare(selected, origin)
      .then(setComparison)
      .catch((err) => setError(err.message))
      .finally(() => setComparing(false));
  }

  const selectedNames = selected
    .map((slug) => destinations.find((d) => d.slug === slug)?.name)
    .filter(Boolean);

  return (
    <AppShell
      title={t("destination.title", "Explore & Compare")}
      subtitle={t(
        "destination.subtitle",
        "Browse every destination, then put up to four side by side to see cost, climate and how long it takes to get there."
      )}
    >
      {error && (
        <div className="max-w-lg flex items-start gap-3 p-4 mb-6 bg-sunset-light border border-sunset/30 rounded-xl">
          <TriangleAlert className="w-5 h-5 text-sunset-dark shrink-0 mt-0.5" />
          <p className="text-sm text-ink-900/80">{error}</p>
        </div>
      )}

      {comparison ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <button
              onClick={() => setComparison(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-sand rounded-xl text-sm font-medium text-ink-900/70 hover:border-teal/40"
            >
              <ArrowLeft className="w-4 h-4" /> {t("destination.back", "Back to browse")}
            </button>
            <label className="flex items-center gap-2 px-3 py-2 bg-surface border border-sand rounded-xl text-sm">
              <Navigation className="w-4 h-4 text-teal-dark shrink-0" />
              <span className="text-ink-900/50 text-xs">{t("destination.travelling_from", "Travelling from")}</span>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onBlur={runComparison}
                onKeyDown={(e) => e.key === "Enter" && runComparison()}
                className="w-28 bg-transparent font-medium text-ink-900 focus:outline-none"
              />
            </label>
            {comparing && <Loader2 className="w-4 h-4 animate-spin text-teal-dark" />}
          </div>

          <div className="overflow-x-auto -mx-6 md:-mx-10 px-6 md:px-10 pb-4">
            <div
              className="grid gap-4 min-w-max"
              style={{ gridTemplateColumns: `repeat(${comparison.columns.length}, minmax(280px, 340px))` }}
            >
              {comparison.columns.map((col) => {
                const d = col.destination;
                const JourneyIcon = MODE_ICON[col.journey?.mode] || Navigation;
                return (
                  <article key={d.slug} className="p-4 bg-surface border border-sand rounded-2xl shadow-soft">
                    <header className="mb-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-display text-lg text-ink-900 leading-tight">{d.name}</h2>
                        <button
                          onClick={() => {
                            const next = selected.filter((s) => s !== d.slug);
                            setSelected(next);
                            setComparison(null);
                          }}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-ink-900/30 hover:text-sunset-dark hover:bg-sunset/10 shrink-0"
                          aria-label={`Remove ${d.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-ink-900/50">{d.country}{d.division ? ` · ${d.division}` : ""}</p>
                      <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-3xs font-semibold ${TYPE_TONE[d.type] || "bg-sand/60 text-ink-800"}`}>
                        {d.type}
                      </span>
                    </header>

                    <CompareRow label={t("destination.best_time", "Best time to visit")} icon={CalendarRange}>
                      <BestTimeStrip months={col.months} summary={col.climate_summary} compact />
                    </CompareRow>

                    <CompareRow label={t("destination.getting_there", "Getting there")} icon={JourneyIcon}>
                      {col.journey ? (
                        <div className="text-xs text-ink-900/70 space-y-1">
                          <p className="flex flex-wrap gap-x-3">
                            <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{col.journey.distance_km} km</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(col.journey.duration_min)}</span>
                          </p>
                          <p className="flex flex-wrap gap-x-3">
                            {col.journey.est_fare_bdt > 0 && (
                              <span className="flex items-center gap-1"><Wallet className="w-3 h-3" />৳{col.journey.est_fare_bdt.toLocaleString()}</span>
                            )}
                            {col.journey.carbon_kg > 0 && (
                              <span className="flex items-center gap-1"><Leaf className="w-3 h-3" />{col.journey.carbon_kg} kg CO₂</span>
                            )}
                          </p>
                          <p className="text-2xs text-ink-900/45">
                            by {col.journey.mode}
                            {!col.journey.direct && col.journey.via.length > 0 && ` · via ${col.journey.via.join(", ")}`}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-900/40">
                          No route recorded from {comparison.origin || "your origin"}.
                        </p>
                      )}
                    </CompareRow>

                    <CompareRow label={t("destination.daily_cost", "Cost per person per day")} icon={Wallet}>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {["budget", "mid", "luxury"].map((tier) => (
                          <div key={tier} className="p-2 rounded-lg bg-paper border border-sand">
                            <p className="text-3xs uppercase tracking-wide text-ink-900/40">{tier}</p>
                            <p className="text-sm font-semibold text-ink-900 mt-0.5">
                              {col.cost[tier] ? `৳${col.cost[tier].per_day.toLocaleString()}` : "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                      {col.cost.mid?.notes && (
                        <p className="mt-1.5 text-2xs text-ink-900/50 leading-snug">{col.cost.mid.notes}</p>
                      )}
                    </CompareRow>

                    <CompareRow label={t("destination.what_to_do", "What there is to do")} icon={Landmark}>
                      <p className="text-xs text-ink-900/70">
                        <span className="font-semibold text-ink-900">{col.attractions.count}</span> attractions
                        {col.attractions.free_count > 0 && (
                          <span className="text-ink-900/50"> · {col.attractions.free_count} free</span>
                        )}
                      </p>
                      {col.attractions.top.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {col.attractions.top.map((a) => (
                            <li key={a.name} className="text-2xs text-ink-900/60 truncate">· {a.name}</li>
                          ))}
                        </ul>
                      )}
                    </CompareRow>

                    <CompareRow label={t("destination.staying", "Where to stay")} icon={Building2}>
                      {col.hotels.count > 0 ? (
                        <p className="text-xs text-ink-900/70">
                          <span className="font-semibold text-ink-900">{col.hotels.count}</span> hotels ·
                          ৳{col.hotels.min_price?.toLocaleString()}–৳{col.hotels.max_price?.toLocaleString()}
                          {col.hotels.avg_rating > 0 && (
                            <span className="inline-flex items-center gap-0.5 ml-1.5 text-ink-900/50">
                              <Star className="w-3 h-3 fill-gold text-gold" />
                              {col.hotels.avg_rating.toFixed(1)}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-900/40">No hotels recorded yet.</p>
                      )}
                    </CompareRow>

                    <CompareRow label={t("destination.suggested_length", "Suggested length")} icon={CalendarRange}>
                      <p className="text-xs text-ink-900/70">
                        <span className="font-semibold text-ink-900">{d.recommended_days}</span> days
                      </p>
                      {d.summary && (
                        <p className="mt-1.5 text-2xs text-ink-900/55 leading-relaxed">{d.summary}</p>
                      )}
                    </CompareRow>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <label className="flex items-center gap-2 px-3 py-2 bg-surface border border-sand rounded-xl flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-ink-900/35 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("destination.search", "Search destinations…")}
                className="flex-1 min-w-0 bg-transparent text-sm text-ink-900 placeholder:text-ink-900/35 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-ink-900/30 hover:text-ink-900/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="px-3 py-2 bg-surface border border-sand rounded-xl text-sm text-ink-900 focus:outline-none cursor-pointer"
            >
              <option value="">{t("common.all", "All")} countries</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.destinations})
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} media={false} />)}
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-ink-900/50">{t("common.no_results", "No results found.")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
              {visible.map((d) => {
                const isSelected = selected.includes(d.slug);
                const atLimit = !isSelected && selected.length >= MAX_COMPARE;
                return (
                  <article
                    key={d.slug}
                    className={`p-4 bg-surface rounded-2xl border transition ${
                      isSelected ? "border-teal ring-1 ring-teal/20 shadow-soft" : "border-sand hover:shadow-soft"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-display text-base text-ink-900 leading-tight truncate">{d.name}</h2>
                        <p className="text-xs text-ink-900/50 truncate">
                          {d.country}{d.division ? ` · ${d.division}` : ""}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold shrink-0 ${TYPE_TONE[d.type] || "bg-sand/60 text-ink-800"}`}>
                        {d.type}
                      </span>
                    </div>

                    {d.summary && (
                      <p className="mt-2 text-xs text-ink-900/60 leading-relaxed line-clamp-3">{d.summary}</p>
                    )}

                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-2xs text-ink-900/55">
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> ৳{d.avg_daily_cost?.toLocaleString()}/day
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarRange className="w-3 h-3" /> {d.recommended_days} days
                      </span>
                    </div>

                    <button
                      onClick={() => toggle(d.slug)}
                      disabled={atLimit}
                      className={`w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        isSelected
                          ? "bg-teal text-white"
                          : atLimit
                            ? "bg-sand/40 text-ink-900/30 cursor-not-allowed"
                            : "bg-paper border border-sand text-ink-900/70 hover:border-teal/40 hover:text-teal-dark"
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <Scale className="w-3.5 h-3.5" />}
                      {isSelected
                        ? t("destination.selected", "Selected")
                        : atLimit
                          ? t("destination.limit", "Limit reached")
                          : t("destination.add_compare", "Compare")}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {/* Selection tray */}
          {selected.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 md:left-64 z-30 border-t border-sand bg-paper/95 backdrop-blur px-6 md:px-10 py-3 animate-fade-up">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-ink-900/60">
                  <span className="font-semibold text-ink-900">{selected.length}</span> of {MAX_COMPARE} selected
                  <span className="hidden sm:inline text-ink-900/45"> · {selectedNames.join(", ")}</span>
                </span>
                <button
                  onClick={() => setSelected([])}
                  className="text-xs text-ink-900/45 hover:text-sunset-dark underline"
                >
                  {t("common.cancel", "Clear")}
                </button>
                <button
                  onClick={runComparison}
                  disabled={selected.length < 2 || comparing}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-teal text-white disabled:bg-sand disabled:text-ink-900/35 hover:bg-teal-dark transition-colors"
                >
                  {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                  {selected.length < 2
                    ? t("destination.pick_two", "Pick at least two")
                    : t("destination.compare_cta", "Compare")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
