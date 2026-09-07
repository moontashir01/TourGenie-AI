import "dotenv/config";
import mongoose from "mongoose";
import Destination from "../src/models/Destination.js";
import { buildTripEstimate, formatEstimateFacts } from "../src/services/tripEstimator.js";

await mongoose.connect(process.env.MONGODB_URI);
for (const [slug, days, travelers, tier] of [
  ["coxs-bazar", 3, 2, "mid"],
  ["coxs-bazar", 3, 1, "budget"],
  ["sajek-valley", 3, 4, "mid"],
]) {
  const d = await Destination.findOne({ slug }).lean();
  const e = await buildTripEstimate({ destination: d, days, travelers, tier, origin: "Dhaka", month: 11 });
  console.log(`\n===== ${d.name} · ${days}d · ${travelers}pax · ${tier} =====`);
  console.log("per_person_per_day:", JSON.stringify(e.budget.per_person_per_day));
  console.log("hotel used:", e.hotels.in_tier?.name, "@", e.hotels.in_tier?.price_per_night, "/night");
  e.budget.lines.forEach(l => console.log("   ", l.label.padEnd(14), String(l.amount).padStart(7)));
  console.log("    TOTAL".padEnd(18), String(e.budget.estimated_total).padStart(7),
              " | per person", Math.round(e.budget.estimated_total/travelers),
              " | per person/day", Math.round(e.budget.estimated_total/travelers/days));
}
await mongoose.disconnect();
