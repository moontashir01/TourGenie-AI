// FR — sharing a trip with another traveller.
//
// The owner names an address and a role. If that address already has an
// account the share is live immediately, which is what the inviter expects
// when they tell someone "I've shared it with you". If it doesn't, the invite
// waits as `pending` and registration picks it up, so inviting a friend who
// hasn't signed up yet does something rather than nothing.
import crypto from "crypto";
import Trip from "../models/Trip.js";
import TripShare from "../models/TripShare.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { findTripForUser, OWN } from "../services/tripAccess.js";
import { sendMail, tripShareInviteEmail } from "../services/mailer.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["viewer", "editor"];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/** What the owner's "Shared with" list shows. */
function present(share) {
  return {
    _id: share._id,
    email: share.invited_email,
    role: share.role,
    status: share.status,
    // Populated when the invitee has an account; a pending invite has no name
    // to show yet, which is exactly what "waiting to sign up" looks like.
    name: share.shared_with_user_id?.name || "",
    created_at: share.created_at,
    accepted_at: share.accepted_at,
  };
}

async function ownedTrip(req) {
  return findTripForUser(req.params.id, req.user._id, { level: OWN });
}

// GET /api/trips/:id/shares — owner only. Who can see this trip.
export const listTripShares = asyncHandler(async (req, res) => {
  const trip = await ownedTrip(req);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const shares = await TripShare.find({ trip_id: trip._id, status: { $ne: "revoked" } })
    .populate("shared_with_user_id", "name")
    .sort({ created_at: 1 });

  res.json({ shares: shares.map(present) });
});

// POST /api/trips/:id/shares — invite one address.
export const shareTrip = asyncHandler(async (req, res) => {
  const trip = await ownedTrip(req);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const email = String(req.body.email || "").trim().toLowerCase();
  const role = String(req.body.role || "viewer");

  if (!EMAIL_PATTERN.test(email)) throw badRequest("That doesn't look like a valid email address");
  if (!ROLES.includes(role)) throw badRequest(`Role must be one of: ${ROLES.join(", ")}`);
  if (email === String(req.user.email).toLowerCase()) {
    throw badRequest("You already own this trip — share it with someone else's address");
  }

  const invitee = await User.findOne({ email }).select("_id name email is_active");

  // Re-inviting the same address updates the existing row rather than
  // failing on the unique index — including bringing a revoked one back.
  const existing = await TripShare.findOne({ trip_id: trip._id, invited_email: email });
  const share =
    existing ||
    new TripShare({
      trip_id: trip._id,
      owner_id: req.user._id,
      invited_email: email,
      token: crypto.randomBytes(24).toString("hex"),
    });

  share.owner_id = req.user._id;
  share.role = role;
  share.shared_with_user_id = invitee?._id || null;
  // An account today means access today; without one the invite waits for a
  // sign-up to claim it.
  share.status = invitee ? "accepted" : "pending";
  share.accepted_at = invitee ? share.accepted_at || new Date() : null;
  share.revoked_at = null;
  await share.save();

  const invite = tripShareInviteEmail({
    inviterName: req.user.name,
    trip,
    role,
    hasAccount: Boolean(invitee),
    token: share.token,
  });
  // A mail outage must not lose the share that is already saved — sendMail
  // reports rather than throws, and the response says what happened.
  const delivery = await sendMail({ to: email, ...invite });

  await share.populate("shared_with_user_id", "name");
  res.status(201).json({ share: present(share), email_sent: delivery.delivered !== false });
});

// PATCH /api/trips/:id/shares/:shareId — change a role.
export const updateTripShare = asyncHandler(async (req, res) => {
  const trip = await ownedTrip(req);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const role = String(req.body.role || "");
  if (!ROLES.includes(role)) throw badRequest(`Role must be one of: ${ROLES.join(", ")}`);

  const share = await TripShare.findOne({ _id: req.params.shareId, trip_id: trip._id });
  if (!share || share.status === "revoked") return res.status(404).json({ message: "Share not found" });

  share.role = role;
  await share.save();
  await share.populate("shared_with_user_id", "name");
  res.json({ share: present(share) });
});

// DELETE /api/trips/:id/shares/:shareId — revoke.
//
// Nothing caches a role, so the next request the revoked user makes resolves
// no share and gets the same 404 a stranger gets.
export const revokeTripShare = asyncHandler(async (req, res) => {
  const trip = await ownedTrip(req);
  if (!trip) return res.status(404).json({ message: "Trip not found" });

  const share = await TripShare.findOne({ _id: req.params.shareId, trip_id: trip._id });
  if (!share) return res.status(404).json({ message: "Share not found" });

  share.status = "revoked";
  share.revoked_at = new Date();
  await share.save();
  res.json({ message: "Access revoked" });
});

// POST /api/trips/shares/accept/:token — claim an invite from its emailed link.
//
// The token identifies the invite; it does not authorise anything on its own.
// Whoever follows the link still has to be signed in as the invited address,
// so a forwarded email can't hand the trip to somebody else.
export const acceptTripShare = asyncHandler(async (req, res) => {
  const share = await TripShare.findOne({ token: req.params.token });
  if (!share || share.status === "revoked") {
    return res.status(404).json({ message: "That invitation is no longer valid" });
  }

  if (share.invited_email !== String(req.user.email).toLowerCase()) {
    return res.status(403).json({
      message: `This invitation was sent to ${share.invited_email}. Sign in with that address to accept it.`,
    });
  }

  if (share.status !== "accepted") {
    share.shared_with_user_id = req.user._id;
    share.status = "accepted";
    share.accepted_at = new Date();
    await share.save();
  }

  const trip = await Trip.findById(share.trip_id).select("_id title destination");
  res.json({ trip, role: share.role });
});
