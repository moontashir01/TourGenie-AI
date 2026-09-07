// Real money, through SSLCommerz.
//
// This collection is the ledger, and it is deliberately separate from the two
// booking collections: a booking records what was reserved, a payment records
// what was charged, and the two have different lifecycles (a payment can fail
// and be retried against the same booking, or be refunded long after).
//
// The row is written BEFORE the traveller is sent to the gateway, in
// `initiated` state. That ordering matters — the amount is frozen here first,
// so when the gateway reports back we have our own figure to check its figure
// against. Trusting the amount in the callback is how tampered redirects get
// accepted.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

export const PAYMENT_STATUSES = ["initiated", "success", "failed", "cancelled", "refunded"];
export const BOOKING_KINDS = ["transport", "hotel"];

const paymentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },

    // Which booking this pays for. Stored as both the human reference (what
    // the traveller sees, and what the gateway echoes back in product fields)
    // and the id (what we actually update on settlement).
    booking_kind: { type: String, enum: BOOKING_KINDS, required: true },
    booking_ref: { type: String, required: true },
    booking_id: { type: mongoose.Schema.Types.ObjectId, required: true },

    // The authoritative figure. Everything in this app is stored in BDT, and
    // SSLCommerz settles in BDT, so no conversion happens at payment time.
    amount_bdt: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "BDT", uppercase: true },

    status: { type: String, enum: PAYMENT_STATUSES, default: "initiated" },

    // Our id for the transaction, generated here and sent to the gateway.
    // Unique because it is the idempotency key for the IPN: a gateway retry
    // carries the same tran_id, and settling twice must be impossible.
    tran_id: { type: String, required: true, unique: true },

    // The gateway's id for the *validation* of the transaction. Only present
    // once a callback has arrived; the validation API is keyed on it.
    val_id: { type: String, default: null },
    // Needed to issue a refund later — the refund API keys on this, not val_id.
    bank_tran_id: { type: String, default: "" },
    card_type: { type: String, default: "" },

    // Whole gateway responses, kept verbatim for dispute resolution. Never
    // read for business logic — the validated fields above are what count.
    init_response: { type: mongoose.Schema.Types.Mixed, default: null },
    callback_payload: { type: mongoose.Schema.Types.Mixed, default: null },
    validation_response: { type: mongoose.Schema.Types.Mixed, default: null },

    // Why a payment was refused, in our words rather than the gateway's, so
    // the failure is legible in the admin list without decoding a payload.
    failure_reason: { type: String, default: "" },

    validated_at: { type: Date, default: null },
    refunded_at: { type: Date, default: null },
    refund_ref: { type: String, default: "" },
    refund_amount: { type: Number, default: 0 },

    is_sandbox: { type: Boolean, default: true },
  },
  TIMESTAMPS
);

// The traveller's payment history, newest first.
paymentSchema.index({ user_id: 1, created_at: -1 });
// "Has this booking been paid for?" — asked on every booking read.
paymentSchema.index({ booking_kind: 1, booking_id: 1, status: 1 });

export default mongoose.model("Payment", paymentSchema);
