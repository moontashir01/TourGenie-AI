import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

// Country-level metadata is kept separate from destinations so locale,
// currency, and airport defaults have one canonical source.
const countrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, minlength: 2, maxlength: 2 },
    name: { type: String, required: true, unique: true },
    capital: { type: String, default: "" },
    currency: { type: String, required: true, uppercase: true },
    currency_symbol: { type: String, default: "" },
    pricing_currency: { type: String, default: "BDT", uppercase: true },
    timezones: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    primary_airport: { type: String, default: null, uppercase: true },
    is_core: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS,
);

countrySchema.index({ is_core: -1, name: 1 });

export default mongoose.model("Country", countrySchema);
