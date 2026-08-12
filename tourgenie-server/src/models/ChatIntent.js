// FR-05 — the database side of the chat assistant.
//
// Each intent is a set of patterns to match a traveller's message against,
// the reply to give, and the itinerary operation to run. The quick-action
// chips in the wireframe ("Make it cheaper", "Add one more day", "Vegetarian
// food only", "What if it rains?") are rows in this collection, which is why
// the chat works with no AI provider configured.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const chatIntentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // reduce_budget, add_day…
    label: { type: String, required: true },

    // Case-insensitive regex sources, tested against the user's message.
    patterns: { type: [String], default: [] },
    keywords: { type: [String], default: [] }, // cheaper cheap budget save

    // Shown as a chip above the chat input when set.
    is_quick_action: { type: Boolean, default: false },
    quick_action_label: { type: String, default: "" },
    quick_action_order: { type: Number, default: 0 },

    // Supports {{destination}}, {{days}}, {{budget}}, {{saved}} placeholders.
    response_template: { type: String, required: true },
    followup_suggestions: { type: [String], default: [] },

    action: {
      type: {
        type: String,
        enum: [
          "none",
          "reduce_budget",
          "increase_budget",
          "add_day",
          "remove_day",
          "filter_food",
          "swap_weather_dependent",
          "reorder_day",
          "add_activity",
          "explain",
        ],
        default: "none",
      },
      params: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // Higher wins when several intents match the same message.
    priority: { type: Number, default: 10 },
    requires_trip: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

chatIntentSchema.index({ is_active: 1, priority: -1 });
chatIntentSchema.index({ is_quick_action: 1, quick_action_order: 1 });

export default mongoose.model("ChatIntent", chatIntentSchema);
