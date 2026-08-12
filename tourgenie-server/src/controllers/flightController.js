import { searchFlights, resolveIata } from "../services/ignavFlights.js";
import Airport from "../models/Airport.js";
import FlightOption from "../models/FlightOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    currency: "BDT",
    priceStatus: "indicative",
    cabin: flight.cabin.toUpperCase(),
    aircraft: flight.aircraft || null,
    requiresSelfTransfer: false,
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

  if (process.env.IGNAV_API_KEY) {
    try {
      flights = await searchFlights({
        origin: originCode,
        destination: destCode,
        date: departureDate,
        travelers: travelerCount,
      });
      source = "ignav";
    } catch (error) {
      console.warn(`Live flight search failed for ${originCode} → ${destCode}; using seeded schedules:`, error.message);
    }
  }
  if (!flights.length) {
    flights = await seededFlightOffers({
      originCode,
      destinationCode: destCode,
      date: departureDate,
      travelers: travelerCount,
    });
  }

  res.json({
    flights,
    meta: {
      originCode,
      destCode,
      date: departureDate,
      count: flights.length,
      source,
    },
  });
});
