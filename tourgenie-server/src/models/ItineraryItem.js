// FR-04 — one activity on one day of a trip. Proposal fields (§4.1.3)
// unchanged; the additions let the itinerary view show duration, group by
// theme, and swap weather-dependent activities when the forecast turns.
import mongoose from "mongoose";

const itineraryItemSchema = new mongoose.Schema(
  {
    // — proposal §4.1.3 —
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    attraction_id: { type: mongoose.Schema.Types.ObjectId, ref: "Attraction", default: null },
    day: { type: Number, required: true, min: 1 },
    time: { type: String, required: true }, // "09:00"
    activity: { type: String, required: true },
    est_cost: { type: Number, default: 0 },

    // — already in use by the app —
    location: { type: String, default: "" },

    // — additive —
    date: { type: Date, default: null }, // resolved calendar date for the day
    end_time: { type: String, default: "" },
    duration_min: { type: Number, default: 60 },
    category: {
      type: String,
      enum: ["travel", "meal", "sightseeing", "activity", "rest", "shopping", "checkin", "checkout"],
      default: "activity",
    },
    day_theme: { type: String, default: "" },
    notes: { type: String, default: "" },
    lat_lng: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    weather_dependent: { type: Boolean, default: false },
    is_locked: { type: Boolean, default: false }, // the chat assistant won't move it
    is_completed: { type: Boolean, default: false },
    sort_order: { type: Number, default: 0 },
    source: { type: String, default: "template" }, // template | ai | manual | chat
    
    // — transport options —
    available_transport_options: { type: [mongoose.Schema.Types.Mixed], default: [] },
    selected_transport_option: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

itineraryItemSchema.index({ trip_id: 1, day: 1, time: 1 });
itineraryItemSchema.index({ attraction_id: 1 });

export default mongoose.model("ItineraryItem", itineraryItemSchema);
