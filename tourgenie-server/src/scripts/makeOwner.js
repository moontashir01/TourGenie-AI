// npm run make-owner -- someone@example.com
//
// The bootstrap, and the way back in. Granting staff roles is owner-only in
// the portal, so the first owner cannot be created from inside the app — and
// if the last owner is ever lost, this is the recovery path. Requiring
// database credentials to run it is the right bar for that.
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

const email = String(process.argv[2] || "").toLowerCase().trim();

if (!email) {
  console.error("Usage: npm run make-owner -- someone@example.com");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const user = await User.findOne({ email });
if (!user) {
  console.error(`No account with the email ${email}. They need to register first.`);
  await mongoose.disconnect();
  process.exit(1);
}

const was = user.role;
user.role = "owner";
user.is_active = true;
await user.save();

// Recorded like any other role change, with the script named as the actor.
await AuditLog.create({
  actor_id: user._id,
  actor_email: "cli:make-owner",
  actor_role: "system",
  action: "user.role_change",
  entity_type: "User",
  entity_id: user._id,
  entity_label: user.email,
  before: { role: was },
  after: { role: "owner" },
  reason: "Bootstrapped from the command line",
});

console.log(`${user.email}: ${was} -> owner`);
await mongoose.disconnect();
