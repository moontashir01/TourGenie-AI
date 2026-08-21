import { loadRates } from "../utils/currency.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Public reference data the client needs to render money correctly: the
// currencies a budget can be entered in (and what one unit is worth in BDT),
// and the categories the Budget page colours its chart with.
export const getCurrencies = asyncHandler(async (req, res) => {
  const rates = await loadRates();
  const currencies = Object.entries(rates)
    .map(([code, meta]) => ({ code, ...meta }))
    // BDT first — it's the storage currency and the default in the form.
    .sort((a, b) => (a.code === "BDT" ? -1 : b.code === "BDT" ? 1 : a.code.localeCompare(b.code)));
  res.json({ base: "BDT", currencies });
});

export const getExpenseCategories = asyncHandler(async (req, res) => {
  const categories = await ExpenseCategory.find({ is_active: true }).sort({ sort_order: 1 }).lean();
  res.json({ categories });
});
