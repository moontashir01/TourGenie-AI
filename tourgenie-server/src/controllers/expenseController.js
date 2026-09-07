import Expense from "../models/Expense.js";
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { currencyMeta, toBdt } from "../utils/currency.js";
import { nightsFromDays } from "../services/budgetEstimator.js";

async function assertOwnsTrip(tripId, userId) {
  return Trip.findOne({ _id: tripId, user_id: userId })
    .populate("hotel_id")
    .populate("hotel_selections.hotel_id");
}

function mapCategory(cat) {
  if (!cat) return "Miscellaneous";
  const c = cat.toLowerCase();
  if (c === "travel" || c === "transport") return "Transport";
  if (c === "meal" || c === "food") return "Food";
  if (["attraction", "activity", "leisure", "nightlife"].includes(c)) return "Attractions";
  // The synthesised stay rows are the hotel bill, not a category of their
  // own — "Checkout" sitting beside "Hotel" in the chart named the same money
  // twice over.
  if (c === "hotel" || c === "accommodation" || c === "checkin" || c === "checkout") return "Hotel";
  if (c === "shopping") return "Shopping";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

const AIR_LEG = /\b(flight|flights|fly|flying|airport|airline|airways|plane)\b/i;

/**
 * The journey in and out — day one out of the origin, the last day back to
 * it — whatever it travels by.
 *
 * `budget_includes_flights` is named for flights but governs getting there
 * and back generally, so this predicate has to recognise a bus or a launch
 * as readily as a plane. Without it the toggle only ever reached
 * trip.selected_flight, and a domestic road fare kept eating the budget
 * however the traveller set it.
 */
function isGatewayLeg(item, trip, lastDay) {
  if (item.category !== "travel") return false;
  if (item.day !== 1 && item.day !== lastDay) return false;
  const touchesOrigin =
    (item.from_city && item.from_city === trip.origin) || (item.to_city && item.to_city === trip.origin);
  return touchesOrigin || AIR_LEG.test(`${item.activity || ""} ${item.location || ""}`);
}

// A booked flight arrives twice: once as trip.selected_flight, and again as
// the AI itinerary's own "travel" item for the same journey (the country
// prompt explicitly asks for an arrival leg on day 1 and a departure leg on
// the last day). Counting both doubled the fare, so the itinerary copy is
// dropped once a fare is actually booked.
function isBookedFlightLeg(item, trip, lastDay) {
  return Boolean(trip.selected_flight) && isGatewayLeg(item, trip, lastDay);
}

/**
 * Nights slept per city, from the itinerary. The last day is the day the
 * traveler leaves, so it is not a night anywhere — counting it charged one
 * extra night per city.
 */
function nightsPerCity(items) {
  const cityByDay = {};
  for (const item of items) {
    if (item.city) cityByDay[item.day] = item.city; // items arrive sorted, later wins
  }
  const days = Object.keys(cityByDay).map(Number).sort((a, b) => a - b);
  const nights = {};
  for (const day of days.slice(0, -1)) {
    const city = cityByDay[day];
    nights[city] = (nights[city] || 0) + 1;
  }
  return nights;
}

export async function getVirtualExpenses(trip) {
  const virtuals = [];
  const items = await ItineraryItem.find({ trip_id: trip._id }).sort({ day: 1, time: 1 });
  const lastDay = items.reduce((max, item) => Math.max(max, item.day), 0);

  // itineraryController now writes a priced check-out row per city stayed in.
  // Where one exists it is the stay's cost, so imputing the same nights again
  // from trip.hotel_id would charge the hotel twice.
  const pricedStayCities = new Set(
    items
      .filter((item) => item.category === "checkout" && item.est_cost > 0)
      .map((item) => String(item.city || "").toLowerCase())
  );

  if (trip.multi_city && trip.hotel_selections?.length) {
    const nightsByCity = nightsPerCity(items);
    // No itinerary yet (or no city data on it) — split the trip's nights
    // evenly across the chosen hotels rather than inventing one night each.
    const hasCityData = Object.keys(nightsByCity).length > 0;
    const fallbackNights = Math.max(
      0,
      Math.round(nightsFromDays(trip.duration_days || 1) / trip.hotel_selections.length)
    );

    for (const sel of trip.hotel_selections) {
      const hotel = sel.hotel_id;
      if (!hotel) continue;
      if (pricedStayCities.has(String(sel.city).toLowerCase())) continue;
      const nights = hasCityData ? nightsByCity[sel.city] || 0 : fallbackNights;
      const cost = (hotel.price_per_night || 0) * nights;
      if (cost > 0) {
        virtuals.push({
          _id: `virt_hotel_${hotel._id}_${sel.city}`,
          trip_id: trip._id,
          category: "Hotel",
          description: `${hotel.name} (${sel.city}, ${nights} night${nights > 1 ? "s" : ""})`,
          amount: cost,
          date: trip.start_date,
          is_estimated: true,
        });
      }
    }
  } else if (trip.hotel_id && !pricedStayCities.size) {
    // Nights, not days — a 4-day trip is 3 hotel nights.
    const nights = nightsFromDays(trip.duration_days || 1);
    const cost = (trip.hotel_id.price_per_night || 0) * nights;
    if (cost > 0) {
      virtuals.push({
        _id: `virt_hotel_${trip.hotel_id._id}`,
        trip_id: trip._id,
        category: "Hotel",
        description: `${trip.hotel_id.name} (${nights} night${nights > 1 ? "s" : ""})`,
        amount: cost,
        date: trip.start_date,
        is_estimated: true,
      });
    }
  }

  if (trip.selected_flight) {
    const f = trip.selected_flight;
    // Fares are stored in BDT now, but a trip booked before that fix still
    // carries the provider's own currency — convert on read so old trips
    // stop reporting a fare 122x too small.
    const fare = await toBdt(f.price || 0, f.currency || "BDT");
    virtuals.push({
      _id: `virt_flight_${f.id}`,
      trip_id: trip._id,
      category: "Transport",
      // A round-trip fare covers both directions in this single line —
      // isBookedFlightLeg() below drops the itinerary's own arrival and
      // departure legs so the airfare is never charged twice.
      description: `${f.airline || "Flight"} ${f.flightNumber || ""}${f.tripType === "round_trip" ? " (round trip)" : ""}`.trim(),
      amount: Math.round(fare.amount),
      date: trip.start_date,
      is_estimated: true,
      is_flight: true,
      // The traveler can say their budget doesn't cover airfare; the fare is
      // still shown, it just doesn't eat the budget.
      counts_toward_budget: trip.budget_includes_flights !== false,
    });
  }

  for (const item of items) {
    if (!item.est_cost || item.est_cost <= 0) continue;
    if (isBookedFlightLeg(item, trip, lastDay)) continue;

    // If transport option selected, use its details for description
    let desc = item.activity;
    if (item.selected_transport_option) {
      const opt = item.selected_transport_option;
      desc = `${opt.airline || opt.operator || "Transport"} - ${opt.flight_number || opt.mode || "Ticket"}`;
    }

    virtuals.push({
      _id: `virt_item_${item._id}`,
      trip_id: trip._id,
      category: mapCategory(item.category),
      description: desc,
      amount: item.est_cost,
      date: new Date(new Date(trip.start_date).getTime() + (item.day - 1) * 86400000),
      is_estimated: true,
      // Getting there and back obeys the same toggle a booked fare does —
      // still shown, just not counted when the traveller says their budget
      // doesn't cover the journey.
      ...(isGatewayLeg(item, trip, lastDay)
        ? { is_gateway: true, counts_toward_budget: trip.budget_includes_flights !== false }
        : {}),
    });
  }

  return virtuals;
}

// A hand-logged expense may have been entered in a foreign currency; the
// budget is BDT, so everything is normalised before it is summed.
async function amountInBdt(expense) {
  if (expense.amount_bdt != null) return expense.amount_bdt;
  const { amount } = await toBdt(expense.amount, expense.currency || "BDT");
  return Math.round(amount);
}

// FR-09 — Budget Management: categorized breakdown from itinerary + hotel + bookings
//
// Exported rather than inlined into the handler because the confirmation PDF
// (FR-03) has to print exactly what the Budget page shows. A second place
// summing expenses is how the print view came to disagree with the app.
// `trip` must arrive with hotel_id and hotel_selections.hotel_id populated.
export async function buildBudgetSummary(trip) {
  const [expenses, virtuals, money] = await Promise.all([
    Expense.find({ trip_id: trip._id }),
    getVirtualExpenses(trip),
    currencyMeta(trip.currency || "BDT"),
  ]);

  const logged = await Promise.all(
    expenses.map(async (e) => ({ ...e.toObject(), amount: await amountInBdt(e) }))
  );

  const byCategory = {};
  let total = 0;
  let loggedTotal = 0;
  let estimatedTotal = 0;
  // The journey in and out when the budget isn't meant to cover it — a booked
  // fare or a road leg, whichever this trip has. Reported as
  // `flights_excluded` because that is the name the client already reads.
  let travelExcluded = 0;

  for (const e of [...logged, ...virtuals]) {
    if (e.counts_toward_budget === false) {
      travelExcluded += e.amount;
      continue;
    }
    const cat = mapCategory(e.category);
    byCategory[cat] = (byCategory[cat] || 0) + e.amount;
    total += e.amount;
    if (e.is_estimated) estimatedTotal += e.amount;
    else loggedTotal += e.amount;
  }

  return {
    budget: trip.budget,
    spent: total,
    remaining: trip.budget - total,
    byCategory,

    // — added so the page can render money and overspend honestly —
    currency: money.currency,
    symbol: money.symbol,
    over_budget: total > trip.budget,
    overspend: Math.max(0, total - trip.budget),
    logged_total: loggedTotal,
    estimated_total: estimatedTotal,
    // FR-09 — the split computed at trip creation, shown before a single
    // expense has been logged.
    planned_breakdown: trip.budget_breakdown || [],
    planned_total: trip.estimated_total || 0,
    budget_includes_flights: trip.budget_includes_flights !== false,
    flights_excluded: travelExcluded,
    budget_tier: trip.budget_tier,
  };
}

export const getBudgetSummary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });
  res.json(await buildBudgetSummary(trip));
});

