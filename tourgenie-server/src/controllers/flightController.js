import { searchFlights as searchIgnav, resolveIata } from "../services/ignavFlights.js";
import { searchFlights as searchTravelpayouts } from "../services/travelpayoutsFlights.js";
import Airport from "../models/Airport.js";
import FlightOption from "../models/FlightOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-05 — Flight search.
//
// Providers are tried in order and the first one that actually returns
// fares wins; any provider without a key configured is skipped. Only the
// last entry is fabricated, and it says so in the response so the UI never
// presents invented schedules as bookable flights.
const PROVIDERS = [
  {
    name: "travelpayouts",
    envKey: "TRAVELPAYOUTS_API_KEY",
    search: searchTravelpayouts,
    signupUrl: "https://www.travelpayouts.com",
  },
  {
    name: "ignav",
    envKey: "IGNAV_API_KEY",
    search: searchIgnav,
    signupUrl: "https://ignav.com",
  },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveAirport(value) {
  if (!value) return null;
  const normalized = value.trim();
  if (/^[A-Za-z]{3}$/.test(normalized)) {
    const airport = await Airport.findOne({ iata: normalized.toUpperCase(), is_active: true }).lean();
    if (airport) return airport;
  }
  const exact = new RegExp(`^${escapeRegex(normalized)}$`, "i");
  const airport = await Airport.findOne({
    is_active: true,
    $or: [{ city: exact }, { city_aliases: exact }],
  }).lean();
  if (airport) return airport;
  const fallback = resolveIata(normalized);
  return fallback ? { iata: fallback, city: normalized } : null;
}

function datedTime(date, time, nextDay = false) {
  const value = new Date(`${date}T${time}:00`);
  if (nextDay) value.setDate(value.getDate() + 1);
  return value.toISOString();
}

// Last resort: the recurring schedules in the seed data. These are modelled
// on real routes but the fares and departure times are not live, so they are
// flagged `priceStatus: "indicative"` and the response is marked not-real.
async function seededFlightOffers({ originCode, destinationCode, date, travelers }) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const schedules = await FlightOption.find({
    from_iata: originCode,
    to_iata: destinationCode,
    is_active: true,
    days_of_week: day,
  }).sort({ total_fare_bdt: 1 }).lean();

  return schedules.map((flight) => ({
    id: `seed:${flight._id}:${date}`,
    airline: flight.airline,
    airlineCode: flight.airline_code,
    flightNumber: flight.flight_number,
    origin: flight.from_iata,
    destination: flight.to_iata,
    departure: datedTime(date, flight.depart_time),
    arrival: datedTime(date, flight.arrive_time, flight.arrives_next_day),
    duration: `${Math.floor(flight.duration_min / 60)}h ${flight.duration_min % 60}m`,
    stops: flight.stops,
    price: flight.total_fare_bdt * travelers,
    pricePerSeat: flight.total_fare_bdt,
    currency: "BDT",
    priceStatus: "indicative",
    cabin: flight.cabin.toUpperCase(),
    aircraft: flight.aircraft || null,
    requiresSelfTransfer: false,
    bookingUrl: null,
    source: "seeded",
  }));
}

// GET /api/flights?origin=Dhaka&destination=Dubai&date=2026-09-15&travelers=2
export const getFlights = asyncHandler(async (req, res) => {
  const { origin, destination, date, travelers } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({ message: "origin and destination are required" });
  }

  const [originAirport, destinationAirport] = await Promise.all([
    resolveAirport(origin),
    resolveAirport(destination),
  ]);
  const originCode = originAirport?.iata;
  const destCode = destinationAirport?.iata;

  if (!originCode) {
    return res.status(400).json({
      message: `No airport found for "${origin}". Try a major city name or IATA code.`,
      iataHelp: true,
    });
  }
  if (!destCode) {
    return res.status(400).json({
      message: `No airport found for "${destination}". Try a major city name or IATA code.`,
      iataHelp: true,
    });
  }

  const travelerCount = Math.min(Math.max(Number(travelers) || 1, 1), 9);
  const departureDate = date?.slice(0, 10) || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  let flights = [];
  let source = "seeded";
  const attempts = [];

  for (const provider of PROVIDERS) {
    if (!process.env[provider.envKey]) {
      attempts.push({ provider: provider.name, status: "skipped", reason: `${provider.envKey} not set` });
      continue;
    }
    try {
      const results = await provider.search({
        origin: originCode,
        destination: destCode,
        date: departureDate,
        travelers: travelerCount,
      });
      if (results.length) {
        flights = results;
        source = provider.name;
        attempts.push({ provider: provider.name, status: "ok", count: results.length });
        break;
      }
      attempts.push({ provider: provider.name, status: "empty" });
    } catch (error) {
      console.warn(`${provider.name} flight search failed for ${originCode} → ${destCode}:`, error.message);
      attempts.push({ provider: provider.name, status: "error", reason: error.message });
    }
  }

  if (!flights.length) {
    flights = await seededFlightOffers({
      originCode,
      destinationCode: destCode,
      date: departureDate,
      travelers: travelerCount,
    });
    source = "seeded";
  }

  const isReal = source !== "seeded";
  const dateShifted = flights.some((f) => f.dateShifted);

  res.json({
    flights,
    meta: {
      originCode,
      destCode,
      date: departureDate,
      count: flights.length,
      source,
      // The UI must be able to tell a real fare from a demo one without
      // knowing which providers exist.
      is_real: isReal,
      date_shifted: dateShifted,
      attempts,
      // Shown when nothing real could be reached, so the fix is obvious.
      setup_hint: isReal
        ? null
        : `No live flight provider is configured. Add ${PROVIDERS[0].envKey} to the server .env — a free token takes a minute at ${PROVIDERS[0].signupUrl}.`,
    },
  });
});
