import mongoose from "mongoose";
import Destination from "../models/Destination.js";
import Country from "../models/Country.js";
import ClimateNormal from "../models/ClimateNormal.js";
import CostBenchmark from "../models/CostBenchmark.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import Route from "../models/Route.js";
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

// ── Best time to visit ───────────────────────────────────────────────
// The 12 monthly climate normals for one destination, plus a compact
// summary the UI can render without doing the reasoning itself. This is
// described climate, not a forecast — it answers "when should I go", which
// is a different question from "what will the weather be on the 14th".
export const getDestinationClimate = asyncHandler(async (req, res) => {
  const value = req.params.idOrSlug;
  const query = mongoose.isValidObjectId(value) ? { _id: value } : { slug: value.toLowerCase() };
  const destination = await Destination.findOne({ ...query, is_active: true })
    .select("slug name country country_code best_months peak_season")
    .lean();
  if (!destination) return res.status(404).json({ message: "Destination not found" });

  const months = await ClimateNormal.find({ destination_id: destination._id })
    .sort({ month: 1 })
    .lean();

  res.json({ destination, months, summary: climateSummary(months, destination) });
});

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Turns 12 rows into the three things a traveller actually wants: when to
// go, when not to, and why.
function climateSummary(months, destination) {
  if (months.length === 0) return null;

  const good = months.filter((m) => m.is_good_for_travel);
  const wettest = months.reduce((a, b) => (b.rain_mm > a.rain_mm ? b : a));
  const hottest = months.reduce((a, b) => (b.temp_max_c > a.temp_max_c ? b : a));
  const coolest = months.reduce((a, b) => (b.temp_min_c < a.temp_min_c ? b : a));

  return {
    best_months: good.map((m) => m.month),
    best_months_label: formatMonthRanges(good.map((m) => m.month)),
    avoid_months: months.filter((m) => !m.is_good_for_travel).map((m) => m.month),
    peak_season: destination.peak_season || "",
    wettest: { month: wettest.month, label: MONTH_ABBR[wettest.month - 1], rain_mm: wettest.rain_mm },
    hottest: { month: hottest.month, label: MONTH_ABBR[hottest.month - 1], temp_c: hottest.temp_max_c },
    coolest: { month: coolest.month, label: MONTH_ABBR[coolest.month - 1], temp_c: coolest.temp_min_c },
    // The advice for the month the traveller is reading this in.
    current_month_advice: months[new Date().getUTCMonth()]?.travel_advice || "",
  };
}

// [11,12,1,2] -> "Nov – Feb". Wrapping the year is the normal case here, so
// the ranges are computed on the circle rather than the number line.
function formatMonthRanges(monthNumbers) {
  if (monthNumbers.length === 0) return "No consistently good months";
  if (monthNumbers.length === 12) return "Year-round";

  const present = new Set(monthNumbers);
  // Start at a month whose predecessor is absent, so a wrapped run isn't split.
  let start = monthNumbers.find((m) => !present.has(m === 1 ? 12 : m - 1));
  if (start === undefined) start = monthNumbers[0];

  const ranges = [];
  let runStart = null;
  let previous = null;
  for (let step = 0; step < 12; step++) {
    const month = ((start - 1 + step) % 12) + 1;
    if (present.has(month)) {
      if (runStart === null) runStart = month;
      previous = month;
    } else if (runStart !== null) {
      ranges.push([runStart, previous]);
      runStart = null;
    }
  }
  if (runStart !== null) ranges.push([runStart, previous]);

  return ranges
    .map(([a, b]) => (a === b ? MONTH_ABBR[a - 1] : `${MONTH_ABBR[a - 1]} – ${MONTH_ABBR[b - 1]}`))
    .join(", ");
}

