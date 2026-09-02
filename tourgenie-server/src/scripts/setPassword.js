// npm run set-password -- someone@example.com "NewPassw0rd"
//
// The way back in when a password is lost and email isn't configured, so the
// reset code has nowhere to go. Requires database credentials to run, which
// is the right bar for something that overwrites a password without knowing
// the old one.
//
// Any outstanding reset code is voided, the same as changing a password from
// the settings page does.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import AuditLog from "../models/AuditLog.js";

const MIN_LENGTH = 6;
const email = String(process.argv[2] || "").toLowerCase().trim();
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: npm run set-password -- someone@example.com "NewPassw0rd"');
  process.exit(1);
}
if (password.length < MIN_LENGTH) {
  console.error(`Password must be at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const user = await User.findOne({ email });
if (!user) {
  console.error(`No account with the email ${email}.`);
  await mongoose.disconnect();
  process.exit(1);
}

user.password_hash = await bcrypt.hash(password, 10);
user.is_active = true;
await user.save();

await PasswordReset.updateMany({ user_id: user._id, consumed_at: null }, { $set: { expires_at: new Date() } });

// A password reset from outside the app is exactly the kind of thing the
// trail exists for.
await AuditLog.create({
  actor_id: user._id,
  actor_email: "cli:set-password",
  actor_role: "system",
  action: "user.password_reset",
  entity_type: "User",
  entity_id: user._id,
  entity_label: user.email,
  reason: "Reset from the command line",
});

console.log(`Password updated for ${user.email} (role: ${user.role}).`);
await mongoose.disconnect();
