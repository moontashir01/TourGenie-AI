import { loadRates } from "../utils/currency.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import Translation from "../models/Translation.js";
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

// FR-17 — the language switcher's menu: every active language, no strings.
export const getLanguages = asyncHandler(async (req, res) => {
  const languages = await Translation.find({ is_active: true })
    .select("lang label native_label flag direction is_default")
    .sort({ is_default: -1, lang: 1 })
    .lean();
  res.json({ languages });
});

// FR-17 — one language's full string table.
export const getTranslation = asyncHandler(async (req, res) => {
  const row = await Translation.findOne({
    lang: String(req.params.lang).toLowerCase(),
    is_active: true,
  }).lean();
  if (!row) return res.status(404).json({ message: "Language not found" });
  res.json({ lang: row.lang, direction: row.direction, strings: row.strings || {} });
});
