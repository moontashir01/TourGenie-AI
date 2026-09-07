import "dotenv/config";
import mongoose from "mongoose";
import Destination from "../src/models/Destination.js";
import { estimateTripBudget, verdictFor } from "../src/services/budgetEstimator.js";
await mongoose.connect(process.env.MONGODB_URI);
const ds = await Destination.find({ is_active: true }).lean();
let bad = 0;
for (const d of ds) {
  for (const [days, pax, tier] of [[2,1,"budget"],[3,2,"mid"],[5,4,"mid"],[7,2,"luxury"]]) {
    const b = await estimateTripBudget({ destinations:[d], days, travelers:pax, tier });
    if (b.minimum_total > b.estimated_total) {
      console.log(`  FLOOR>EST  ${d.name} ${days}d/${pax}pax/${tier}: min ${b.minimum_total} > est ${b.estimated_total}`);
      bad++;
    }
  }
}
console.log(bad ? `\n${bad} case(s) where the floor exceeds the estimate` : "\nOK — floor is below the estimate in every case tested");
// verdict sanity on one representative trip
const cox = ds.find(x=>x.slug==="coxs-bazar");
const b = await estimateTripBudget({ destinations:[cox], days:3, travelers:2, tier:"mid" });
console.log(`\nCox's 3d/2pax mid — est ${b.estimated_total}, floor ${b.minimum_total}`);
for (const budget of [5000, b.minimum_total+1000, b.estimated_total, b.estimated_total*2])
  console.log(`   budget ${String(Math.round(budget)).padStart(6)} -> ${verdictFor(budget, b)}`);
await mongoose.disconnect();
