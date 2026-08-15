// FR-06 — Route Optimization. Serves the precomputed Route rows (real
// corridor geometry + turn-by-turn legs) so the Itinerary map can draw an
// actual road/rail/bus shape between two cities instead of a straight line,
// wherever a matching row was seeded.
import Route from "../models/Route.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/routes?from=Dhaka&to=Cox's Bazar&mode=driving
// Direction-sensitive (from->to), since a seeded pair may only exist as
// ...->to->from (Thailand pack seeds both directions; Bangladesh legacy data
// mostly doesn't), so the caller falls back to swapping from/to itself.
export const getRoute = asyncHandler(async (req, res) => {
  const { from, to, mode } = req.query;
  if (!from?.trim() || !to?.trim()) {
    return res.status(400).json({ message: "from and to are required" });
  }

  const filter = {
    "from.name": new RegExp(`^${escapeRegex(from.trim())}$`, "i"),
    "to.name": new RegExp(`^${escapeRegex(to.trim())}$`, "i"),
  };
  if (mode) filter.mode = mode;

  const route = await Route.findOne(filter).sort({ is_default: -1, distance_km: 1 });
  res.json({ route: route || null });
});
