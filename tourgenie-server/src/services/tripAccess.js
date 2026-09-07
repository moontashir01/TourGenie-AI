// Who may touch a trip, and at what depth.
//
// Every trip-scoped handler used to run its own `Trip.findOne({ _id, user_id })`
// — about twenty copies of one rule, which is fine while the rule is "the
// owner and nobody else" and becomes a leak the moment it isn't. Sharing adds
// a second way in, so the question moves here and the handlers ask it.
//
// The answer to "you may not" is the same `null` an unknown id produces, and
// every caller turns that into the same 404. A trip a user has no claim on
// must not be distinguishable from one that doesn't exist.
import mongoose from "mongoose";
import Trip from "../models/Trip.js";
import TripShare from "../models/TripShare.js";

// What a role is allowed to reach. Owner outranks editor outranks viewer, so
// one comparison covers "at least this much".
const RANK = { viewer: 1, editor: 2, owner: 3 };

export const VIEW = "viewer";
export const EDIT = "editor";
export const OWN = "owner";

/**
 * This user's role on this trip, or null if they have none.
 *
 * Only an *accepted* share counts. A pending invite is not access — the
 * address hasn't been claimed yet — and a revoked one is access withdrawn,
 * which takes effect on the next request because nothing is cached.
 */
export async function roleOnTrip(trip, userId) {
  if (!trip || !userId) return null;
  if (String(trip.user_id?._id || trip.user_id) === String(userId)) return OWN;

  const share = await TripShare.findOne({
    trip_id: trip._id,
    shared_with_user_id: userId,
    status: "accepted",
  })
    .select("role")
    .lean();

  return share ? share.role : null;
}

/**
 * The trip plus the role the user holds on it, or `{ trip: null, role: null }`.
 *
 * @param {object} options
 * @param {"viewer"|"editor"|"owner"} options.level the minimum role required
 * @param {Array} options.populate mongoose populate arguments, each entry
 *   either a string or an array of arguments to spread
 * @param {boolean} options.lean return a plain object rather than a document
 */
export async function resolveTrip(tripId, userId, { level = VIEW, populate = [], lean = false } = {}) {
  if (!mongoose.isValidObjectId(tripId)) return { trip: null, role: null };

  let query = Trip.findById(tripId);
  for (const spec of populate) {
    query = Array.isArray(spec) ? query.populate(...spec) : query.populate(spec);
  }
  if (lean) query = query.lean();

  const trip = await query;
  if (!trip) return { trip: null, role: null };

  const role = await roleOnTrip(trip, userId);
  if (!role || RANK[role] < RANK[level]) return { trip: null, role: null };

  return { trip, role };
}

/**
 * The trip if this user may use it at `level`, otherwise null — the drop-in
 * replacement for the `assertOwnsTrip` each controller used to carry.
 */
export async function findTripForUser(tripId, userId, options) {
  const { trip } = await resolveTrip(tripId, userId, options);
  return trip;
}

export default { resolveTrip, findTripForUser, roleOnTrip, VIEW, EDIT, OWN };
