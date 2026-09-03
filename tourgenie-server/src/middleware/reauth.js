// Re-authentication for the handful of admin actions a stolen laptop should
// not be enough for.
//
// A session token lasts a week and lives in localStorage. That is fine for
// reading a dashboard and wrong for granting someone `owner`, deleting an
// account and everything it owns, or walking a CSV of email addresses out of
// the system. Those three ask for the password again, and the confirmation
// they get back is good for two minutes — long enough to answer a prompt,
// short enough to be worthless if it leaks.
//
// The confirmation is a second JWT rather than the password itself repeated
// on the request: the export is a GET, and a password in a query string ends
// up in the access log.
import jwt from "jsonwebtoken";

const PURPOSE = "admin_reauth";
export const REAUTH_TTL_SECONDS = 120;
export const REAUTH_HEADER = "x-reauth-token";

/** Told apart from a plain 403 so the client knows to open the prompt. */
export const REAUTH_REQUIRED = "reauth_required";

export function issueReauthToken(user) {
  return jwt.sign({ id: String(user._id), purpose: PURPOSE }, process.env.JWT_SECRET, {
    expiresIn: REAUTH_TTL_SECONDS,
  });
}

// 403 and never 401. The client ends the session on any 401 that carried a
// bearer token, so answering "confirm your password" with a 401 would log the
// admin out instead of prompting them.
function refuse(res, message) {
  return res.status(403).json({ message, code: REAUTH_REQUIRED });
}

export const requireRecentAuth = (req, res, next) => {
  const token = req.headers[REAUTH_HEADER];
  if (!token) return refuse(res, "Confirm your password to continue.");

  let decoded;
  try {
    decoded = jwt.verify(String(token), process.env.JWT_SECRET);
  } catch {
    return refuse(res, "That confirmation has expired. Enter your password again.");
  }

  // Purpose and subject both, so a login token can't stand in for a
  // confirmation and one admin's confirmation can't be replayed by another.
  if (decoded.purpose !== PURPOSE || decoded.id !== String(req.user?._id)) {
    return refuse(res, "That confirmation isn't valid for this account.");
  }
  next();
};

// An export of the seeded catalogue is routine; an export carrying email
// addresses is the thing the password is protecting, so only that one asks.
export const requireRecentAuthForPersonalData = (req, res, next) =>
  req.query.include_personal === "true" ? requireRecentAuth(req, res, next) : next();
