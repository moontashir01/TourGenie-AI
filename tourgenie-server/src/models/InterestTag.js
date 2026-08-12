// The selectable interest chips on the Plan New Trip form (wireframe §3.5).
// Stored rather than hardcoded because the same codes are matched against
// ItineraryTemplate.interests and PackingTemplate.conditions.interests — one
// list, one source of truth.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const interestTagSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true }, // beach, trekking…
    label: { type: String, required: true },
    icon: { type: String, default: "Sparkles" }, // lucide-react icon name
    description: { type: String, default: "" },
    // Groups the chips visually on the form.
    group: {
      type: String,
      enum: ["nature", "culture", "activity", "food", "relaxation", "social"],
      default: "activity",
    },
    // Destination types this interest is a good fit for — powers "you might
    // also like" suggestions on the destination page.
    suits_destination_types: { type: [String], default: [] },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

interestTagSchema.index({ group: 1, sort_order: 1 });

export default mongoose.model("InterestTag", interestTagSchema);
