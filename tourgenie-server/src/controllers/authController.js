import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Country from "../models/Country.js";
import PasswordReset, {
  OTP_TTL_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  MAX_SENDS_PER_WINDOW,
  SEND_WINDOW_SECONDS,
  MAX_VERIFY_ATTEMPTS,
} from "../models/PasswordReset.js";
import Translation from "../models/Translation.js";
import { sendMail, passwordResetEmail } from "../services/mailer.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loadRates, normalizeCode } from "../utils/currency.js";

// Login, /me and the settings save all describe the account the same way.
// They used to each pick their own subset, which is why the Plan Trip form's
// `user.preferences` pre-fill never fired: nothing ever sent `preferences`.
function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    language: user.language,
    country: user.country,
    country_code: user.country_code,
    phone: user.phone,
    city: user.city,
    avatar_url: user.avatar_url,
    date_of_birth: user.date_of_birth,
    email_verified: user.email_verified,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
    preferences: user.preferences,
    // Kept alongside preferences.currency because callers written before the
    // full object was returned still read it.
    currency: user.preferences?.currency,
  };
}

const MIN_PASSWORD_LENGTH = 6;

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

  // Recorded here or nowhere — the field existed from the start and nothing
  // ever wrote it, so "last seen" was unanswerable.
  user.last_login_at = new Date();
  await user.save();

  const token = generateToken(user._id);
  res.json({ token, user: publicUser(user) });
});

// Returns the logged-in user's own profile
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// FR-02 (password recovery) — "forgot password" by emailed one-time code.
//
// Three steps, so the code is only ever typed once:
//   1. POST /auth/forgot-password  → mails a 6-digit code (also the resend)
//   2. POST /auth/verify-otp       → trades a correct code for a reset token
//   3. POST /auth/reset-password   → sets the new password with that token
//
// Whether an account exists is never revealed: step 1 answers the same way
// either way, and the cooldown/rate limits are keyed on the typed address so
// their timing doesn't give the answer away either.

