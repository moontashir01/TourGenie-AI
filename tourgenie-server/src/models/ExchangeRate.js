// Currency conversion for international trips, held locally so no FX API is
// needed. All rates are quoted against BDT: `rate` is how many BDT one unit
// of `currency` buys.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const exchangeRateSchema = new mongoose.Schema(
  {
    base: { type: String, default: "BDT", uppercase: true },
    currency: { type: String, required: true, unique: true, uppercase: true }, // USD, EUR…
    name: { type: String, required: true }, // "US Dollar"
    symbol: { type: String, default: "" },
    rate: { type: Number, required: true, min: 0 }, // 1 <currency> = <rate> BDT
    decimals: { type: Number, default: 2 },
    // Indicative reference rates for estimating, not for settling payments.
    as_of: { type: Date, default: Date.now },
    source: { type: String, default: "seeded-indicative" },
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

export default mongoose.model("ExchangeRate", exchangeRateSchema);
