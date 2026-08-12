import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import Destination from "./src/models/Destination.js";
import Trip from "./src/models/Trip.js";
import FlightOption from "./src/models/FlightOption.js";
import TransportOption from "./src/models/TransportOption.js";
import ItineraryItem from "./src/models/ItineraryItem.js";
import { generateItineraryWithAI } from "./src/services/aiPlanner.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const trip = await Trip.findOne({}).populate("destination_id");
  if (!trip) return console.log("No trip found");
  
  console.log("Found trip:", trip.origin, "to", trip.destination);
  
  try {
    const items = await generateItineraryWithAI(trip, []);
    console.log("AI items count:", items.length);
    console.log("All categories:", [...new Set(items.map(i => i.category))]);
    const travelItems = items.filter(i => i.category === 'travel');
    console.log("Travel items found:", travelItems.length);
    if (travelItems.length > 0) {
      console.log(travelItems[0]);
    }
  } catch (e) {
    console.error("AI failed", e.message);
  }
  process.exit();
}
run();
