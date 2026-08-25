// FR-07 — Hotel Recommendation, live data via StayAPI (Booking.com data),
// stayapi.com — free tier: 50 requests total, no card required.
//
// Two-step flow per their docs: resolve a city name to a Booking.com
// dest_id, then search hotels in that destination. Results are upserted
// into our own Hotel collection so they get a normal Mongo _id and the
// rest of the app (selecting a hotel for a trip, etc.) doesn't need to
// know or care whether a hotel came from StayAPI or the seed script.
//
// A search is always for a specific stay. Prices move with dates and
// occupancy, so a rate quoted without them isn't a real price for anyone's
// trip — the caller passes the trip's own check-in, check-out and party
// size, and the date-specific quotes are written to HotelRate.

import Hotel from "../models/Hotel.js";
import HotelRate from "../models/HotelRate.js";
import Destination from "../models/Destination.js";
import { toBdt } from "../utils/currency.js";

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

const isoDate = (date) => new Date(date).toISOString().slice(0, 10);

async function searchHotels({ destId, destType, checkIn, checkOut, guests, rooms, apiKey }) {
  // Parameter names matter more than usual here: StayAPI silently ignores
  // ones it doesn't recognise rather than erroring. Sending `checkin_date` /
  // `currency_code` returned a dateless search with `price: null` on every
  // row — the response's own `metadata` block echoes back the names that
  // were actually honoured, which is how these were confirmed.
  const params = new URLSearchParams({
    dest_id: destId,
    dest_type: destType,
    checkin: isoDate(checkIn),
    checkout: isoDate(checkOut),
    adults: String(guests),
    rooms: String(rooms),
    rows_per_page: "20",
    currency: "BDT",
  });
  const data = await stayApiGet(`/booking/search?${params}`, apiKey);
  return data.data?.hotels || [];
}

/**
 * Split a provider price into the per-night figure the app stores.
 *
 * Booking.com's `min_total_price` is the total for the whole searched stay,
 * not a nightly rate. It was being written straight into `price_per_night`,
 * which the budget breakdown then multiplied by the number of nights — so a
 * 5-night stay was costed at five times its own total.
 */
function splitPrice(totalForStay, nights) {
  const total = Number(totalForStay) || 0;
  const safeNights = Math.max(1, nights);
  return { total, perNight: total / safeNights };
}

/** Both coordinate shapes, or neither — a half-written point breaks the index. */
function geoFields(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  return {
    lat_lng: { lat, lng },
    location: { type: "Point", coordinates: [lng, lat] }, // GeoJSON order
  };
}

/** A row is only useful to us if it carries a real, bookable price. */
export function isPriceable(raw) {
  return Boolean(raw && !raw.is_sold_out && Number(raw.price?.amount) > 0);
}

async function normalizeHotel(raw, { city, nights, destinationId }) {
  // StayAPI honours the requested currency when it can and falls back to USD
  // when it can't. Everything the app stores and sums is BDT, so convert
  // before saving instead of mixing a USD rate into a BDT trip budget.
  const sourceCurrency = raw.price?.currency || "USD";
  const { total, perNight } = splitPrice(raw.price?.amount, nights);
  const [totalBdt, perNightBdt] = await Promise.all([toBdt(total, sourceCurrency), toBdt(perNight, sourceCurrency)]);

  // `star_rating` is null for plenty of smaller properties; the guest score
  // (out of 10) is the better fallback for our 0–5 rating.
  const reviewScore = Number(raw.rating?.score) || 0;
  const stars = Number(raw.star_rating) || 0;

  return {
    name: raw.name,
    city,
    // Linking the live hotel to the catalogue city it belongs to. Without
    // this the row is orphaned: every destination-scoped query filters on
    // destination_id and would never return it.
    destination_id: destinationId,
    price_per_night: Math.round(perNightBdt.amount),
    total_price: Math.round(totalBdt.amount),
    currency: "BDT",
    rating: stars || (reviewScore ? reviewScore / 2 : 3.5),
    ...(stars ? { star_rating: stars } : {}),
    ...(reviewScore ? { review_score: reviewScore } : {}),
    review_count: Number(raw.rating?.review_count) || 0,
    address: raw.address || "",
    image_url: raw.image_url || null,
    // Both geo shapes are written explicitly. The model's lat_lng -> location
    // sync is a pre-validate hook, which only fires on save() — an upsert
    // would leave `location` as a Point with no coordinates and Mongo rejects
    // that against the 2dsphere index.
    ...geoFields(raw.latitude, raw.longitude),
    // The quoted room is the most useful thing on the card, and it is what
    // the price actually refers to.
    facilities: [raw.room_name, raw.free_cancellation ? "Free cancellation" : null, raw.no_prepayment ? "No prepayment" : null].filter(Boolean),
    ...(raw.distance ? { distance_to_landmark: { landmark: "city centre", km: milesToKm(raw.distance) } } : {}),
    source: "stayapi",
    external_id: raw.hotel_id != null ? String(raw.hotel_id) : null,
  };
}

/** "1.8 miles" -> 2.9. Returns null for anything that isn't a distance. */
function milesToKm(text) {
  const miles = Number(String(text).match(/[\d.]+/)?.[0]);
  return Number.isFinite(miles) ? Math.round(miles * 1.609 * 10) / 10 : null;
}

/**
 * Fetches live hotels for one specific stay and caches them.
 *
 * Returns the saved Hotel documents with the stay's own nightly rate applied,
 * so callers get normal Mongo _id values regardless of data source.
 */
export async function fetchAndCacheStayApiHotels({ city, checkIn, checkOut, guests = 2, rooms = 1, nights }) {
  const apiKey = process.env.STAYAPI_KEY;
  if (!apiKey) throw new Error("STAYAPI_KEY is not set");

  const destination = await lookupDestinationId(city, apiKey);
  if (!destination) return [];

  const rawHotels = await searchHotels({
    destId: destination.destId,
    destType: destination.destType,
    checkIn,
    checkOut,
    guests,
    rooms,
    apiKey,
  });

  // Sold-out and unpriced rows come back mixed in with the rest. Storing them
  // would put hotels with a price of zero at the top of a price sort.
  const priceable = rawHotels.filter(isPriceable);
  if (priceable.length === 0) return [];

  // The catalogue row this city maps to, resolved once for the whole batch.
  const catalogueCity = await Destination.findOne({
    is_active: true,
    name: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).select("_id");

  const normalized = await Promise.all(
    priceable.map((h) => normalizeHotel(h, { city, nights, destinationId: catalogueCity?._id || null }))
  );

  const saved = await Promise.all(
    normalized.map(async ({ total_price, ...hotel }) => {
      const doc = await Hotel.findOneAndUpdate(
        { name: hotel.name, city: hotel.city },
        { $set: hotel },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await HotelRate.findOneAndUpdate(
        { hotel_id: doc._id, check_in: checkIn, check_out: checkOut, guests, rooms },
        {
          $set: {
            city,
            nights,
            price_per_night: hotel.price_per_night,
            total_price,
            currency: "BDT",
            source: "stayapi",
            fetched_at: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return doc;
    })
  );

  return saved;
}
