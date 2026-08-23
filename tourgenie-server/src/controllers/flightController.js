import { searchFlights as searchIgnav, resolveIata } from "../services/ignavFlights.js";
import { searchFlights as searchTravelpayouts } from "../services/travelpayoutsFlights.js";
import Airport from "../models/Airport.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-05 — Flight search.
//
// Fares come from live providers ONLY. The seeded FlightOption schedules are
// deliberately never consulted — the fallback that used to fabricate demo
// offers from the database has been removed, so an empty result means "no
// fares found", never an invented schedule.
const PROVIDERS = [
  {
    name: "travelpayouts",
    envKey: "TRAVELPAYOUTS_API_KEY",
    search: searchTravelpayouts,
    signupUrl: "https://www.travelpayouts.com",
    supportsRoundTrip: true,
  },
  {
    name: "ignav",
    envKey: "IGNAV_API_KEY",
    search: searchIgnav,
    signupUrl: "https://ignav.com",
    supportsRoundTrip: false,
  },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function resolveAirport(value) {
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

// GET /api/flights?origin=Dhaka&destination=Dubai&date=2026-09-15&return_date=2026-09-22&travelers=2
// With return_date the fares quoted are ROUND TRIP — one figure covering both
// directions, so the budget counts the airfare exactly once.
export const getFlights = asyncHandler(async (req, res) => {
  const { origin, destination, date, return_date, travelers } = req.query;

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
  const returnDate = return_date?.slice(0, 10) || null;
  if (returnDate && returnDate < departureDate) {
    return res.status(400).json({ message: "return_date must be on or after the departure date" });
  }

  let flights = [];
  let source = "none";
  const attempts = [];
  const anyConfigured = PROVIDERS.some((p) => process.env[p.envKey]);

  for (const provider of PROVIDERS) {
    if (!process.env[provider.envKey]) {
      attempts.push({ provider: provider.name, status: "skipped", reason: `${provider.envKey} not set` });
      continue;
    }
    if (returnDate && !provider.supportsRoundTrip) {
      attempts.push({ provider: provider.name, status: "skipped", reason: "round-trip search not supported" });
      continue;
    }
    try {
      const results = await provider.search({
        origin: originCode,
        destination: destCode,
        date: departureDate,
        returnDate,
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

  const dateShifted = flights.some((f) => f.dateShifted);

  res.json({
    flights,
    meta: {
      originCode,
      destCode,
      date: departureDate,
      return_date: returnDate,
      round_trip: Boolean(returnDate),
      count: flights.length,
      source,
      is_real: flights.length > 0,
      date_shifted: dateShifted,
      attempts,
      // Shown only when no provider key exists at all; an empty result from a
      // configured provider is a genuine "no fares found", not a setup problem.
      setup_hint: anyConfigured
        ? null
        : `No live flight provider is configured. Add ${PROVIDERS[0].envKey} to the server .env — a free token takes a minute at ${PROVIDERS[0].signupUrl}.`,
    },
  });
});
