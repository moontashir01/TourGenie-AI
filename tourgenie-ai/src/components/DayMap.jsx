import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { routeApi } from "../lib/api";

// Leaflet's default marker icons reference image files that don't resolve
// under Vite's bundling — divIcon with inline SVG sidesteps that entirely
// and lets the pins match the app's palette.
function pinIcon(color, approximate) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);${approximate ? "opacity:0.75;" : ""}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
const EXACT_ICON = pinIcon("#1C8C82", false);
const APPROX_ICON = pinIcon("#EF8354", true);

// Deterministic small offset so several city-center-fallback markers in the
// same city don't stack exactly on top of one another.
function jitter(lat, lng, index) {
  const angle = index * 2.4;
  const radius = 0.006;
  return [lat + radius * Math.cos(angle), lng + radius * Math.sin(angle)];
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      map.fitBounds(positions, { padding: [28, 28] });
    }
  }, [map, positions]);
  return null;
}

// One route-fetch cache shared across a page session — the same city pair
// (e.g. Bangkok -> Chiang Mai) comes up on multiple days/trips.
const routeCache = new Map();
async function fetchRoute(from, to) {
  const key = `${from}|${to}`;
  if (routeCache.has(key)) return routeCache.get(key);
  const promise = routeApi
    .get(from, to)
    .then((res) => res.route)
    .catch(() => null);
  routeCache.set(key, promise);
  return promise;
}

// Draws the real seeded road/rail/bus corridor between two cities when one
// exists, falling back to a straight dashed line when it doesn't.
function CityLeg({ from, to, fromPos, toPos }) {
  const [geometry, setGeometry] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecked(false);
    fetchRoute(from, to).then((route) => {
      if (cancelled) return;
      setGeometry(route?.geometry?.coordinates?.length > 1 ? route.geometry.coordinates.map(([lng, lat]) => [lat, lng]) : null);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  if (!checked) return null;
  return (
    <Polyline
      positions={geometry || [fromPos, toPos]}
      pathOptions={{
        color: "#1C8C82",
        weight: geometry ? 3 : 2,
        dashArray: geometry ? undefined : "6 6",
        opacity: 0.8,
      }}
    />
  );
}

// Renders the real day-by-day route on a Leaflet map: exact pins for items
// tied to a catalog attraction, approximate city-center pins for everything
// else (meals, check-in, generic activities the AI didn't link), and the
// real seeded corridor geometry between cities where the traveler changes
// city that day.
export default function DayMap({ items, cityCoordinates }) {
  const stops = useMemo(() => {
    const cityGroupIndex = {};
    return items
      .map((item) => {
        const exact = item.attraction_id?.lat_lng?.lat != null;
        let lat, lng;
        if (exact) {
          lat = item.attraction_id.lat_lng.lat;
          lng = item.attraction_id.lat_lng.lng;
        } else {
          const cityPos = cityCoordinates?.[item.city];
          if (!cityPos) return null;
          const idx = cityGroupIndex[item.city] || 0;
          cityGroupIndex[item.city] = idx + 1;
          [lat, lng] = jitter(cityPos.lat, cityPos.lng, idx);
        }
        return { item, position: [lat, lng], exact, city: item.city };
      })
      .filter(Boolean);
  }, [items, cityCoordinates]);

  if (stops.length === 0) {
    return (
      <div className="w-full h-48 rounded-xl bg-paper border border-sand flex items-center justify-center text-xs text-ink-900/40 mb-4">
        No location data available to map this day yet.
      </div>
    );
  }

  const positions = stops.map((s) => s.position);
  const center = positions[0];

  return (
    <div className="w-full h-64 rounded-xl overflow-hidden border border-sand mb-4">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />
        {stops.map((s, i) => (
          <Marker key={i} position={s.position} icon={s.exact ? EXACT_ICON : APPROX_ICON}>
            <Popup>
              <span className="font-semibold">{s.item.time}</span> — {s.item.activity}
              {!s.exact && <div className="text-[11px] opacity-60 mt-0.5">Approximate location ({s.city})</div>}
            </Popup>
          </Marker>
        ))}
        {stops.slice(1).map((s, i) => {
          const prev = stops[i];
          if (prev.city === s.city) {
            return (
              <Polyline
                key={`leg-${i}`}
                positions={[prev.position, s.position]}
                pathOptions={{ color: "#1C8C82", weight: 2, opacity: 0.6 }}
              />
            );
          }
          return <CityLeg key={`leg-${i}`} from={prev.city} to={s.city} fromPos={prev.position} toPos={s.position} />;
        })}
      </MapContainer>
    </div>
  );
}
