// FR-06 — Route Optimization. Serves the precomputed Route rows (real
// corridor geometry + turn-by-turn legs) so the map can draw an actual
// road/rail/bus shape between two cities instead of a straight line,
// wherever a matching row was seeded.
import Route from "../models/Route.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Destination from "../models/Destination.js";
import CarbonFactor from "../models/CarbonFactor.js";
import Airport from "../models/Airport.js";
import FlightOption from "../models/FlightOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findTripForUser, VIEW } from "../services/tripAccess.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exact(name) {
  return new RegExp(`^${escapeRegex(String(name).trim())}$`, "i");
}

function nameFilter(from, to) {
  // `$ne: false` and not `true`: routes seeded before is_active
  // existed don't carry the field, and an admin soft delete sets it
  // to false, so this is what hides a deleted route without hiding
  // every route that predates the flag.
  return { "from.name": exact(from), "to.name": exact(to), is_active: { $ne: false } };
}

// A route seeded only as A->B still describes the B->A journey: same road,
// same distance, same duration. Reversing it is cheaper and more honest than
// seeding every pair twice, as long as the turn-by-turn legs — which are
// direction-specific prose — are dropped rather than shown backwards.
function reverseRoute(route) {
  return {
    ...route,
    from: route.to,
    to: route.from,
    geometry: route.geometry?.coordinates
      ? { ...route.geometry, coordinates: [...route.geometry.coordinates].reverse() }
      : route.geometry,
    legs: [],
    reversed: true,
  };
}

// GET /api/routes?from=Dhaka&to=Cox's Bazar&mode=driving
// Direction-sensitive (from->to), since a seeded pair may only exist in one
// direction; the caller falls back to swapping from/to itself.
export const getRoute = asyncHandler(async (req, res) => {
  const { from, to, mode } = req.query;
  if (!from?.trim() || !to?.trim()) {
    return res.status(400).json({ message: "from and to are required" });
  }

  const filter = nameFilter(from, to);
  if (mode) filter.mode = mode;

  const route = await Route.findOne(filter).sort({ is_default: -1, distance_km: 1 });
  res.json({ route: route || null });
});

// GET /api/routes/options?from=Dhaka&to=Cox's Bazar
//
// Every seeded variant for the pair, so the Route & Map page can offer a
// real choice (fastest / scenic / cheapest) rather than labelling a single
// row "fastest". Falls back to the reverse direction when the pair was only
// seeded one way.
export const getRouteOptions = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from?.trim() || !to?.trim()) {
    return res.status(400).json({ message: "from and to are required" });
  }

  let routes = await Route.find(nameFilter(from, to))
    .sort({ is_default: -1, duration_min: 1 })
    .lean();
  let reversed = false;

  if (routes.length === 0) {
    const back = await Route.find(nameFilter(to, from)).sort({ is_default: -1, duration_min: 1 }).lean();
    routes = back.map(reverseRoute);
    reversed = routes.length > 0;
  }

  res.json({ routes, reversed, count: routes.length });
});

// Great-circle distance in km. A flight leg has no road geometry to measure,
// and the straight line is genuinely what the aircraft approximates.
function haversineKm(a, b) {
  if (!a?.lat || !b?.lat) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(h))).toFixed(1);
}

// International legs have no seeded road corridor because nobody drives
// them. The journey is still real — it's a flight — so the schedules in
// FlightOption stand in for route variants, shaped the same way so the map
// and the options panel don't need to know the difference.
async function flightVariants(fromName, toName, fromCoords, toCoords) {
  const airports = await Airport.find({
    $or: [
      { city: exact(fromName) },
      { city: exact(toName) },
      { city_aliases: exact(fromName) },
      { city_aliases: exact(toName) },
    ],
    is_active: true,
  }).lean();

  const matches = (airport, name) =>
    airport.city.toLowerCase() === name.toLowerCase() ||
    (airport.city_aliases || []).some((a) => a.toLowerCase() === name.toLowerCase());

  const fromCodes = airports.filter((a) => matches(a, fromName)).map((a) => a.iata);
  const toCodes = airports.filter((a) => matches(a, toName)).map((a) => a.iata);
  if (fromCodes.length === 0 || toCodes.length === 0) return [];

  const flights = await FlightOption.find({
    from_iata: { $in: fromCodes },
    to_iata: { $in: toCodes },
    is_active: true,
  })
    .sort({ total_fare_bdt: 1 })
    .limit(4)
    .lean();
  if (flights.length === 0) return [];

  const distance = haversineKm(fromCoords, toCoords);
  const cheapestId = String(flights[0]._id);
  const quickestId = String([...flights].sort((a, b) => a.duration_min - b.duration_min)[0]._id);

  return flights.map((f) => {
    const id = String(f._id);
    return {
      _id: f._id,
      variant: id === cheapestId ? "cheapest" : id === quickestId ? "fastest" : "shortest",
      mode: "flight",
      is_default: id === cheapestId,
      distance_km: distance,
      duration_min: f.duration_min,
      est_fare_bdt: f.total_fare_bdt,
      // A flight has no road to trace; the map draws the great circle.
      geometry: { type: "LineString", coordinates: [] },
      legs: [
        {
          sequence: 1,
          instruction: `${f.airline} ${f.flight_number} — ${f.from_iata} ${f.depart_time} to ${f.to_iata} ${f.arrive_time}`,
          road: f.aircraft || "",
          distance_km: distance,
          duration_min: f.duration_min,
          via: (f.via || []).join(", "),
        },
      ],
      flight: {
        airline: f.airline,
        flight_number: f.flight_number,
        depart_time: f.depart_time,
        arrive_time: f.arrive_time,
        stops: f.stops,
        baggage_kg: f.baggage_kg,
      },
    };
  });
}

