// FR-10 — Expense Tracker. Proposal fields (§4.1.5) unchanged; `category`
// now carries a soft reference to ExpenseCategory.code so the donut chart
// can colour it, plus the per-traveller split the Budget page shows.
import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    // — proposal §4.1.5 —
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    category: { type: String, required: true, lowercase: true }, // ExpenseCategory.code
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },

    // — additive —
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    currency: { type: String, default: "BDT" },
    amount_bdt: { type: Number, default: null }, // converted, for foreign spend
    payment_method: {
      type: String,
      enum: ["cash", "card", "mobile_banking", "bank_transfer", "other"],
      default: "cash",
    },
    split_between: { type: Number, default: 1 }, // travellers sharing the cost
    receipt_url: { type: String, default: null },
    // Set when the row was generated from the plan rather than typed by hand.
    is_estimated: { type: Boolean, default: false },
    itinerary_item_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItineraryItem", default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

expenseSchema.index({ trip_id: 1, date: -1 });
expenseSchema.index({ trip_id: 1, category: 1 });

export default mongoose.model("Expense", expenseSchema);
