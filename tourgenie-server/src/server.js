import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import itineraryRoutes from "./routes/itineraryRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import attractionRoutes from "./routes/attractionRoutes.js";
import hotelRoutes from "./routes/hotelRoutes.js";
import transportRoutes from "./routes/transportRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import flightRoutes from "./routes/flightRoutes.js";
import destinationRoutes from "./routes/destinationRoutes.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "TourGenie AI API" }));

app.use("/api/auth", authRoutes);
app.use("/api/destinations", destinationRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api", itineraryRoutes); // exposes /api/trips/:tripId/itinerary
app.use("/api/bookings", bookingRoutes);
app.use("/api", expenseRoutes); // exposes /api/trips/:tripId/expenses & /budget
app.use("/api/attractions", attractionRoutes);
app.use("/api/hotels", hotelRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/community-posts", communityRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/flights", flightRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`TourGenie AI API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