const RESET_TOKEN_TTL_SECONDS = 10 * 60;
const OTP_MINUTES = Math.round(OTP_TTL_SECONDS / 60);

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ message: "Email is required" });

  const now = Date.now();

  // Resend cooldown — one code per address per 30 seconds.
  const last = await PasswordReset.findOne({ email }).sort({ created_at: -1 });
  if (last) {
    const elapsed = (now - last.created_at.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      return res.status(429).json({
        message: `A code was just sent. Please wait ${wait}s before asking for another.`,
        retry_after: wait,
      });
    }
  }

  // And a ceiling on how many can be asked for in a quarter of an hour.
  const windowStart = new Date(now - SEND_WINDOW_SECONDS * 1000);
  const sends = await PasswordReset.countDocuments({ email, created_at: { $gte: windowStart } });
  if (sends >= MAX_SENDS_PER_WINDOW) {
    return res.status(429).json({
      message: "Too many reset codes requested for this email. Please try again in 15 minutes.",
      retry_after: SEND_WINDOW_SECONDS,
    });
  }

  const payload = {
    message: "If an account exists for that email, a 6-digit code is on its way. Check your inbox.",
    expires_in: OTP_TTL_SECONDS,
    resend_after: RESEND_COOLDOWN_SECONDS,
  };

  const user = await User.findOne({ email });
  if (!user || !user.is_active) return res.json(payload);

  // Any earlier code for this account stops working the moment a new one is
  // issued, so only the newest email in the inbox is the live one.
  await PasswordReset.updateMany(
    { user_id: user._id, consumed_at: null, expires_at: { $gt: new Date() } },
    { $set: { expires_at: new Date() } }
  );

  const otp = generateOtp();
  const reset = await PasswordReset.create({
    user_id: user._id,
    email,
    otp_hash: await bcrypt.hash(otp, 10),
    expires_at: new Date(now + OTP_TTL_SECONDS * 1000),
    ip: req.ip || "",
  });

  const { subject, text, html } = passwordResetEmail({ name: user.name, otp, minutes: OTP_MINUTES });
  const delivery = await sendMail({ to: user.email, subject, text, html });

  if (!delivery.delivered && delivery.reason === "send_failed") {
    // The row would otherwise sit there burning the visitor's send quota for a
    // code they never received.
    await PasswordReset.deleteOne({ _id: reset._id });
    return res.status(502).json({ message: "We couldn't send the email just now. Please try again in a moment." });
  }

  // With no mailbox wired up the code has nowhere to go, so hand it back in
  // development to keep the flow testable. Never in production.
  if (!delivery.delivered && process.env.NODE_ENV !== "production") {
    payload.dev_otp = otp;
    payload.message = "Email isn't configured on this server — use the code shown below (development only).";
  }

  res.json(payload);
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const otp = String(req.body.otp || "").trim();

  if (!email || !otp) return res.status(400).json({ message: "Email and code are required" });

  const reset = await PasswordReset.findOne({ email, consumed_at: null })
    .sort({ created_at: -1 })
    .select("+otp_hash");

  if (!reset) {
    return res.status(400).json({ message: "That code isn't valid. Request a new one." });
  }
  if (reset.expires_at.getTime() <= Date.now()) {
    return res.status(400).json({ message: "That code has expired. Request a new one.", expired: true });
  }
  if (reset.attempts >= MAX_VERIFY_ATTEMPTS) {
    return res.status(429).json({ message: "Too many incorrect attempts. Request a new code.", expired: true });
  }

  const match = await bcrypt.compare(otp, reset.otp_hash);
  if (!match) {
    reset.attempts += 1;
    await reset.save();
    const left = MAX_VERIFY_ATTEMPTS - reset.attempts;
    return res.status(400).json({
      message:
        left > 0
          ? `That code is incorrect — ${left} attempt${left === 1 ? "" : "s"} left.`
          : "That code is incorrect. Request a new one.",
      attempts_left: Math.max(left, 0),
      expired: left <= 0,
    });
  }

  reset.verified_at = new Date();
  await reset.save();

  // Short-lived and single-purpose: it only unlocks step 3, and `protect`
  // rejects it because it carries no `id` claim.
  const reset_token = jwt.sign({ rid: reset._id.toString(), purpose: "password_reset" }, process.env.JWT_SECRET, {
    expiresIn: RESET_TOKEN_TTL_SECONDS,
  });

  res.json({ message: "Code verified — choose a new password.", reset_token, expires_in: RESET_TOKEN_TTL_SECONDS });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { reset_token, password } = req.body;
  if (!reset_token || !password) {
    return res.status(400).json({ message: "Reset token and new password are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  let decoded;
  try {
    decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "This reset session has expired. Start again." });
  }
  if (decoded.purpose !== "password_reset" || !decoded.rid) {
    return res.status(401).json({ message: "This reset session isn't valid. Start again." });
  }

  const reset = await PasswordReset.findById(decoded.rid);
  if (!reset || !reset.verified_at || reset.consumed_at) {
    return res.status(401).json({ message: "This reset session has already been used. Start again." });
  }

  const user = await User.findById(reset.user_id);
  if (!user || !user.is_active) {
    return res.status(404).json({ message: "Account not found" });
  }

  user.password_hash = await bcrypt.hash(password, 10);
  await user.save();

  reset.consumed_at = new Date();
  await reset.save();
  // Anything else outstanding for this account dies with it.
  await PasswordReset.updateMany(
    { user_id: user._id, _id: { $ne: reset._id }, consumed_at: null },
    { $set: { expires_at: new Date() } }
  );

  res.json({ message: "Password updated — you can now log in." });
});

// ── Account settings ─────────────────────────────────────────────────
//
// The profile and preference fields have been on the User model since the
// start, and until now nothing could edit them: a traveller's currency,
// travel style and saved interests could only be changed with a database
// write, even though the Plan Trip form reads all three to pre-fill itself.

const BUDGET_TIERS = ["budget", "mid", "luxury"];
const THEMES = ["light", "dark", "system"];
const MAX_INTERESTS = 20;