// Collapse an itinerary into the sequence of cities the traveller actually
// moves between: consecutive items in the same city are one stay, not a leg.
function cityLegsFromItinerary(items) {
  const sequence = [];
  for (const item of items) {
    const city = item.city?.trim();
    if (city && sequence[sequence.length - 1] !== city) sequence.push(city);
  }
  return sequence;
}

// Aviation emits differently by stage length, and a 70-minute domestic hop
// is the worst of the three per kilometre — most of its fuel goes on takeoff.
function carbonKeyFor(mode, distanceKm) {
  if (mode === "driving") return "car_petrol";
  if (mode !== "flight") return mode;
  if (distanceKm > 1500) return "flight_long";
  if (distanceKm > 700) return "flight_short";
  return "flight_domestic";
}

// GET /api/trips/:tripId/route
//
// The whole journey as an ordered list of legs — the outbound trip from the
// origin, every city change the itinerary makes, and the return home. Each
// leg carries all its route variants plus endpoint coordinates, so the map
// can draw a leg even where no corridor was seeded for it.
export const getTripJourney = asyncHandler(async (req, res) => {
  const trip = await findTripForUser(req.params.tripId, req.user._id, { level: VIEW, lean: true });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const items = await ItineraryItem.find({ trip_id: trip._id })
    .select("city day time")
    .sort({ day: 1, time: 1 })
    .lean();

  // Cities visited, in order. Multi-city trips get this from the itinerary;
  // a single-destination trip is just the destination itself.
  const visited = trip.multi_city
    ? cityLegsFromItinerary(items)
    : [trip.destination].filter(Boolean);
  const entry = trip.entry_city || visited[0] || trip.destination;
  const path = [trip.origin, ...(visited.length ? visited : [entry])];

  // Home again — but not if the trip already ends where it started.
  if (path[path.length - 1] !== trip.origin) path.push(trip.origin);

  // Coordinates for every city named, so a leg with no seeded corridor can
  // still be drawn as a straight line between two real points.
  const names = [...new Set(path)];
  const patterns = names.map(exact);
  const destinations = await Destination.find({
    $or: [{ name: { $in: patterns } }, { aliases: { $in: patterns } }],
  })
    .select("name aliases lat_lng country country_code")
    .lean();

  const coordsByName = new Map();
  for (const d of destinations) {
    coordsByName.set(d.name.toLowerCase(), d.lat_lng);
    for (const alias of d.aliases || []) coordsByName.set(alias.toLowerCase(), d.lat_lng);
  }

  const factors = await CarbonFactor.find({ is_active: { $ne: false } }).lean();
  const factorByMode = new Map(factors.map((f) => [f.mode, f]));

  const legs = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const fromCoords = coordsByName.get(from.toLowerCase()) || null;
    const toCoords = coordsByName.get(to.toLowerCase()) || null;

    let variants = await Route.find(nameFilter(from, to)).sort({ is_default: -1, duration_min: 1 }).lean();
    let isReversed = false;
    if (variants.length === 0) {
      const back = await Route.find(nameFilter(to, from)).sort({ is_default: -1, duration_min: 1 }).lean();
      variants = back.map(reverseRoute);
      isReversed = variants.length > 0;
    }
    if (variants.length === 0) {
      variants = await flightVariants(from, to, fromCoords, toCoords);
    }

    // Carbon per variant, from the same factor table FR-16 uses, so the
    // figure shown next to a route matches the one on the Budget page.
    variants = variants.map((v) => {
      const factor = factorByMode.get(carbonKeyFor(v.mode, v.distance_km)) || factorByMode.get(v.mode);
      const perPerson = factor
        ? +((v.distance_km * factor.grams_co2_per_passenger_km) / 1000).toFixed(1)
        : v.carbon_kg || 0;
      return { ...v, carbon_per_person_kg: perPerson, carbon_rating: factor?.rating || "" };
    });

    legs.push({
      sequence: i + 1,
      from: { name: from, lat_lng: fromCoords },
      to: { name: to, lat_lng: toCoords },
      is_return: i === path.length - 2 && to === trip.origin && path.length > 2,
      variants,
      reversed: isReversed,
    });
  }

  res.json({
    trip: {
      _id: trip._id,
      origin: trip.origin,
      destination: trip.destination,
      multi_city: trip.multi_city,
      travelers: trip.travelers,
      start_date: trip.start_date,
      end_date: trip.end_date,
    },
    path,
    legs,
  });
});
