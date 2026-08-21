// Real flight fares via the Travelpayouts (Aviasales) Data API.
// https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API
//
// Why this one: the token is free and self-serve (no card, no partner
// approval, no per-call billing), and the data is real — these are fares
// Aviasales users actually found in the last 48 hours, complete with a
// deep link to the live search. Amadeus Self-Service, the usual free
// choice, shut down on 17 July 2026.
//
// What it is NOT: a live GDS availability search. Prices come from a cache,
// so a fare can be gone by the time someone clicks through. Every offer is
// tagged `priceStatus: "cached"` and carries `foundAt` so the UI can say so
// rather than pretending it's a bookable quote.
//
// Setup: sign up at https://www.travelpayouts.com, copy the API token from
// your profile, and put it in .env as TRAVELPAYOUTS_API_KEY.

import { toBdt, normalizeCode } from "../utils/currency.js";

const BASE_URL = "https://api.travelpayouts.com";
const AIRLINES_URL = `${BASE_URL}/data/en/airlines.json`;
const AVIASALES_WEB = "https://www.aviasales.com";

const AIRLINE_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 15 * 60 * 1000;

let airlineCache = null;
let airlineCachedAt = 0;

// Small memo so re-opening the itinerary page doesn't re-query a fare set
// that only refreshes every few hours anyway.
const searchCache = new Map();

function cacheKey(parts) {
  return Object.values(parts).join("|");
}

/** IATA airline code → display name, from Travelpayouts' public dataset. */
async function airlineNames() {
  if (airlineCache && Date.now() - airlineCachedAt < AIRLINE_TTL_MS) return airlineCache;
  try {
    const res = await fetch(AIRLINES_URL);
    if (!res.ok) throw new Error(`airlines.json returned ${res.status}`);
    const rows = await res.json();
    airlineCache = new Map(
      rows.filter((r) => r.code).map((r) => [r.code, { name: r.name || r.code, lowcost: !!r.is_lowcost }])
    );
    airlineCachedAt = Date.now();
  } catch (error) {
    console.warn("Airline name lookup failed; falling back to codes:", error.message);
    airlineCache = airlineCache || new Map();
    airlineCachedAt = Date.now();
  }
  return airlineCache;
}

function formatDurationMin(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ") || null;
}

