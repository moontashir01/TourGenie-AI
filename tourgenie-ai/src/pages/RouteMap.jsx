import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Route as RouteIcon, Clock, Wallet, Leaf, Navigation, MapPin, Plane, Train, Ship, Bus, Car,
  Utensils, Cross, Banknote, Fuel, ShoppingBag, Bath, Loader2, TriangleAlert, ArrowRight,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { PanelSkeleton } from "../components/Skeleton";
import { routeApi, nearbyApi, tripsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useLanguage } from "../context/LanguageContext";

// FR-06 — Route & Map (wireframe §3.7).
//
// The map is the page; the panel beside it offers the real choice between
// seeded route variants, the turn-by-turn legs of whichever is selected,
// and the nearby-service toggles from FR-13 centred on where that leg ends.

// Leaflet's bundled marker images don't resolve under Vite — inline SVG in a
// divIcon sidesteps that and lets the pins match the palette.
function dot(color, size = 16) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
const START_ICON = dot("#1C8C82", 18);
const END_ICON = dot("#EF8354", 18);
const SERVICE_ICON = dot("#D9A441", 11);

const MODE_ICON = { flight: Plane, train: Train, launch: Ship, bus: Bus, driving: Car, walking: Navigation, cycling: Navigation };

const VARIANT_LABEL = {
  fastest: { key: "route.fastest", fallback: "Fastest" },
  shortest: { key: "route.shortest", fallback: "Shortest" },
  scenic: { key: "route.scenic", fallback: "Scenic" },
  cheapest: { key: "route.cheapest", fallback: "Cheapest" },
};

// The six categories the wireframe names, in its order.
const SERVICE_TOGGLES = [
  { category: "restaurant", label: "Restaurants", icon: Utensils },
  { category: "hospital", label: "Hospitals", icon: Cross },
  { category: "atm", label: "ATMs", icon: Banknote },
  { category: "fuel", label: "Fuel", icon: Fuel },
  { category: "shopping", label: "Shopping", icon: ShoppingBag },
  { category: "toilet", label: "Toilets", icon: Bath },
];