// ── Getting there ────────────────────────────────────────────────────
// A direct corridor where one is seeded, otherwise the best two-hop path.
// Sajek is the case that forces this: nobody drives Dhaka to Sajek in one
// leg — you go to Khagrachari and join the convoy — so reporting "no route"
// would be describing a gap in the seed data rather than the journey.
async function findJourney(originName, destinationName) {
  const from = new RegExp(`^${escapeRegex(originName)}$`, "i");
  const to = new RegExp(`^${escapeRegex(destinationName)}$`, "i");

  const direct = await Route.findOne({ "from.name": from, "to.name": to })
    .sort({ is_default: -1, duration_min: 1 })
    .lean();
  if (direct) {
    return {
      from: direct.from.name,
      distance_km: direct.distance_km,
      duration_min: direct.duration_min,
      mode: direct.mode,
      est_fare_bdt: direct.est_fare_bdt,
      carbon_kg: direct.carbon_kg,
      direct: true,
      via: [],
    };
  }

  const [outbound, inbound] = await Promise.all([
    Route.find({ "from.name": from }).lean(),
    Route.find({ "to.name": to }).lean(),
  ]);

  const secondLegByCity = new Map();
  for (const leg of inbound) {
    const key = leg.from.name.toLowerCase();
    const best = secondLegByCity.get(key);
    if (!best || leg.duration_min < best.duration_min) secondLegByCity.set(key, leg);
  }

  let best = null;
  for (const first of outbound) {
    const second = secondLegByCity.get(first.to.name.toLowerCase());
    if (!second) continue;
    const total = first.duration_min + second.duration_min;
    if (!best || total < best.duration_min) {
      best = {
        from: first.from.name,
        distance_km: +(first.distance_km + second.distance_km).toFixed(1),
        duration_min: total,
        // Two modes on one journey: name the longer leg's, since that is
        // what the traveller will remember it as.
        mode: first.duration_min >= second.duration_min ? first.mode : second.mode,
        est_fare_bdt: (first.est_fare_bdt || 0) + (second.est_fare_bdt || 0),
        carbon_kg: +((first.carbon_kg || 0) + (second.carbon_kg || 0)).toFixed(1),
        direct: false,
        via: [first.to.name],
      };
    }
  }
  return best;
}

// ── Side-by-side comparison ──────────────────────────────────────────
// GET /api/destinations/compare?slugs=coxs-bazar,sajek-valley&origin=Dhaka
//
// One request rather than five per destination: the page needs climate,
// cost tiers, the journey from the traveller's origin, and a sense of what
// there is to do, all at once.
export const compareDestinations = asyncHandler(async (req, res) => {
  const slugs = String(req.query.slugs || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4); // four columns is already more than fits on a phone

  if (slugs.length === 0) {
    return res.status(400).json({ message: "slugs is required, e.g. ?slugs=coxs-bazar,sajek-valley" });
  }

  const destinations = await Destination.find({ slug: { $in: slugs }, is_active: true }).lean();
  if (destinations.length === 0) {
    return res.status(404).json({ message: "No matching destinations" });
  }
  // Preserve the order the caller asked for — the columns should not reshuffle.
  destinations.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));

  const ids = destinations.map((d) => d._id);
  const origin = req.query.origin?.trim();

  const [climate, benchmarks, attractionStats, hotelStats, journeys] = await Promise.all([
    ClimateNormal.find({ destination_id: { $in: ids } }).sort({ month: 1 }).lean(),
    CostBenchmark.find({ destination_id: { $in: ids } }).lean(),
    Attraction.aggregate([
      { $match: { destination_id: { $in: ids }, is_active: true } },
      { $sort: { popularity: -1 } },
      {
        $group: {
          _id: "$destination_id",
          count: { $sum: 1 },
          free_count: { $sum: { $cond: ["$is_free", 1, 0] } },
          top: { $push: { name: "$name", category: "$category", entry_fee: "$entry_fee" } },
        },
      },
      { $project: { count: 1, free_count: 1, top: { $slice: ["$top", 3] } } },
    ]),
    Hotel.aggregate([
      { $match: { destination_id: { $in: ids }, is_active: true } },
      {
        $group: {
          _id: "$destination_id",
          count: { $sum: 1 },
          min_price: { $min: "$price_per_night" },
          max_price: { $max: "$price_per_night" },
          avg_rating: { $avg: "$rating" },
        },
      },
    ]),
    origin
      ? Promise.all(destinations.map((d) => findJourney(origin, d.name)))
      : Promise.resolve(destinations.map(() => null)),
  ]);

  const byDestination = (rows) => {
    const map = new Map();
    for (const row of rows) {
      const key = String(row.destination_id || row._id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return map;
  };

  const climateMap = byDestination(climate);
  const benchmarkMap = byDestination(benchmarks);
  const attractionMap = new Map(attractionStats.map((r) => [String(r._id), r]));
  const hotelMap = new Map(hotelStats.map((r) => [String(r._id), r]));

  const columns = destinations.map((destination, index) => {
    const key = String(destination._id);
    const months = climateMap.get(key) || [];
    const tiers = {};
    for (const b of benchmarkMap.get(key) || []) {
      tiers[b.tier] = {
        per_day: Object.values(b.per_person_per_day).reduce((a, n) => a + n, 0),
        breakdown: b.per_person_per_day,
        hotel_range: b.hotel_price_range,
        notes: b.notes,
      };
    }

    return {
      destination,
      months,
      climate_summary: climateSummary(months, destination),
      cost: tiers,
      attractions: attractionMap.get(key) || { count: 0, free_count: 0, top: [] },
      hotels: hotelMap.get(key) || { count: 0, min_price: null, max_price: null, avg_rating: null },
      journey: journeys[index] || null,
    };
  });

  res.json({ origin: origin || null, columns });
});
