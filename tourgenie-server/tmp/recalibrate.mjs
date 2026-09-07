import "dotenv/config";
import mongoose from "mongoose";
import Destination from "../src/models/Destination.js";
import CostBenchmark from "../src/models/CostBenchmark.js";
import { destinations as bdDestinations } from "../src/seed/data/destinations.js";
import { countryPacks } from "../src/seed/data/countries/index.js";
import { buildCostBenchmarks } from "../src/seed/data/reference.js";

const DRY = process.argv.includes("--dry");
await mongoose.connect(process.env.MONGODB_URI);

// Rebuild the slug → new daily cost map straight from the seed files, so the
// database and a future re-seed can't drift apart.
const seeded = new Map();
for (const d of bdDestinations) seeded.set(d.slug, d.avg_daily_cost);
for (const pack of countryPacks) for (const d of pack.destinations || []) seeded.set(d.slug, d.avg_daily_cost);

const live = await Destination.find({}).select("slug name type avg_daily_cost").lean();
let changed = 0, missing = [];

for (const d of live) {
  const next = seeded.get(d.slug);
  if (next == null) { missing.push(d.slug); continue; }
  if (next === d.avg_daily_cost) continue;
  console.log(`  ${d.name.padEnd(24)} ${String(d.avg_daily_cost).padStart(5)} -> ${String(next).padStart(5)}`);
  changed++;
  if (!DRY) await Destination.updateOne({ _id: d._id }, { $set: { avg_daily_cost: next } });
}
console.log(`\ndestinations updated: ${changed}${DRY ? " (dry run)" : ""}`);
if (missing.length) console.log("no seed entry (left alone):", missing.join(", "));

// Benchmarks are derived, never hand-edited, so regenerating them is safe.
if (!DRY) {
  const fresh = await Destination.find({}).lean();
  const rows = fresh.flatMap((d) =>
    buildCostBenchmarks(d).map(({ destination_slug, ...b }) => ({ ...b, destination_id: d._id }))
  );
  const before = await CostBenchmark.countDocuments();
  await CostBenchmark.deleteMany({});
  await CostBenchmark.insertMany(rows);
  console.log(`costbenchmarks rebuilt: ${before} -> ${rows.length}`);
}
await mongoose.disconnect();
