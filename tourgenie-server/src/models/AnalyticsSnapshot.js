// FR-24 — Admin Analytics Dashboard.
//
// Rolling the metrics up once a day means the admin charts read a few dozen
// small documents instead of running count aggregations across every
// collection on each page load (NFR-01: queries under 500 ms).
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const analyticsSnapshotSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true }, // 00:00 UTC of the period
    period: { type: String, enum: ["day", "month"], default: "day" },
    period_key: { type: String, required: true }, // "2026-08-11" or "2026-08"

    metrics: {
      users_total: { type: Number, default: 0 },
      users_new: { type: Number, default: 0 },
      users_active: { type: Number, default: 0 },

      trips_total: { type: Number, default: 0 },
      trips_created: { type: Number, default: 0 },
      trips_by_status: {
        draft: { type: Number, default: 0 },
        planned: { type: Number, default: 0 },
        active: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
      },

      bookings_created: { type: Number, default: 0 },
      bookings_value_bdt: { type: Number, default: 0 },

      itineraries_generated: { type: Number, default: 0 },
      chat_messages: { type: Number, default: 0 },

      posts_created: { type: Number, default: 0 },
      reviews_created: { type: Number, default: 0 },
      pending_moderation: { type: Number, default: 0 },

      documents_uploaded: { type: Number, default: 0 },
      expenses_logged: { type: Number, default: 0 },
      total_expense_bdt: { type: Number, default: 0 },
      carbon_kg_total: { type: Number, default: 0 },
    },

    top_destinations: {
      type: [{ city: String, count: Number, _id: false }],
      default: [],
    },
    top_interests: {
      type: [{ interest: String, count: Number, _id: false }],
      default: [],
    },

    computed_at: { type: Date, default: Date.now },
  },
  TIMESTAMPS
);

analyticsSnapshotSchema.index({ period: 1, period_key: 1 }, { unique: true });
analyticsSnapshotSchema.index({ period: 1, date: -1 });

export default mongoose.model("AnalyticsSnapshot", analyticsSnapshotSchema);
