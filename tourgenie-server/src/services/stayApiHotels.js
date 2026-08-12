// FR-07 — Hotel Recommendation, live data via StayAPI (Booking.com data),
// stayapi.com — free tier: 50 requests total, no card required.
//
// Two-step flow per their docs: resolve a city name to a Booking.com
// dest_id, then search hotels in that destination. Results are upserted
// into our own Hotel collection so they get a normal Mongo _id and the
// rest of the app (selecting a hotel for a trip, etc.) doesn't need to
// know or care whether a hotel came from StayAPI or the seed script.

import Hotel from "../models/Hotel.js";

const BASE_URL = "https://api.stayapi.com/v1";

async function stayApiGet(path, apiKey) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`StayAPI error (${res.status}) for ${path}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function lookupDestinationId(cityName, apiKey) {
  const data = await stayApiGet(
    `/booking/destinations/lookup?query=${encodeURIComponent(cityName)}`,
    apiKey
  );
  if (!data.dest_id) return null;
  return { destId: data.dest_id, destType: data.dest_type || "CITY" };
}

async function searchHotels(destId, destType, apiKey) {
  const data = await stayApiGet(
    `/booking/search?dest_id=${destId}&dest_type=${destType}&adults=2&rooms=1&rows_per_page=20`,
    apiKey
  );
  return data.data || [];
}

function normalizeHotel(raw, city) {
  return {
    name: raw.hotel_name,
    city,
    // NOTE: StayAPI returns whatever currency it's given (default USD),
    // not converted to BDT — fine for a demo, just don't mix it with real
    // BDT figures without a conversion step.
    price_per_night: raw.min_total_price ? Math.round(raw.min_total_price) : 0,
    rating: raw.star_rating || (raw.review_score ? raw.review_score / 2 : 3.5),
    facilities: raw.unit_configuration_label ? [raw.unit_configuration_label] : ["WiFi"],
  };
}

// Fetches live hotels for a city from StayAPI and upserts them into our
// own Hotel collection, returning the saved Mongo documents (so callers
// get normal _id values regardless of data source).
export async function fetchAndCacheStayApiHotels(cityName) {
  const apiKey = process.env.STAYAPI_KEY;
  if (!apiKey) throw new Error("STAYAPI_KEY is not set");

  const destination = await lookupDestinationId(cityName, apiKey);
  if (!destination) return [];

  const rawHotels = await searchHotels(destination.destId, destination.destType, apiKey);
  if (rawHotels.length === 0) return [];

  const normalized = rawHotels.map((h) => normalizeHotel(h, cityName));

  const saved = await Promise.all(
    normalized.map((h) =>
      Hotel.findOneAndUpdate(
        { name: h.name, city: h.city },
        { $set: h },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  return saved;
}
