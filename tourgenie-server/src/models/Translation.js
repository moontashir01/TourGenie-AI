// FR-17 — Multi-language Support. One document per language, holding the
// full UI string table so the frontend fetches translations from the API
// instead of bundling five JSON files.
//
// `strings` is an open object keyed by dotted namespace ("nav.dashboard",
// "trip.generate_cta") — Mixed rather than Map so it round-trips as plain
// JSON to the client with no conversion.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const translationSchema = new mongoose.Schema(
  {
    lang: { type: String, required: true, unique: true, lowercase: true }, // en, bn, hi, ar, zh
    label: { type: String, required: true }, // "Bangla" (in English)
    native_label: { type: String, required: true }, // "বাংলা"
    direction: { type: String, enum: ["ltr", "rtl"], default: "ltr" },
    locale: { type: String, default: "" }, // en-US, bn-BD
    flag: { type: String, default: "" }, // emoji, for the language switcher

    strings: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Set on the one language new accounts get when they express no preference.
    is_default: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    completeness_pct: { type: Number, default: 100, min: 0, max: 100 },
  },
  TIMESTAMPS
);

translationSchema.index({ is_active: 1 });

export default mongoose.model("Translation", translationSchema);
