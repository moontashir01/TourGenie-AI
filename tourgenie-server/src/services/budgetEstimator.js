// FR-09 — the one place trip cost is estimated.
//
// Both the Plan-a-trip preview (POST /api/trips/estimate) and trip creation
// go through here, so the number shown in the form and the breakdown stored
// on the trip can never disagree. Everything returned is BDT.
import CostBenchmark, { BUDGET_TIERS } from "../models/CostBenchmark.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import { buildCostBenchmarks } from "../seed/data/reference.js";

// Mirrors src/seed/data/reference.js — kept here so a destination with no
// CostBenchmark row can still be priced.
export const TIER_MULTIPLIER = { budget: 0.55, mid: 1.0, luxury: 2.15 };

// The form asks for a hotel preference in plain words; the cost model and
// the Hotel collection both key off budget_tier. Without this map the tier
// stayed "mid" no matter what the traveler picked.
const HOTEL_PREFERENCE_TIER = {
  budget: "budget",
  balanced: "mid",
  comfort: "mid",
  "mid-range": "mid",
  luxury: "luxury",
  "no preference": "mid",
};

export function resolveBudgetTier({ budget_tier, hotel_preference } = {}) {
  const explicit = String(budget_tier || "").toLowerCase().trim();
  if (BUDGET_TIERS.includes(explicit)) return explicit;
  const preference = String(hotel_preference || "").toLowerCase().trim();
  return HOTEL_PREFERENCE_TIER[preference] || "mid";
}

/** Nights slept, which is one fewer than days counted inclusively. */
export function nightsFromDays(days) {
  return Math.max(1, Number(days) - 1);
}

async function benchmarkFor(destination, tier) {
  if (!destination) return null;
  if (destination._id) {
    const row = await CostBenchmark.findOne({ destination_id: destination._id, tier }).lean();
    if (row) return row;
  }
  // No seeded benchmark (a destination added after the last seed run) —
  // derive one from the catalogue's avg_daily_cost with the same model.
  return buildCostBenchmarks(destination).find((b) => b.tier === tier) || null;
}

/** Mean per-person-per-day cost across every city on the trip. */
function averagePerDay(benchmarks) {
  const keys = ["accommodation", "food", "local_transport", "attractions", "shopping", "misc"];
  const rows = benchmarks.filter(Boolean).map((b) => b.per_person_per_day || {});
  if (!rows.length) return null;
  return Object.fromEntries(
    keys.map((key) => [key, Math.round(rows.reduce((sum, r) => sum + (r[key] || 0), 0) / rows.length)])
  );
}

/**
 * FR-09 — categorised budget from the cost benchmark, itinerary and hotel.
 * Returns { lines, estimated_total }. All amounts BDT.
 */
export function buildBudgetBreakdown({ benchmark, categories, days, travelers, hotelPricePerNight, transportFare }) {
  const byCode = new Map(categories.map((c) => [c.code, c]));
  const perDay = benchmark?.per_person_per_day || benchmark || {};
  const nights = nightsFromDays(days);

  const accommodation = hotelPricePerNight != null
    ? hotelPricePerNight * nights
    : (perDay.accommodation || 0) * nights * travelers;

  const amounts = {
    transport: (transportFare != null ? transportFare * travelers * 2 : 0) + (perDay.local_transport || 0) * days * travelers,
    hotel: Math.round(accommodation),
    food: (perDay.food || 0) * days * travelers,
    attractions: (perDay.attractions || 0) * days * travelers,
    shopping: (perDay.shopping || 0) * days * travelers,
    emergency: (perDay.misc || 0) * days * travelers,
  };

  const lines = Object.entries(amounts)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => {
      const meta = byCode.get(category);
      return {
        category,
        label: meta?.label || category,
        amount: Math.round(amount),
        color: meta?.color || "#8A7B6B",
      };
    })
    .sort((a, b) => (byCode.get(a.category)?.sort_order || 99) - (byCode.get(b.category)?.sort_order || 99));

  return {
    lines,
    estimated_total: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

/**
 * What this trip realistically costs, and the floor below which it can't be
 * planned at all.
 *
 * `minimum_total` is deliberately bed-food-and-local-transport at the
 * *budget* tier regardless of the tier asked for: it is the "you cannot do
 * this trip for that money" line, not a recommendation.
 */
export async function estimateTripBudget({
  destinations = [],
  days,
  travelers,
  tier = "mid",
  hotelPricePerNight = null,
  transportFare = null,
}) {
  const categories = await ExpenseCategory.find({ is_active: true }).sort({ sort_order: 1 }).lean();
  const safeDays = Math.max(1, Number(days) || 1);
  const safeTravelers = Math.max(1, Number(travelers) || 1);
  const nights = nightsFromDays(safeDays);

  const [tierBenchmarks, floorBenchmarks] = await Promise.all([
    Promise.all(destinations.map((d) => benchmarkFor(d, tier))),
    Promise.all(destinations.map((d) => benchmarkFor(d, "budget"))),
  ]);

  const perDay = averagePerDay(tierBenchmarks);
  const floorPerDay = averagePerDay(floorBenchmarks);

  if (!perDay) {
    return {
      tier,
      currency: "BDT",
      days: safeDays,
      nights,
      travelers: safeTravelers,
      per_person_per_day: null,
      lines: [],
      estimated_total: 0,
      minimum_total: 0,
      has_benchmark: false,
    };
  }

  const { lines, estimated_total } = buildBudgetBreakdown({
    benchmark: { per_person_per_day: perDay },
    categories,
    days: safeDays,
    travelers: safeTravelers,
    hotelPricePerNight,
    transportFare,
  });

  const floor = floorPerDay || perDay;
  const minimum_total = Math.round(
    (floor.accommodation || 0) * nights * safeTravelers +
      ((floor.food || 0) + (floor.local_transport || 0)) * safeDays * safeTravelers
  );

  return {
    tier,
    currency: "BDT",
    days: safeDays,
    nights,
    travelers: safeTravelers,
    per_person_per_day: perDay,
    lines,
    estimated_total,
    minimum_total,
    has_benchmark: true,
  };
}

/** How a given budget sits against the estimate — drives the form's hint. */
export function verdictFor(budgetBdt, { estimated_total, minimum_total, has_benchmark }) {
  if (!has_benchmark || !estimated_total) return "unknown";
  if (budgetBdt < minimum_total) return "below_minimum";
  if (budgetBdt < estimated_total * 0.9) return "tight";
  if (budgetBdt > estimated_total * 1.5) return "generous";
  return "comfortable";
}

export default { estimateTripBudget, buildBudgetBreakdown, resolveBudgetTier, verdictFor, nightsFromDays };
