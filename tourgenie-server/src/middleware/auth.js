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

  req.user = user;
  next();
});

// Role-based access control for admin-only routes (FR-20 through FR-24)
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
