// The expense / budget categories and their chart colours — previously
// hardcoded in the frontend's mock data. Keeping them here means the donut
// chart on the Budget page (wireframe §3.10) and the category dropdown on
// the Add Expense form are driven by the same rows, and an admin can add a
// category without touching the client.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const expenseCategorySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true }, // transport, hotel…
    label: { type: String, required: true }, // "Transport"
    color: { type: String, required: true }, // hex, used by the donut chart
    icon: { type: String, default: "Wallet" }, // lucide-react icon name
    description: { type: String, default: "" },

    // Share of the total budget this category is expected to take, used to
    // seed the estimated breakdown before any real expense is logged.
    default_budget_share: { type: Number, default: 0, min: 0, max: 1 },

    sort_order: { type: Number, default: 0 },
    is_system: { type: Boolean, default: true }, // system rows can't be deleted
    is_active: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

expenseCategorySchema.index({ sort_order: 1 });

export default mongoose.model("ExpenseCategory", expenseCategorySchema);
