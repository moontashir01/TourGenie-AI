import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { referenceApi } from "../lib/api";

// Everything in the database is stored in BDT — trip budgets, hotel rates,
// itinerary costs, expenses. That's correct for storage and unhelpful for a
// traveller standing at a hotel desk in Bangkok, so this converts for
// display only. Nothing here is ever written back.
//
// Rates come from the ExchangeRate collection through /reference/currencies,
// with the same indicative figures the server falls back to.
const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [rates, setRates] = useState({});

  useEffect(() => {
    referenceApi
      .currencies()
      .then(({ currencies }) => {
        setRates(Object.fromEntries((currencies || []).map((c) => [c.code, c])));
      })
      .catch(() => setRates({}));
  }, []);

  const formatBdt = useCallback((amount) => `৳${Math.round(Number(amount) || 0).toLocaleString()}`, []);

  /**
   * A BDT amount expressed in another currency, or null when the code is
   * unknown, is BDT itself, or the rates haven't loaded. Returning null
   * rather than the unconverted number keeps callers from showing a figure
   * labelled with the wrong symbol.
   */
  const convert = useCallback(
    (amountBdt, code) => {
      if (!code || code === "BDT") return null;
      const entry = rates[code];
      if (!entry?.rate) return null;

      const value = (Number(amountBdt) || 0) / entry.rate;
      // Small foreign amounts need a decimal to stay meaningful; large ones
      // read better rounded.
      const decimals = value >= 100 ? 0 : entry.decimals ?? 2;
      return {
        code,
        symbol: entry.symbol || "",
        value,
        formatted: `${entry.symbol || ""}${value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}`,
      };
    },
    [rates]
  );

  const value = useMemo(
    () => ({ rates, formatBdt, convert, ready: Object.keys(rates).length > 0 }),
    [rates, formatBdt, convert]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  // Deliberately forgiving: money renders on pages that may sit outside the
  // provider during a refactor, and a missing rate table should degrade to
  // plain BDT rather than crash the page.
  return ctx || { rates: {}, formatBdt: (n) => `৳${Math.round(Number(n) || 0).toLocaleString()}`, convert: () => null, ready: false };
}
