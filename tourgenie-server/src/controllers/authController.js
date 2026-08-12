import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Country from "../models/Country.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-01 — User Registration
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, language, country_code = "BD" } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const country = await Country.findOne({ code: String(country_code).toUpperCase(), is_core: true, is_active: true });
  if (!country) return res.status(400).json({ message: "Please choose a supported country" });
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password_hash,
    language: language || "en",
    country: country.name,
    country_code: country.code,
    preferences: { currency: country.pricing_currency },
  });

  res.status(201).json({
    message: "Account created — you can now log in",
    user: { id: user._id, name: user.name, email: user.email, country: user.country, country_code: user.country_code },
  });
});

// FR-02 — Login & Authentication
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password_hash");
  if (!user || !user.is_active) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = generateToken(user._id);
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      language: user.language,
      country: user.country,
      country_code: user.country_code,
      currency: user.preferences.currency,
    },
  });
});

// Returns the logged-in user's own profile
export const getMe = asyncHandler(async (req, res) => {
  const { _id, name, email, role, language, country, country_code, preferences } = req.user;
  res.json({ user: { id: _id, name, email, role, language, country, country_code, currency: preferences.currency } });
});