const CARBON_TONE = {
  low: "text-teal-dark bg-teal-light",
  moderate: "text-ink-800 bg-gold/20",
  high: "text-sunset-dark bg-sunset-light",
  "very-high": "text-sunset-dark bg-sunset-light",
};

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) map.setView(positions[0], 12);
    else map.fitBounds(positions, { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

export default function RouteMap() {
  const { currentTripId } = useCurrentTrip();
  const { t } = useLanguage();

  const [trip, setTrip] = useState(null);
  const [journey, setJourney] = useState(null);
  const [legIndex, setLegIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeCategory, setActiveCategory] = useState(null);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([tripsApi.get(currentTripId), routeApi.trip(currentTripId)])
      .then(([tripRes, journeyRes]) => {
        if (cancelled) return;
        setTrip(tripRes.trip);
        setJourney(journeyRes);
        setLegIndex(0);
        // Whichever variant the data marks as the default is what the
        // wireframe means by "fastest route selected" on load.
        const first = journeyRes.legs?.[0];
        const defaultIdx = first?.variants?.findIndex((v) => v.is_default) ?? -1;
        setVariantIndex(defaultIdx >= 0 ? defaultIdx : 0);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [currentTripId]);

  const leg = journey?.legs?.[legIndex] || null;
  const variant = leg?.variants?.[variantIndex] || null;

  // Reset the selection when the leg changes, or the index points at a
  // variant that doesn't exist on the new leg.
  function selectLeg(index) {
    setLegIndex(index);
    const next = journey.legs[index];
    const defaultIdx = next?.variants?.findIndex((v) => v.is_default) ?? -1;
    setVariantIndex(defaultIdx >= 0 ? defaultIdx : 0);
    setActiveCategory(null);
    setServices([]);
  }

  // Nearby services are looked up around where the leg ends — that is where
  // the traveller will actually be needing a pharmacy or an ATM.
  useEffect(() => {
    if (!activeCategory || !leg?.to?.lat_lng) {
      setServices([]);
      return;
    }
    let cancelled = false;
    setServicesLoading(true);
    nearbyApi
      .list({
        lat: leg.to.lat_lng.lat,
        lng: leg.to.lat_lng.lng,
        category: activeCategory,
        radius_km: 15,
        limit: 20,
      })
      .then((res) => !cancelled && setServices(res.services || []))
      .catch(() => !cancelled && setServices([]))
      .finally(() => !cancelled && setServicesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeCategory, leg]);

  // Route line: the seeded corridor where one exists, otherwise a straight
  // line between the endpoints — which for a flight is the honest shape.
  const { linePositions, isStraightLine, markerPositions } = useMemo(() => {
    const from = leg?.from?.lat_lng;
    const to = leg?.to?.lat_lng;
    const endpoints = [from, to].filter(Boolean).map((c) => [c.lat, c.lng]);
    const coords = variant?.geometry?.coordinates || [];
    if (coords.length > 1) {
      return { linePositions: coords.map(([lng, lat]) => [lat, lng]), isStraightLine: false, markerPositions: endpoints };
    }
    return { linePositions: endpoints.length === 2 ? endpoints : [], isStraightLine: true, markerPositions: endpoints };
  }, [leg, variant]);

  const servicePositions = services
    .filter((s) => s.lat_lng?.lat != null)
    .map((s) => [s.lat_lng.lat, s.lat_lng.lng]);
  const boundsPositions = [...linePositions, ...servicePositions];

  if (!currentTripId) {
    return (
      <AppShell title={t("route.title", "Route & Map")}>
        <div className="max-w-md p-6 card shadow-soft">
          <p className="text-sm text-ink-900/70">
            Pick a trip first — the map draws the journey for whichever trip you have open.
          </p>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-teal-dark hover:underline">
            Go to my trips <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("route.title", "Route & Map")}
      subtitle={trip ? `${trip.origin} → ${trip.destination}` : undefined}
    >
      {loading ? (
        <PanelSkeleton lines={6} />
      ) : error ? (
        <div className="max-w-lg flex items-start gap-3 p-4 bg-sunset-light border border-sunset/30 rounded-xl">
          <TriangleAlert className="w-5 h-5 text-sunset-dark shrink-0 mt-0.5" />
          <p className="text-sm text-ink-900/80">{error}</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Map — the majority of the screen, per the wireframe */}
          <div className="rounded-2xl overflow-hidden border border-sand shadow-soft h-[420px] lg:h-[calc(100vh-13rem)] bg-surface">
            {boundsPositions.length > 0 ? (
              <MapContainer center={boundsPositions[0]} zoom={8} scrollWheelZoom className="w-full h-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds positions={boundsPositions} />

                {linePositions.length > 1 && (
                  <Polyline
                    positions={linePositions}
                    pathOptions={{
                      color: "#1C8C82",
                      weight: isStraightLine ? 2.5 : 4,
                      opacity: 0.85,
                      dashArray: isStraightLine ? "8 8" : undefined,
                    }}
                  />
                )}

                {markerPositions[0] && (
                  <Marker position={markerPositions[0]} icon={START_ICON}>
                    <Popup>{leg.from.name}</Popup>
                  </Marker>
                )}
                {markerPositions[1] && (
                  <Marker position={markerPositions[1]} icon={END_ICON}>
                    <Popup>{leg.to.name}</Popup>
                  </Marker>
                )}

                {services
                  .filter((s) => s.lat_lng?.lat != null)
                  .map((s) => (
                    <Marker key={s._id} position={[s.lat_lng.lat, s.lat_lng.lng]} icon={SERVICE_ICON}>
                      <Popup>
                        <span className="font-semibold">{s.name}</span>
                        <div className="text-2xs opacity-70 mt-0.5">
                          {s.subcategory || s.category}
                          {s.distance_m != null && ` · ${(s.distance_m / 1000).toFixed(1)} km`}
                        </div>
                        {s.opening_hours && <div className="text-2xs opacity-60">{s.opening_hours}</div>}
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-ink-500 px-6 text-center">
                No coordinates recorded for this leg, so there is nothing to draw yet.
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-5 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pr-1">
            {/* Journey legs */}
            {journey?.legs?.length > 1 && (
              <section>
                <h2 className="font-display text-base text-ink-900 mb-2">
                  {t("route.journey_legs", "Journey legs")}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {journey.legs.map((l, i) => {
                    const best = l.variants.find((v) => v.is_default) || l.variants[0];
                    const Icon = MODE_ICON[best?.mode] || RouteIcon;
                    return (
                      <button
                        key={i}
                        onClick={() => selectLeg(i)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          i === legIndex
                            ? "bg-teal-light border-teal/40 text-teal-dark"
                            : "bg-surface border-sand text-ink-900/70 hover:border-teal/30"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                        <span className="flex-1 min-w-0 text-sm font-medium truncate">
                          {l.from.name} → {l.to.name}
                        </span>
                        <span className="text-xs font-mono shrink-0 opacity-70">
                          {best ? formatDuration(best.duration_min) : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Route options */}
            <section>
              <h2 className="font-display text-base text-ink-900 mb-2">
                {t("route.options", "Route options")}
              </h2>
              {leg?.variants?.length ? (
                <div className="flex flex-col gap-2">
                  {leg.variants.map((v, i) => {
                    const Icon = MODE_ICON[v.mode] || RouteIcon;
                    const label = VARIANT_LABEL[v.variant];
                    const selected = i === variantIndex;
                    return (
                      <button
                        key={v._id || i}
                        onClick={() => setVariantIndex(i)}
                        className={`p-3 rounded-xl border text-left transition ${
                          selected
                            ? "bg-surface border-teal shadow-soft ring-1 ring-teal/20"
                            : "bg-surface/60 border-sand hover:border-teal/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-4 h-4 text-teal-dark shrink-0" strokeWidth={1.75} />
                          <span className="text-sm font-semibold text-ink-900">
                            {label ? t(label.key, label.fallback) : v.variant}
                          </span>
                          <span className="text-3xs uppercase tracking-wide text-ink-500">{v.mode}</span>
                          {selected && <span className="ml-auto w-2 h-2 rounded-full bg-teal" />}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-600">
                          <span className="flex items-center gap-1">
                            <Navigation className="w-3 h-3" /> {v.distance_km} km
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDuration(v.duration_min)}
                          </span>
                          {v.est_fare_bdt > 0 && (
                            <span className="flex items-center gap-1">
                              <Wallet className="w-3 h-3" /> ৳{v.est_fare_bdt.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {v.carbon_per_person_kg > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-3xs font-semibold ${
                              CARBON_TONE[v.carbon_rating] || "bg-sand/50 text-ink-600"
                            }`}
                          >
                            <Leaf className="w-3 h-3" />
                            {v.carbon_per_person_kg} kg CO₂ per person
                          </span>
                        )}
                        {v.flight && (
                          <p className="mt-1.5 text-2xs text-ink-500">
                            {v.flight.airline} {v.flight.flight_number} · {v.flight.depart_time}–{v.flight.arrive_time}
                            {v.flight.stops > 0 && ` · ${v.flight.stops} stop`}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-ink-500 p-3 bg-surface border border-sand rounded-xl">
                  No route is recorded for this leg yet — the map shows a direct line between the two points instead.
                </p>
              )}
            </section>

            {/* Turn-by-turn */}
            {variant?.legs?.length > 0 && (
              <section>
                <h2 className="font-display text-base text-ink-900 mb-2">Directions</h2>
                <ol className="space-y-2">
                  {variant.legs.map((step) => (
                    <li key={step.sequence} className="flex gap-3 p-3 bg-surface border border-sand rounded-xl">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-teal-light text-teal-dark text-xs font-bold flex items-center justify-center">
                        {step.sequence}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-900 leading-snug">{step.instruction}</p>
                        <p className="text-2xs text-ink-500 mt-0.5 font-mono">
                          {step.distance_km} km · {formatDuration(step.duration_min)}
                          {step.road && ` · ${step.road}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {leg?.reversed && (
              <p className="text-2xs text-ink-500 -mt-3">
                This leg is the return direction of a recorded route, so step-by-step directions are not shown.
              </p>
            )}

            {/* Nearby services (FR-13) */}
            <section>
              <h2 className="font-display text-base text-ink-900 mb-1">
                {t("route.nearby_services", "Nearby services")}
              </h2>
              <p className="text-2xs text-ink-500 mb-2">
                Around {leg?.to?.name || "your destination"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_TOGGLES.map(({ category, label, icon: Icon }) => {
                  const on = activeCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(on ? null : category)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        on
                          ? "bg-gold/20 border-gold/50 text-ink-900"
                          : "bg-surface border-sand text-ink-600 hover:border-gold/40"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {servicesLoading && (
                <p className="flex items-center gap-2 mt-3 text-sm text-ink-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                </p>
              )}

              {!servicesLoading && activeCategory && services.length === 0 && (
                <p className="mt-3 text-sm text-ink-500">
                  Nothing recorded in this category within 15 km.
                </p>
              )}

              {services.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {services.map((s) => (
                    <li key={s._id} className="flex items-start gap-2 p-2.5 bg-surface border border-sand rounded-lg">
                      <MapPin className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-900 truncate">{s.name}</p>
                        <p className="text-2xs text-ink-500">
                          {s.is_24h ? "Open 24 hours" : s.opening_hours || s.subcategory || s.category}
                        </p>
                      </div>
                      {s.distance_m != null && (
                        <span className="text-2xs font-mono text-ink-500 shrink-0">
                          {(s.distance_m / 1000).toFixed(1)} km
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
