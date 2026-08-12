// FR-01 / FR-02 — accounts and authentication.
//
// Proposal fields (§4.1.1) unchanged. Added: profile and preference fields
// the settings screen writes, and the counters the admin user table reads
// without having to aggregate across trips on every render.
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // — proposal §4.1.1 —
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true, select: false },
    role: { type: String, enum: ["traveler", "admin"], default: "traveler" },
    language: { type: String, default: "en" },

    // — already in use by the app —
    is_active: { type: Boolean, default: true },

    // — additive —
    phone: { type: String, default: "" },
    avatar_url: { type: String, default: null },
    country: { type: String, default: "Bangladesh" },
    country_code: { type: String, default: "BD", uppercase: true, minlength: 2, maxlength: 2 },
    city: { type: String, default: "" },
    date_of_birth: { type: Date, default: null },

    preferences: {
      currency: { type: String, default: "BDT" },
      default_budget_tier: { type: String, enum: ["budget", "mid", "luxury"], default: "mid" },
      interests: { type: [String], default: [] }, // pre-fills the Plan Trip form
      notify_departure: { type: Boolean, default: true },
      notify_weather: { type: Boolean, default: true },
      notify_budget: { type: Boolean, default: true },
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    },

    // Denormalised counters — cheap for the admin table, refreshed on write.
    stats: {
      trips_count: { type: Number, default: 0 },
      bookings_count: { type: Number, default: 0 },
      reviews_count: { type: Number, default: 0 },
      posts_count: { type: Number, default: 0 },
    },

    last_login_at: { type: Date, default: null },
    email_verified: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

userSchema.index({ role: 1, is_active: 1 });
userSchema.index({ created_at: -1 });

export default mongoose.model("User", userSchema);
