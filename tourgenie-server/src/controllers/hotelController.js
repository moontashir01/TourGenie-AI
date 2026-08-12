import Hotel from "../models/Hotel.js";
import { fetchAndCacheStayApiHotels } from "../services/stayApiHotels.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-07 — Hotel Recommendation
// If a city is given and StayAPI is configured, tries live data first
// (cached into the Hotel collection on success). Falls back to whatever's
// already seeded for that city if the live lookup returns nothing or
// isn't configured — so this endpoint always returns something useful
// either way. StayAPI's free tier is 50 requests total, so this will stop
// hitting the live API automatically once that runs out (the try/catch
// below just falls through to seeded data on any failure, including a
// quota error).
export const getHotels = asyncHandler(async (req, res) => {
  const { destination_id, city, maxPrice, sort } = req.query;

  if (city && process.env.STAYAPI_KEY) {
    try {
      const live = await fetchAndCacheStayApiHotels(city);
      if (live.length > 0) {
        return res.json({ hotels: sortAndFilter(live, { maxPrice, sort }), source: "stayapi" });
      }
    } catch (err) {
      console.warn(`StayAPI hotel lookup failed for "${city}", falling back to seeded data:`, err.message);
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
  res.json({ hotels, source: "seeded" });
});

function sortAndFilter(hotels, { maxPrice, sort }) {
  let result = hotels;
  if (maxPrice) result = result.filter((h) => h.price_per_night <= Number(maxPrice));
  if (sort === "price") result = [...result].sort((a, b) => a.price_per_night - b.price_per_night);
  else if (sort === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
  return result;
}

export const selectHotelForTrip = asyncHandler(async (req, res) => {
  const Trip = (await import("../models/Trip.js")).default;
  const trip = await Trip.findOneAndUpdate(
    { _id: req.body.trip_id, user_id: req.user._id },
    { hotel_id: req.params.id },
    { new: true }
  );
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  res.json({ trip });
});
