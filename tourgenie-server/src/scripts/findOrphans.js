// npm run db:orphans          — report what is stranded
// npm run db:orphans -- --fix — delete it
//
// The clean-up for content whose owner is already gone. Deleting a user used
// to remove only their login record, and re-seeding replaces the demo users
// with new ids, so both leave documents pointing at accounts that no longer
// exist: invisible in the app, unreachable by anyone, and still counted in
// every admin total.
//
// `services/accountDeletion.js` stops new orphans being made. This clears the
// ones already there, and reports before it touches anything.
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Booking from "../models/Booking.js";
import HotelBooking from "../models/HotelBooking.js";
import Expense from "../models/Expense.js";
import Document from "../models/Document.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import Notification from "../models/Notification.js";
import ChatSession from "../models/ChatSession.js";
import PackingList from "../models/PackingList.js";

const fix = process.argv.includes("--fix");

await mongoose.connect(process.env.MONGODB_URI);

const userIds = new Set((await User.find().select("_id").lean()).map((u) => String(u._id)));
const liveTripIds = new Set();

// Owned directly by a user.
const ownedByUser = [
  ["trips", Trip],
  ["documents", Document],
  ["posts", CommunityPost],
  ["reviews", Review],
  ["notifications", Notification],
  ["chat sessions", ChatSession],
];

const report = [];

for (const [label, Model] of ownedByUser) {
  const rows = await Model.find().select("_id user_id").lean();
  const orphans = rows.filter((r) => !r.user_id || !userIds.has(String(r.user_id)));
  if (label === "trips") {
    for (const row of rows) if (!orphans.some((o) => String(o._id) === String(row._id))) liveTripIds.add(String(row._id));
  }
  report.push({ label, total: rows.length, orphans, Model });
}

// Owned through a trip — checked against the trips that survive above, so a
// run cleans a whole chain in one pass.
const ownedByTrip = [
  ["itinerary items", ItineraryItem],
  ["bookings", Booking],
  ["hotel bookings", HotelBooking],
  ["expenses", Expense],
  ["packing lists", PackingList],
];

for (const [label, Model] of ownedByTrip) {
  const rows = await Model.find().select("_id trip_id").lean();
  const orphans = rows.filter((r) => !r.trip_id || !liveTripIds.has(String(r.trip_id)));
  report.push({ label, total: rows.length, orphans, Model });
}

let stranded = 0;
console.log(fix ? "Removing orphaned documents:" : "Orphaned documents (nothing deleted — pass --fix to remove):");
for (const { label, total, orphans, Model } of report) {
  stranded += orphans.length;
  if (orphans.length === 0) {
    console.log(`  ${label.padEnd(16)} ${String(total).padStart(5)} total, none stranded`);
    continue;
  }
  console.log(`  ${label.padEnd(16)} ${String(total).padStart(5)} total, ${orphans.length} stranded`);
  if (fix) {
    const result = await Model.deleteMany({ _id: { $in: orphans.map((o) => o._id) } });
    console.log(`  ${" ".repeat(16)} removed ${result.deletedCount}`);
  }
}

console.log(fix ? `Done — ${stranded} documents removed.` : `Total: ${stranded}. Re-run with --fix to delete them.`);
await mongoose.disconnect();
