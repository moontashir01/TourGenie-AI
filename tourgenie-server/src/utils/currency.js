// Currency normalisation.
//
// Everything the app stores, sums and renders is BDT — trip.budget, hotel
// prices, itinerary est_cost, expenses. External providers quote in
// whatever they like (Ignav returns USD, StayAPI returns its request
// currency), so foreign amounts are converted here at the edge instead of
// being added straight into a BDT total 122x too small.
import ExchangeRate from "../models/ExchangeRate.js";

const CACHE_TTL_MS = 10 * 60 * 1000;

// Used only when the ExchangeRate collection hasn't been seeded yet — same
// indicative rates as src/seed/data/reference.js. 1 unit = N BDT.
const FALLBACK_RATES = {
  BDT: { name: "Bangladeshi Taka", symbol: "৳", rate: 1, decimals: 0 },
  USD: { name: "US Dollar", symbol: "$", rate: 122.0, decimals: 2 },
  EUR: { name: "Euro", symbol: "€", rate: 132.5, decimals: 2 },
  GBP: { name: "British Pound", symbol: "£", rate: 155.0, decimals: 2 },
  INR: { name: "Indian Rupee", symbol: "₹", rate: 1.42, decimals: 2 },
  NPR: { name: "Nepalese Rupee", symbol: "रू", rate: 0.89, decimals: 2 },
  THB: { name: "Thai Baht", symbol: "฿", rate: 3.55, decimals: 2 },
  MYR: { name: "Malaysian Ringgit", symbol: "RM", rate: 27.4, decimals: 2 },
  SGD: { name: "Singapore Dollar", symbol: "S$", rate: 91.0, decimals: 2 },
  AED: { name: "UAE Dirham", symbol: "د.إ", rate: 33.2, decimals: 2 },
  MVR: { name: "Maldivian Rufiyaa", symbol: "Rf", rate: 7.9, decimals: 2 },
  SAR: { name: "Saudi Riyal", symbol: "﷼", rate: 32.5, decimals: 2 },
  QAR: { name: "Qatari Riyal", symbol: "﷼", rate: 33.5, decimals: 2 },
  TRY: { name: "Turkish Lira", symbol: "₺", rate: 3.1, decimals: 2 },
};

let cache = null;
let cachedAt = 0;

/** All active rates as { CODE: { name, symbol, rate, decimals } }, memoised. */
export async function loadRates() {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;
  try {
    const rows = await ExchangeRate.find({ is_active: true }).lean();
    if (rows.length) {
      cache = Object.fromEntries(
        rows.map((r) => [
          r.currency,
          { name: r.name, symbol: r.symbol || "", rate: r.rate, decimals: r.decimals ?? 2 },
        ])
      );
      cachedAt = Date.now();
      return cache;
    }
  } catch (error) {
    console.warn("Exchange rate lookup failed, using fallback table:", error.message);
  }
  cache = { ...FALLBACK_RATES };
  cachedAt = Date.now();
  return cache;
}

/** Invalidate the memo — call after seeding or editing rates. */
export function clearRateCache() {
  cache = null;
  cachedAt = 0;
}

export function normalizeCode(currency) {
  return String(currency || "BDT").trim().toUpperCase() || "BDT";
}

/**
 * Convert `amount` from `currency` into BDT. Unknown currencies are passed
 * through unchanged rather than silently zeroed — a wrong-but-visible
 * number is easier to spot than a disappeared one, and the caller gets
 * `converted: false` so it can say so.
 */
export async function toBdt(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return { amount: 0, rate: 1, converted: false, currency: normalizeCode(currency) };
  const code = normalizeCode(currency);
  if (code === "BDT") return { amount: value, rate: 1, converted: true, currency: "BDT" };

  const rates = await loadRates();
  const entry = rates[code];
  if (!entry) {
    console.warn(`No exchange rate for ${code}; leaving amount unconverted.`);
    return { amount: value, rate: 1, converted: false, currency: code };
  }
  return { amount: value * entry.rate, rate: entry.rate, converted: true, currency: code };
}

/** Convert a BDT amount into `currency`. */
export async function fromBdt(amountBdt, currency) {
  const code = normalizeCode(currency);
  const value = Number(amountBdt) || 0;
  if (code === "BDT") return { amount: value, rate: 1, converted: true, currency: "BDT" };
  const rates = await loadRates();
  const entry = rates[code];
  if (!entry || !entry.rate) return { amount: value, rate: 1, converted: false, currency: code };
  return { amount: value / entry.rate, rate: entry.rate, converted: true, currency: code };
}

export async function currencyMeta(currency) {
  const code = normalizeCode(currency);
  const rates = await loadRates();
  return { currency: code, ...(rates[code] || FALLBACK_RATES.BDT) };
}

export default { loadRates, clearRateCache, toBdt, fromBdt, currencyMeta, normalizeCode };
