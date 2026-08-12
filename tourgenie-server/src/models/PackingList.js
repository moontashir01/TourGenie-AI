// FR-15 — Smart Packing Assistant, result side.
//
// The generated list for one trip, persisted so the checkboxes the traveller
// ticks survive a reload and "Regenerate List" (wireframe §3.14) can diff
// against what was there before.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";
import { PACKING_CATEGORIES } from "./PackingTemplate.js";

const listItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    qty: { type: Number, default: 1 },
    essential: { type: Boolean, default: false },
    checked: { type: Boolean, default: false },
    note: { type: String, default: "" },
    from_template: { type: String, default: "" }, // template code, for traceability
  },
  { _id: false }
);

const categoryGroupSchema = new mongoose.Schema(
  {
    category: { type: String, enum: PACKING_CATEGORIES, required: true },
    items: { type: [listItemSchema], default: [] },
  },
  { _id: false }
);

const packingListSchema = new mongoose.Schema(
  {
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, unique: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    categories: { type: [categoryGroupSchema], default: [] },

    // Snapshot of what the list was generated from, so the UI can explain
    // "packed rain gear because 3 of your 4 days show rain".
    based_on: {
      days: { type: Number, default: 0 },
      travelers: { type: Number, default: 1 },
      temp_min_c: { type: Number, default: null },
      temp_max_c: { type: Number, default: null },
      weather_summary: { type: String, default: "" },
      packing_hints: { type: [String], default: [] },
      interests: { type: [String], default: [] },
      templates_applied: { type: [String], default: [] },
    },

    generated_at: { type: Date, default: Date.now },
  },
  TIMESTAMPS
);

packingListSchema.index({ user_id: 1 });

export default mongoose.model("PackingList", packingListSchema);
