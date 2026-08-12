// Flight fare lookup via Ignav API — https://ignav.com
// Direct replacement for Amadeus Self-Service (shut down July 17 2026).
//
// Free tier: 1,000 requests, no credit card required.
// Sign up at: https://ignav.com → "Get your free API key"
// Add IGNAV_API_KEY to your .env file.
//
// API docs: https://ignav.com/docs
// Pricing:  https://ignav.com/pricing ($2 / 1,000 after free tier; failed requests not billed)

const IGNAV_BASE = "https://ignav.com/api/fares";

// ---- IATA code map for cities relevant to Bangladeshi travelers ----
const CITY_TO_IATA = {
  // Bangladesh
  "dhaka": "DAC",
  "chittagong": "CGP",
  "chattogram": "CGP",
  "sylhet": "ZYL",
  "cox's bazar": "CXB",
  "coxs bazar": "CXB",
  "cox bazar": "CXB",
  "jessore": "JSR",
  "jashore": "JSR",
  "barisal": "BZL",

  // Middle East
  "dubai": "DXB",
  "abu dhabi": "AUH",
  "doha": "DOH",
  "riyadh": "RUH",
  "jeddah": "JED",
  "muscat": "MCT",
  "kuwait": "KWI",
  "kuwait city": "KWI",
  "bahrain": "BAH",

  // South Asia
  "delhi": "DEL",
  "new delhi": "DEL",
  "mumbai": "BOM",
  "kolkata": "CCU",
  "calcutta": "CCU",
  "kathmandu": "KTM",
  "colombo": "CMB",
  "karachi": "KHI",
  "lahore": "LHE",
  "islamabad": "ISB",

  // Southeast Asia
  "bangkok": "BKK",
  "singapore": "SIN",
  "kuala lumpur": "KUL",
  "kl": "KUL",
  "jakarta": "CGK",
  "bali": "DPS",
  "denpasar": "DPS",
  "ho chi minh city": "SGN",
  "saigon": "SGN",
  "hanoi": "HAN",
  "manila": "MNL",

  // East Asia
  "tokyo": "NRT",
  "osaka": "KIX",
  "beijing": "PEK",
  "shanghai": "PVG",
  "hong kong": "HKG",
  "seoul": "ICN",
  "taipei": "TPE",

  // Europe
  "london": "LHR",
  "paris": "CDG",
  "amsterdam": "AMS",
  "frankfurt": "FRA",
  "istanbul": "IST",
  "rome": "FCO",
  "barcelona": "BCN",
  "madrid": "MAD",

  // North America
  "new york": "JFK",
  "los angeles": "LAX",
  "toronto": "YYZ",
  "vancouver": "YVR",
  "chicago": "ORD",

  // Australia
  "sydney": "SYD",
  "melbourne": "MEL",
};

// Convert a city name or raw IATA string → uppercase IATA code
export function resolveIata(cityName) {
  if (!cityName) return null;
  const trimmed = cityName.trim();
  if (/^[A-Z]{3}$/.test(trimmed)) return trimmed;
  return CITY_TO_IATA[trimmed.toLowerCase()] || null;
}

// Main search — returns array of flight offers shaped for the frontend.
export async function searchFlights({ origin, destination, date, travelers = 1 }) {
  const apiKey = process.env.IGNAV_API_KEY;
  if (!apiKey) {
    throw new Error("IGNAV_API_KEY is not set in .env — sign up free at https://ignav.com");
  }

  const originCode = resolveIata(origin);
  const destCode = resolveIata(destination);

  if (!originCode) throw new Error(`No airport found for "${origin}". Try a major city name or 3-letter IATA code (e.g. DAC for Dhaka).`);
  if (!destCode) throw new Error(`No airport found for "${destination}". Try a major city name or 3-letter IATA code (e.g. DXB for Dubai).`);

  const depDate = date ? date.slice(0, 10) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const body = {
    origin: originCode,
    destination: destCode,
    departure_date: depDate,
    adults: Math.min(Number(travelers) || 1, 9),
    // Return max 10 results
  };

  const res = await fetch(`${IGNAV_BASE}/one-way`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `Flight search failed (${res.status})`;
    try {
      const body = await res.text();
      const parsed = JSON.parse(body);
      // Ignav may return { error: "..." } or { message: "..." } or { detail: "..." }
      const detail = parsed?.error || parsed?.message || parsed?.detail;
      if (typeof detail === "string") msg = detail;
      else if (detail) msg = JSON.stringify(detail);
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const itineraries = (data.itineraries || []).slice(0, 10);

  // Shape Ignav response → frontend-friendly objects
  return itineraries.map((it) => {
    const seg = it.outbound?.segments?.[0] || {};
    const lastSeg = it.outbound?.segments?.slice(-1)[0] || seg;
    const stops = (it.outbound?.segments?.length || 1) - 1;
    const durationMin = it.outbound?.duration_minutes;

    return {
      id: it.ignav_id,
      airline: seg.operating_carrier_name || seg.marketing_carrier_code || "—",
      airlineCode: seg.marketing_carrier_code || "—",
      flightNumber: `${seg.marketing_carrier_code || ""}${seg.flight_number || ""}`,
      origin: seg.departure_airport || originCode,
      destination: lastSeg.arrival_airport || destCode,
      departure: seg.departure_time_local,
      arrival: lastSeg.arrival_time_local,
      duration: durationMin ? formatDurationMin(durationMin) : null,
      stops,
      price: it.price?.amount,
      currency: it.price?.currency || "USD",
      priceStatus: it.price?.status,    // "verified" | "estimated"
      cabin: it.cabin_class || "economy",
      aircraft: seg.aircraft || null,
      requiresSelfTransfer: it.requires_self_transfer || false,
      ignavId: it.ignav_id,
    };
  });
}

// Convert minutes → "7h 30m"
function formatDurationMin(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ");
}

// Keep this export so flightController.js needs no changes
export { formatDurationMin as formatDuration };
