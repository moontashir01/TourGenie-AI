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
  const items = await generateItineraryWithAI(trip, []);
  
  for (const item of items) {
    if (item.category === "travel") {
      let fromCity = trip.origin;
      let toCity = trip.destination;
      if (trip.duration_days && item.day === trip.duration_days) {
        fromCity = trip.destination;
        toCity = trip.origin;
      }
      console.log(`Searching for flights from ${fromCity} to ${toCity}`);
      const flights = await FlightOption.find({
        from_city: new RegExp(`^${fromCity}$`, "i"),
        to_city: new RegExp(`^${toCity}$`, "i"),
        is_active: true,
      }).lean();
      
      const transports = await TransportOption.find({
        from_city: new RegExp(`^${fromCity}$`, "i"),
        to_city: new RegExp(`^${toCity}$`, "i"),
        is_active: true,
      }).lean();
      console.log(`Found ${flights.length} flights and ${transports.length} transports.`);
      
      item.available_transport_options = [
        ...flights.map(f => ({ ...f, option_type: "flight", estimated_cost: f.total_fare_bdt })),
        ...transports.map(t => ({ ...t, option_type: "transport", estimated_cost: t.fare }))
      ];
    }
  }
  
  console.log("Saving items...");
  try {
    await ItineraryItem.deleteMany({ trip_id: trip._id });
    const created = await ItineraryItem.insertMany(
      items.map((i) => ({
        trip_id: trip._id,
        day: i.day,
        time: i.time,
        activity: i.activity,
        location: i.location,
        est_cost: i.est_cost || 0,
        category: i.category || "activity",
        attraction_id: i.attraction_id || null,
        available_transport_options: i.available_transport_options || [],
      }))
    );
    console.log("Created successfully. First travel item:");
    const createdTravel = created.find(c => c.category === 'travel');
    console.log("Options count in DB:", createdTravel.available_transport_options.length);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
run();
