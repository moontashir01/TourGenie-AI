import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-02: verifies the JWT and attaches the requesting user to req.user
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized — no token provided" });
  }

  const token = header.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Not authorized — invalid or expired token" });
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.is_active) {
    return res.status(401).json({ message: "Not authorized — account not found or deactivated" });
  }

  // A token signed before the password changed is spent. Tokens issued
  // before `tv` existed carry no claim and read as 0, matching the default
  // on the account, so the upgrade signs nobody out on its own.
  if ((decoded.tv ?? 0) !== (user.token_version || 0)) {
    return res.status(401).json({ message: "Not authorized — the password on this account changed. Sign in again." });
  }

  req.user = user;
  next();
});

// For routes anyone may read but that show something extra to whoever is
// logged in — the community feed marks the posts you've liked. A missing or
// stale token is not an error here; it just means there is no `req.user`.
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    // Same version check as `protect` — a token the password change retired
    // reads here as no token at all.
    if (user?.is_active && (decoded.tv ?? 0) === (user.token_version || 0)) req.user = user;
  } catch {
    // Expired or forged — carry on as an anonymous reader.
  }
  next();
});

// Role-based access control (FR-20 through FR-24).
//
// The portal has three levels above a traveller, so a route declares the
// floor it needs rather than everything sharing one "is admin" test:
//   moderator — read the dashboards, moderate posts and reviews
//   admin     — the above, plus catalogue CRUD, user status, exports
//   owner     — the above, plus role changes and hard deletes
export const ROLES = ["traveler", "moderator", "admin", "owner"];
export const STAFF_ROLES = ["moderator", "admin", "owner"];

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: "You don't have access to that" });
    }
    next();
  };

// Kept for the routes that were written against it; "admin or above".
export const adminOnly = requireRole("admin", "owner");
