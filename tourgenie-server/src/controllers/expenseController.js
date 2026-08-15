import Expense from "../models/Expense.js";
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Hotel from "../models/Hotel.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
  if (c === "hotel" || c === "accommodation") return "Hotel";
  if (c === "shopping") return "Shopping";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export async function getVirtualExpenses(trip) {
  const virtuals = [];
  const items = await ItineraryItem.find({ trip_id: trip._id }).sort({ day: 1, time: 1 });

  if (trip.multi_city && trip.hotel_selections?.length) {
    // Nights per city are approximated from the itinerary: each day's last
    // activity (items arrive sorted by day, time, so later entries win)
    // marks the city the traveler sleeps in that night — there's no
    // separate hotel-stay-dates record to read from.
    const cityByDay = {};
    for (const item of items) {
      if (item.city) cityByDay[item.day] = item.city;
    }
    const nightsByCity = {};
    for (const city of Object.values(cityByDay)) {
      nightsByCity[city] = (nightsByCity[city] || 0) + 1;
    }
    for (const sel of trip.hotel_selections) {
      const hotel = sel.hotel_id;
      if (!hotel) continue;
      const nights = nightsByCity[sel.city] || 1;
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
  } else if (trip.hotel_id) {
    const cost = (trip.hotel_id.price_per_night || 0) * (trip.duration_days || 1);
    if (cost > 0) {
      virtuals.push({
        _id: `virt_hotel_${trip.hotel_id._id}`,
        trip_id: trip._id,
        category: "Hotel",
        description: `${trip.hotel_id.name} (${trip.duration_days} nights)`,
        amount: cost,
        date: trip.start_date,
        is_estimated: true,
      });
    }
  }

  if (trip.selected_flight) {
    const f = trip.selected_flight;
    virtuals.push({
      _id: `virt_flight_${f.id}`,
      trip_id: trip._id,
      category: "Transport",
      description: `${f.airline || 'Flight'} ${f.flightNumber || ''}`,
      amount: f.price || 0,
      date: trip.start_date,
      is_estimated: true,
    });
  }

  for (const item of items) {
    if (item.est_cost && item.est_cost > 0) {
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
      });
    }
  }

  return virtuals;
}

// FR-09 — Budget Management: categorized breakdown from itinerary + hotel + bookings
export const getBudgetSummary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const expenses = await Expense.find({ trip_id: trip._id });
  const virtuals = await getVirtualExpenses(trip);
  
  const allExpenses = [...expenses, ...virtuals];

  const byCategory = {};
  let total = 0;
  for (const e of allExpenses) {
    const cat = mapCategory(e.category);
    byCategory[cat] = (byCategory[cat] || 0) + e.amount;
    total += e.amount;
  }

  res.json({
    budget: trip.budget,
    spent: total,
    remaining: trip.budget - total,
    byCategory,
  });
});

// FR-10 — Expense Tracker
export const addExpense = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const expense = await Expense.create({ ...req.body, trip_id: trip._id });
  res.status(201).json({ expense });
});

export const getExpenses = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const expenses = await Expense.find({ trip_id: trip._id }).sort({ date: -1 });
  const virtuals = await getVirtualExpenses(trip);
  
  const allExpenses = [...expenses, ...virtuals].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // map category for UI consistency
  const formatted = allExpenses.map(e => {
    // If it's a mongoose document, toObject() it
    const obj = typeof e.toObject === 'function' ? e.toObject() : e;
    obj.category = mapCategory(obj.category);
    return obj;
  });

  res.json({ expenses: formatted });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.expenseId, trip_id: trip._id },
    req.body,
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
