// FR-13 — Nearby Services, answered straight from the 2dsphere index.
//
// Point mode (lat/lng) runs a $geoNear with the distance precomputed —
// the same "restaurants within 2 km, sorted by distance" answer the
// Overpass API would give, without the network dependency. City mode is
// the browse fallback when no coordinates are at hand.
import NearbyService, { SERVICE_CATEGORIES } from "../models/NearbyService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PROJECTION = {
  name: 1,
  category: 1,
  subcategory: 1,
  city: 1,
  area: 1,
  address: 1,
  phone: 1,
  opening_hours: 1,
  is_24h: 1,
  rating: 1,
  lat_lng: 1,
};

// GET /api/nearby?lat=21.42&lng=92.00&category=restaurant&radius_km=5
// GET /api/nearby?city=Cox's Bazar&category=atm
export const getNearbyServices = asyncHandler(async (req, res) => {
  const { lat, lng, city, category, radius_km, limit } = req.query;
  const max = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const filter = { is_active: true };
  if (category) {
    if (!SERVICE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Unknown category "${category}". One of: ${SERVICE_CATEGORIES.join(", ")}` });
    }
    filter.category = category;
  }

  if (lat !== undefined && lng !== undefined && lat !== "" && lng !== "") {
    const point = [Number(lng), Number(lat)];
    if (!point.every(Number.isFinite)) {
      return res.status(400).json({ message: "lat and lng must be numbers" });
    }
    const services = await NearbyService.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: point },
          distanceField: "distance_m",
          maxDistance: (Number(radius_km) || 5) * 1000,
          spherical: true,
          query: filter,
        },
      },
      { $limit: max },
      { $project: { ...PROJECTION, distance_m: { $round: ["$distance_m", 0] } } },
    ]);
    return res.json({ services, categories: SERVICE_CATEGORIES });
  }

  if (city?.trim()) {
    const services = await NearbyService.find({
      ...filter,
      city: new RegExp(`^${escapeRegex(city.trim())}$`, "i"),
    })
      .select(PROJECTION)
      .sort({ rating: -1 })
      .limit(max)
      .lean();
    return res.json({ services, categories: SERVICE_CATEGORIES });
  }

  res.status(400).json({ message: "Provide lat & lng, or a city" });
});
