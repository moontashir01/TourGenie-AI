// One traveller letting another into a trip.
//
// Trip.user_id stays the single owner — this collection is the only thing
// that widens access, so "who may touch this trip" has exactly two answers to
// check and no handler has to reason about a list of members embedded on the
// trip itself.
//
// An invite to an address with no account yet is kept as `pending` with
// `shared_with_user_id: null`. Registration looks for those and attaches them,
// so inviting someone before they sign up works rather than silently doing
// nothing.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const tripShareSchema = new mongoose.Schema(
  {
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Null until the invited address has an account.
    shared_with_user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // The address the owner typed. Lower-cased to match User.email, which is
    // stored lower-cased too — otherwise "Sam@x.com" and "sam@x.com" would be
    // two invites to one person.
    invited_email: { type: String, required: true, lowercase: true, trim: true },

    role: { type: String, enum: ["viewer", "editor"], default: "viewer" },

    // revoked rows are kept rather than deleted: the owner can see who used to
    // have access, and re-inviting the same address reuses the row.
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },

    // Identifies the invite in the emailed link. Not a credential on its own —
    // accepting still requires being signed in as the invited address.
    token: { type: String, required: true, unique: true, index: true },

    accepted_at: { type: Date, default: null },
    revoked_at: { type: Date, default: null },
  },
  TIMESTAMPS
);

// One invite per address per trip; re-inviting updates that row.
tripShareSchema.index({ trip_id: 1, invited_email: 1 }, { unique: true });
// The dashboard's "shared with me" lookup.
tripShareSchema.index({ shared_with_user_id: 1, status: 1 });
// Registration's "was this address invited to anything?" lookup.
tripShareSchema.index({ invited_email: 1, status: 1 });

export default mongoose.model("TripShare", tripShareSchema);
