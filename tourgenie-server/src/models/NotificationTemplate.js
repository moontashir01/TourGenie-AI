// FR-18 — Smart Notifications. The rules that produce Notification rows.
//
// A scheduler (or the trip read path) walks the active templates, evaluates
// each trigger against the trip's schedule and its WeatherForecast rows, and
// inserts a Notification when one fires. Non-real-time by design, per the
// SRS: no live traffic or disruption feed.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const notificationTemplateSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // departure_24h, rain_alert…
    type: { type: String, required: true }, // departure, weather, budget, document, booking
    label: { type: String, required: true },

    // Both support {{destination}}, {{trip_name}}, {{hours}}, {{temp}},
    // {{condition}}, {{amount}} placeholders.
    title_template: { type: String, required: true },
    message_template: { type: String, required: true },

    trigger: {
      event: {
        type: String,
        enum: [
          "trip_start_approaching",
          "trip_end_approaching",
          "daily_weather_check",
          "budget_threshold",
          "document_expiring",
          "booking_confirmed",
          "itinerary_generated",
          "trip_completed",
        ],
        required: true,
      },
      offset_hours: { type: Number, default: 0 }, // fire this many hours before
      threshold: { type: Number, default: null }, // % of budget, days to expiry…
      weather_conditions: { type: [String], default: [] }, // only for weather checks
    },

    severity: { type: String, enum: ["info", "reminder", "warning", "critical"], default: "info" },
    icon: { type: String, default: "Bell" },
    action_url: { type: String, default: "" }, // deep link into the app
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

notificationTemplateSchema.index({ "trigger.event": 1, is_active: 1 });

export default mongoose.model("NotificationTemplate", notificationTemplateSchema);
