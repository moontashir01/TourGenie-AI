import Expense from "../models/Expense.js";
import Trip from "../models/Trip.js";
import { asyncHandler } from "../utils/asyncHandler.js";

async function assertOwnsTrip(tripId, userId) {
  return Trip.findOne({ _id: tripId, user_id: userId });
}

// FR-09 — Budget Management: categorized breakdown from itinerary + hotel + bookings
export const getBudgetSummary = asyncHandler(async (req, res) => {
  const trip = await assertOwnsTrip(req.params.tripId, req.user._id);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const expenses = await Expense.find({ trip_id: trip._id });
  const byCategory = {};
  let total = 0;
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
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
  res.json({ expenses });
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
