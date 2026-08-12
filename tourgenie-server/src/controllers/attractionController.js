import Attraction from "../models/Attraction.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-12 — Tourist Attractions (public, curated database)
export const getAttractions = asyncHandler(async (req, res) => {
  const { destination_id, city, category } = req.query;
  const filter = { is_active: true };
  if (destination_id) filter.destination_id = destination_id;
  if (city) filter.city = new RegExp(`^${city}$`, "i");
  if (category) filter.category = new RegExp(`^${category}$`, "i");

  const attractions = await Attraction.find(filter).populate("destination_id", "slug name country country_code currency pricing_currency").sort({ popularity: -1, name: 1 });
  res.json({ attractions });
});

export const getAttractionById = asyncHandler(async (req, res) => {
  const attraction = await Attraction.findById(req.params.id);
  if (!attraction) return res.status(404).json({ message: "Attraction not found" });
  res.json({ attraction });
});