// FR-10 — Expense Tracker
export const addExpense = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const currency = (req.body.currency || "BDT").toUpperCase();
  const { amount, converted } = await toBdt(req.body.amount, currency);
  if (!converted && currency !== "BDT") {
    return res.status(400).json({ message: `Unsupported currency: ${currency}` });
  }

  const expense = await Expense.create({
    ...req.body,
    currency,
    amount_bdt: Math.round(amount),
    trip_id: trip._id,
  });
  res.status(201).json({ expense });
});

export const getExpenses = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const expenses = await Expense.find({ trip_id: trip._id }).sort({ date: -1 });
  const virtuals = await getVirtualExpenses(trip);

  const logged = await Promise.all(
    expenses.map(async (e) => ({ ...e.toObject(), amount: await amountInBdt(e) }))
  );

  const allExpenses = [...logged, ...virtuals].sort((a, b) => new Date(b.date) - new Date(a.date));

  // map category for UI consistency
  const formatted = allExpenses.map((e) => ({ ...e, category: mapCategory(e.category) }));

  res.json({ expenses: formatted });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const updates = { ...req.body };
  if (updates.amount !== undefined || updates.currency !== undefined) {
    const existing = await Expense.findOne({ _id: req.params.expenseId, trip_id: trip._id });
    if (!existing) return res.status(404).json({ message: "Expense not found" });
    const currency = (updates.currency || existing.currency || "BDT").toUpperCase();
    const { amount, converted } = await toBdt(updates.amount ?? existing.amount, currency);
    if (!converted && currency !== "BDT") {
      return res.status(400).json({ message: `Unsupported currency: ${currency}` });
    }
    updates.currency = currency;
    updates.amount_bdt = Math.round(amount);
  }

  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.expenseId, trip_id: trip._id },
    updates,
    { new: true, runValidators: true }
  );
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  res.json({ expense });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const expense = await Expense.findOneAndDelete({ _id: req.params.expenseId, trip_id: trip._id });
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  res.json({ message: "Expense deleted" });
});
