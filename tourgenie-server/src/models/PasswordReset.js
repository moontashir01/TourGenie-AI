// FR-02 (password recovery) — one row per "email me a reset code" request.
//
// The code itself is never stored: only a bcrypt hash of it, the same way
// account passwords are handled. A row is short-lived by design — `expires_at`
// is the 2-minute window the code is valid for, while `purge_at` keeps the row
// around a little longer so resend cooldowns and rate limits can still see it.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

// How long a code stays usable, and how fast a new one can be requested.
export const OTP_TTL_SECONDS = 120; // 2 minutes
export const RESEND_COOLDOWN_SECONDS = 30;
export const MAX_SENDS_PER_WINDOW = 5;
export const SEND_WINDOW_SECONDS = 15 * 60;
export const MAX_VERIFY_ATTEMPTS = 5;

const passwordResetSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Kept alongside user_id so cooldown and rate-limit lookups work off the
    // address the visitor typed, without a User round-trip first.
    email: { type: String, required: true, lowercase: true, trim: true },
    otp_hash: { type: String, required: true, select: false },
    expires_at: { type: Date, required: true },
    // Wrong guesses on this code; the row is burned once it hits the cap.
    attempts: { type: Number, default: 0 },
    // Set when the right code was entered — the reset token is only honoured
    // for a row that reached this state.
    verified_at: { type: Date, default: null },
    // Set once the password has actually been changed, so a reset token can
    // never be replayed.
    consumed_at: { type: Date, default: null },
    ip: { type: String, default: "" },
  },
  TIMESTAMPS
);

// Newest request for an address — the cooldown and rate-limit checks.
passwordResetSchema.index({ email: 1, created_at: -1 });
// Mongo sweeps the row an hour after it was made; the 2-minute code expiry is
// enforced in the handler, not here, so an expired code can still be reported
// as "expired" rather than silently unknown.
passwordResetSchema.index({ created_at: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model("PasswordReset", passwordResetSchema);