async function fetchPrices({ origin, destination, departureAt, currency, token, limit }) {
  const params = new URLSearchParams({
    origin,
    destination,
    currency: currency.toLowerCase(),
    one_way: "true",
    direct: "false",
    sorting: "price",
    limit: String(limit),
    token,
  });
  if (departureAt) params.set("departure_at", departureAt);

  const res = await fetch(`${BASE_URL}/aviasales/v3/prices_for_dates?${params}`);

  if (res.status === 401) {
    throw new Error("TRAVELPAYOUTS_API_KEY was rejected — check the token in your Travelpayouts profile.");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Travelpayouts responded ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = await res.json();
  if (payload.success === false) {
    throw new Error(payload.error || "Travelpayouts returned an unsuccessful response");
  }

  // v3 returns an array; older shapes nest an object map under data. Accept
  // both so a response format change degrades instead of throwing.
  const data = payload.data;
  // The API may quote in a different currency than asked for; the caller
  // converts rather than assuming.
  const quoted = normalizeCode(payload.currency || currency);
  if (Array.isArray(data)) return { rows: data, quoted };
  if (data && typeof data === "object") {
    const rows = Object.values(data).flatMap((entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry) ? Object.values(entry) : entry
    );
    return { rows, quoted };
  }
  return { rows: [], quoted };
}

function normalize(offer, { origin, destination, travelers, currency, airlines, marker, dateShifted, fxRate }) {
  const airlineCode = offer.airline || offer.airline_code || "—";
  const meta = airlines.get(airlineCode);
  const flightNumber = offer.flight_number != null ? `${airlineCode}${offer.flight_number}` : airlineCode;

  const departure = offer.departure_at || offer.depart_date || null;
  const durationMin = offer.duration_to ?? offer.duration ?? null;
  const arrival =
    departure && durationMin ? new Date(new Date(departure).getTime() + durationMin * 60000).toISOString() : null;

  // The API quotes one seat for the whole itinerary; the app shows and
  // budgets the total the party pays. fxRate is 1 unless the API quoted in
  // a currency other than the one asked for.
  const perSeat = (Number(offer.price) || 0) * fxRate;
  const total = Math.round(perSeat * travelers);

  const link = offer.link
    ? `${AVIASALES_WEB}${offer.link}${marker ? `${offer.link.includes("?") ? "&" : "?"}marker=${marker}` : ""}`
    : null;

  return {
    id: `tp:${origin}${destination}:${departure || "any"}:${flightNumber}:${perSeat}`,
    airline: meta?.name || airlineCode,
    airlineCode,
    flightNumber,
    origin: offer.origin_airport || offer.origin || origin,
    destination: offer.destination_airport || offer.destination || destination,
    departure,
    arrival,
    duration: formatDurationMin(durationMin),
    stops: offer.transfers ?? 0,
    price: total,
    pricePerSeat: Math.round(perSeat),
    currency: currency.toUpperCase(),
    // Real, but from Aviasales' 48-hour cache rather than a live quote.
    priceStatus: "cached",
    foundAt: offer.found_at || null,
    cabin: "ECONOMY",
    aircraft: null,
    requiresSelfTransfer: false,
    isLowcost: meta?.lowcost || false,
    bookingUrl: link,
    // True when the exact date had nothing cached and this fare is from a
    // nearby date in the same month.
    dateShifted: Boolean(dateShifted),
    source: "travelpayouts",
  };
}

/**
 * Cheapest real fares for a route and date.
 *
 * Falls back to the surrounding month when the exact day has nothing
 * cached — those results come back flagged `dateShifted` so the caller can
 * label them instead of quietly showing the wrong day.
 */
export async function searchFlights({ origin, destination, date, travelers = 1, currency = "BDT", limit = 20 }) {
  const token = process.env.TRAVELPAYOUTS_API_KEY;
  if (!token) {
    throw new Error("TRAVELPAYOUTS_API_KEY is not set in .env — get a free token at https://www.travelpayouts.com");
  }

  const seats = Math.min(Math.max(Number(travelers) || 1, 1), 9);
  const day = date ? String(date).slice(0, 10) : null;
  const key = cacheKey({ origin, destination, day, seats, currency });

  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.flights;

  const airlines = await airlineNames();
  const marker = process.env.TRAVELPAYOUTS_MARKER || "";
  const shared = { origin, destination, travelers: seats, currency, airlines, marker };

  let { rows, quoted } = await fetchPrices({ origin, destination, departureAt: day, currency, token, limit });
  let dateShifted = false;

  if (!rows.length && day) {
    // Nothing cached for that exact day — widen to the month it sits in.
    ({ rows, quoted } = await fetchPrices({
      origin,
      destination,
      departureAt: day.slice(0, 7),
      currency,
      token,
      limit,
    }));
    dateShifted = rows.length > 0;
  }

  // Everything in the app is BDT. If the API ignored the requested currency
  // (some codes are not supported) convert instead of showing the number as
  // though it were taka.
  const wanted = normalizeCode(currency);
  let fxRate = 1;
  if (quoted !== wanted) {
    if (wanted !== "BDT") {
      throw new Error(`Travelpayouts quoted ${quoted}, which cannot be converted to ${wanted}`);
    }
    const { amount, converted } = await toBdt(1, quoted);
    if (!converted) throw new Error(`No exchange rate for ${quoted}; cannot show these fares in BDT`);
    fxRate = amount;
  }

  const flights = rows
    .filter((offer) => offer && offer.price)
    .map((offer) => normalize(offer, { ...shared, dateShifted, fxRate }))
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);

  searchCache.set(key, { at: Date.now(), flights });
  return flights;
}

export default { searchFlights };
