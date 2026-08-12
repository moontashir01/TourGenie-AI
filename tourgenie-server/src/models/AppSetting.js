// Platform configuration as data: feature flags, limits, and the copy that
// the admin should be able to change without a redeploy.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // booking.mock_only
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    type: {
      type: String,
      enum: ["boolean", "number", "string", "json", "array"],
      default: "string",
    },
    group: { type: String, default: "general" }, // general, limits, features, ai
    label: { type: String, default: "" },
    description: { type: String, default: "" },
    // false for anything that must not reach the browser.
    is_public: { type: Boolean, default: true },
    is_editable: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

appSettingSchema.index({ group: 1 });
appSettingSchema.index({ is_public: 1 });

export default mongoose.model("AppSetting", appSettingSchema);
