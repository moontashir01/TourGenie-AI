// FR-15 — Smart Packing Assistant, rule side.
//
// Each template is a bundle of items plus the conditions under which it
// applies. The generator loads every active template, keeps the ones whose
// conditions match the trip's weather + interests + duration, and merges
// their items into a PackingList. No AI call needed — the "smart" part is
// the rule match against the WeatherForecast rows for the trip dates.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

export const PACKING_CATEGORIES = [
  "clothing",
  "electronics",
  "documents",
  "toiletries",
  "health",
  "gear",
  "misc",
];

const packingItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // How many to pack. "per_day" → one per trip day, "fixed" → qty as-is,
    // "per_traveler" → one each. Resolved by the generator.
    qty_rule: { type: String, enum: ["fixed", "per_day", "per_traveler", "per_2_days"], default: "fixed" },
    qty: { type: Number, default: 1 },
    essential: { type: Boolean, default: false },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const packingTemplateSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // rain-gear, hot-weather…
    label: { type: String, required: true },
    category: { type: String, enum: PACKING_CATEGORIES, required: true },
    description: { type: String, default: "" },

    items: { type: [packingItemSchema], default: [] },

    // All present conditions must match for the template to be included.
    // Empty / null means "don't care about this dimension".
    conditions: {
      min_temp_c: { type: Number, default: null }, // applies when trip max temp >= this
      max_temp_c: { type: Number, default: null }, // applies when trip min temp <= this
      weather_conditions: { type: [String], default: [] }, // rain, heavy-rain, clear…
      packing_hints: { type: [String], default: [] }, // matches WeatherForecast.packing_hints
      destination_types: { type: [String], default: [] }, // beach, hill, island…
      interests: { type: [String], default: [] }, // trekking, photography…
      min_days: { type: Number, default: null },
      max_days: { type: Number, default: null },
      international_only: { type: Boolean, default: false },
    },

    // Higher priority wins when two templates supply the same item name.
    priority: { type: Number, default: 10 },
    always_include: { type: Boolean, default: false }, // baseline kit, no matching
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

packingTemplateSchema.index({ category: 1, priority: -1 });
packingTemplateSchema.index({ is_active: 1, always_include: 1 });

export default mongoose.model("PackingTemplate", packingTemplateSchema);
