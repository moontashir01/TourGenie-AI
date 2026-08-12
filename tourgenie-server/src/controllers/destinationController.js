import mongoose from "mongoose";
import Destination from "../models/Destination.js";
import Country from "../models/Country.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Public catalogue used by trip planning. Country/type filters are exact;
// search matches the canonical name, aliases, summary, and tags.
export const listDestinations = asyncHandler(async (req, res) => {
  const filter = { is_active: true };
  if (req.query.country_code) filter.country_code = String(req.query.country_code).toUpperCase();
  if (req.query.type) filter.type = req.query.type;
  if (req.query.q?.trim()) {
    const pattern = new RegExp(escapeRegex(req.query.q.trim()), "i");
    filter.$or = [
      { name: pattern },
      { aliases: pattern },
      { summary: pattern },
      { tags: pattern },
    ];
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const destinations = await Destination.find(filter)
    .select("slug name aliases country country_code division type summary lat_lng timezone currency pricing_currency languages tags best_months avg_daily_cost recommended_days popularity nearest_airport")
    .sort({ country: 1, popularity: -1, name: 1 })
    .limit(limit)
    .lean();

  const [countryRows, destinationCounts] = await Promise.all([
    Country.find({ is_active: true }).sort({ is_core: -1, name: 1 }).lean(),
    Destination.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: "$country_code", destinations: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(destinationCounts.map((row) => [row._id, row.destinations]));
  const countries = countryRows.map((country) => ({
    ...country,
    country_code: country.code,
    destinations: counts.get(country.code) || 0,
  }));

  res.json({ destinations, countries });
});

export const getDestination = asyncHandler(async (req, res) => {
  const value = req.params.idOrSlug;
  const query = mongoose.isValidObjectId(value) ? { _id: value } : { slug: value.toLowerCase() };
  const destination = await Destination.findOne({ ...query, is_active: true }).lean();
  if (!destination) return res.status(404).json({ message: "Destination not found" });
  res.json({ destination });
});