function trimmed(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

/**
 * Only the fields the client sent are touched. A missing key means "leave
 * it alone", which is what lets the page save one section at a time without
 * blanking the others.
 */
function has(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: "Account not found" });

  const body = req.body || {};

  if (has(body, "name")) {
    const name = trimmed(body.name, 80);
    if (!name) return res.status(400).json({ message: "Name can't be empty" });
    user.name = name;
  }
  if (has(body, "phone")) user.phone = trimmed(body.phone, 32);
  if (has(body, "city")) user.city = trimmed(body.city, 80);
  if (has(body, "avatar_url")) user.avatar_url = trimmed(body.avatar_url, 500) || null;

  if (has(body, "date_of_birth")) {
    if (!body.date_of_birth) {
      user.date_of_birth = null;
    } else {
      const dob = new Date(body.date_of_birth);
      if (Number.isNaN(dob.getTime())) {
        return res.status(400).json({ message: "That date of birth isn't a valid date" });
      }
      if (dob.getTime() > Date.now()) {
        return res.status(400).json({ message: "Date of birth can't be in the future" });
      }
      user.date_of_birth = dob;
    }
  }

  if (has(body, "language")) {
    const lang = trimmed(body.language, 8).toLowerCase();
    const known = await Translation.exists({ lang, is_active: true });
    if (!known) return res.status(400).json({ message: `Unsupported language: ${lang}` });
    user.language = lang;
  }

  if (has(body, "country_code")) {
    const code = trimmed(body.country_code, 2).toUpperCase();
    const country = await Country.findOne({ code, is_core: true, is_active: true });
    if (!country) return res.status(400).json({ message: "Please choose a supported country" });
    user.country = country.name;
    user.country_code = country.code;
  }

  const prefs = body.preferences;
  if (prefs && typeof prefs === "object") {
    if (has(prefs, "currency")) {
      const code = normalizeCode(prefs.currency);
      const rates = await loadRates();
      if (!rates[code]) return res.status(400).json({ message: `Unsupported currency: ${code}` });
      user.preferences.currency = code;
    }
    if (has(prefs, "default_budget_tier")) {
      const tier = trimmed(prefs.default_budget_tier, 10).toLowerCase();
      if (!BUDGET_TIERS.includes(tier)) {
        return res.status(400).json({ message: `Travel style must be one of: ${BUDGET_TIERS.join(", ")}` });
      }
      user.preferences.default_budget_tier = tier;
    }
    if (has(prefs, "interests")) {
      if (!Array.isArray(prefs.interests)) {
        return res.status(400).json({ message: "Interests must be a list" });
      }
      // Deduplicated and capped — this list is pasted into the AI planner's
      // prompt, so it can't be an unbounded free-text field.
      const cleaned = [...new Set(prefs.interests.map((i) => trimmed(i, 40)).filter(Boolean))];
      if (cleaned.length > MAX_INTERESTS) {
        return res.status(400).json({ message: `Pick at most ${MAX_INTERESTS} interests` });
      }
      user.preferences.interests = cleaned;
    }
    for (const key of ["notify_departure", "notify_weather", "notify_budget"]) {
      if (has(prefs, key)) user.preferences[key] = Boolean(prefs[key]);
    }
    if (has(prefs, "theme")) {
      const theme = trimmed(prefs.theme, 10).toLowerCase();
      if (!THEMES.includes(theme)) {
        return res.status(400).json({ message: `Theme must be one of: ${THEMES.join(", ")}` });
      }
      user.preferences.theme = theme;
    }
  }

  await user.save();
  res.json({ message: "Settings saved", user: publicUser(user) });
});

// Changing a password while logged in — the reset-by-email flow is for
// people who can't. The current password is required so a walk-up on an
// unlocked laptop can't lock the owner out of their own account.
export const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ message: "Current and new password are both required" });
  }
  if (String(new_password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const user = await User.findById(req.user._id).select("+password_hash");
  if (!user) return res.status(404).json({ message: "Account not found" });

  const match = await bcrypt.compare(current_password, user.password_hash);
  if (!match) return res.status(401).json({ message: "That isn't your current password" });

  if (await bcrypt.compare(new_password, user.password_hash)) {
    return res.status(400).json({ message: "The new password is the same as the current one" });
  }

  user.password_hash = await bcrypt.hash(new_password, 10);
  await user.save();

  // Any outstanding reset code is void — the password it was issued for is
  // gone.
  await PasswordReset.updateMany(
    { user_id: user._id, consumed_at: null },
    { $set: { expires_at: new Date() } }
  );

  res.json({ message: "Password changed." });
});
