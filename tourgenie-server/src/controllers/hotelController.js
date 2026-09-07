import Hotel from "../models/Hotel.js";
import HotelRate from "../models/HotelRate.js";
import { fetchAndCacheStayApiHotels } from "../services/stayApiHotels.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findTripForUser, EDIT } from "../services/tripAccess.js";

// How long a quoted rate is treated as current. Hotel pricing moves, but not
// minute to minute, and a free-tier quota is far more precious than a
// six-hour-old price.
const RATE_TTL_MS = 6 * 60 * 60 * 1000;

// Nobody is booking a 40-person block through this form, and an absurd
// occupancy is a good way to waste a request on a provider error.
const MAX_GUESTS = 30;
const MAX_ROOMS = 10;

/** Midnight UTC, so the same calendar day is always the same cache key. */
function dayOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * The stay a hotel search is for. Live pricing is only attempted when the
 * caller gives real dates — a rate quoted for no particular night is not a
 * price anyone can act on, and it is the thing that made a stay total look
 * like a nightly rate.
 */
function parseStay({ check_in, check_out, guests, rooms }) {
  const checkIn = dayOnly(check_in);
  const checkOut = dayOnly(check_out);
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;

  const nights = Math.round((checkOut - checkIn) / 86400000);
  const partySize = Math.max(1, Math.min(MAX_GUESTS, Number(guests) || 2));
  return {
    checkIn,
    checkOut,
    nights,
    guests: partySize,
    // One room per two travelers unless the caller says otherwise.
    rooms: Math.max(1, Math.min(MAX_ROOMS, Number(rooms) || Math.ceil(partySize / 2))),
  };
}

/**
 * Cached rates for this exact stay, newest first.
 *
 * A hit here is what keeps StayAPI's 50-request lifetime allowance from
 * disappearing in a couple of dozen page loads: the old code called the
 * provider on every request that carried a city and never once read what it
 * had already stored.
 */
async function cachedRates(city, stay) {
  return HotelRate.find({
    city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    guests: stay.guests,
    rooms: stay.rooms,
    fetched_at: { $gte: new Date(Date.now() - RATE_TTL_MS) },
  })
    .populate("hotel_id")
    .sort({ fetched_at: -1 });
}

/** Record that a search ran and found nothing, so it isn't retried per load. */
async function markEmptySearch(city, stay) {
  await HotelRate.findOneAndUpdate(
    { hotel_id: null, city, check_in: stay.checkIn, check_out: stay.checkOut, guests: stay.guests, rooms: stay.rooms },
    { $set: { nights: stay.nights, source: "stayapi", fetched_at: new Date() } },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

// FR-07 — Hotel Recommendation
//
// Live data is used when the request names a city, gives real stay dates and
// StayAPI is configured — and only when nothing fresh is already cached for
// that exact stay. Anything else (no key, no dates, a provider failure or an
// exhausted quota) falls back to the seeded catalogue, so this endpoint
// always returns something useful.
export const getHotels = asyncHandler(async (req, res) => {
  const { destination_id, city, maxPrice, sort } = req.query;
  const stay = parseStay(req.query);

  if (city && stay) {
    const cached = await cachedRates(city, stay);
    if (cached.length > 0) {
      // A lone marker row means the last search genuinely found nothing.
      const hotels = cached
        .filter((rate) => rate.hotel_id)
        .map((rate) => withRate(rate.hotel_id, rate));
      if (hotels.length > 0) {
        return res.json({ hotels: sortAndFilter(hotels, { maxPrice, sort }), source: "stayapi-cached", stay: describe(stay) });
      }
    } else if (process.env.STAYAPI_KEY) {
      try {
        const live = await fetchAndCacheStayApiHotels({ city, ...stay });
        if (live.length > 0) {
          const rates = await cachedRates(city, stay);
          const byHotel = new Map(rates.filter((r) => r.hotel_id).map((r) => [String(r.hotel_id._id), r]));
          const hotels = live.map((h) => withRate(h, byHotel.get(String(h._id))));
          return res.json({ hotels: sortAndFilter(hotels, { maxPrice, sort }), source: "stayapi", stay: describe(stay) });
        }
        await markEmptySearch(city, stay);
      } catch (err) {
        console.warn(`StayAPI hotel lookup failed for "${city}", falling back to seeded data:`, err.message);
      }
    }
  }

  const filter = { is_active: true };
  if (destination_id) filter.destination_id = destination_id;
  if (city) filter.city = new RegExp(`^${city}$`, "i");
  if (maxPrice) filter.price_per_night = { $lte: Number(maxPrice) };

  let query = Hotel.find(filter).populate("destination_id", "slug name country country_code currency pricing_currency");
  if (sort === "price") query = query.sort({ price_per_night: 1 });
  else if (sort === "rating") query = query.sort({ rating: -1 });

  const hotels = await query;
  res.json({ hotels, source: "seeded", ...(stay ? { stay: describe(stay) } : {}) });
});

function describe(stay) {
  return {
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    nights: stay.nights,
    guests: stay.guests,
    rooms: stay.rooms,
  };
}

/**
 * The hotel as priced for *this* stay. The document's own price_per_night is
 * a representative figure for browsing; the quote for the requested dates
 * wins wherever one exists.
 */
function withRate(hotel, rate) {
  const plain = typeof hotel.toObject === "function" ? hotel.toObject() : { ...hotel };
  if (!rate) return plain;
  return {
    ...plain,
    price_per_night: rate.price_per_night ?? plain.price_per_night,
    total_price: rate.total_price ?? null,
    nights: rate.nights ?? null,
    rate_fetched_at: rate.fetched_at ?? null,
  };
}

function sortAndFilter(hotels, { maxPrice, sort }) {
  let result = hotels;
  if (maxPrice) result = result.filter((h) => h.price_per_night <= Number(maxPrice));
  if (sort === "price") result = [...result].sort((a, b) => a.price_per_night - b.price_per_night);
  else if (sort === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
  return result;
}

// Single-city trips store one hotel_id for the whole stay. Multi-city trips
// need one hotel per city visited, so a select there is scoped by req.body.city
// and replaces any prior pick for that same city rather than the whole trip.
export const selectHotelForTrip = asyncHandler(async (req, res) => {
  const Trip = (await import("../models/Trip.js")).default;
  const trip = await findTripForUser(req.body.trip_id, req.user._id, { level: EDIT });
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  if (trip.multi_city) {
    const city = req.body.city;
    if (!city) return res.status(400).json({ message: "city is required to select a hotel on a multi-city trip" });
    trip.hotel_selections = [
      ...trip.hotel_selections.filter((s) => s.city.toLowerCase() !== city.toLowerCase()),
      { city, hotel_id: req.params.id },
    ];
  } else {
    trip.hotel_id = req.params.id;
  }
  await trip.save();

  const updated = await Trip.findById(trip._id).populate("hotel_id").populate("hotel_selections.hotel_id");
  res.json({ trip: updated });
});
