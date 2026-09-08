// The Express app, assembled but not listening.
//
// Split out of server.js so a test can drive the real routing, middleware and
// error handling over HTTP without the process also opening a port and a
// database connection on import. server.js is the entry point; this is what
// it serves.
import express from "express";
import cors from "cors";
import morgan from "morgan";

import { notFound, errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import itineraryRoutes from "./routes/itineraryRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import attractionRoutes from "./routes/attractionRoutes.js";
import hotelRoutes from "./routes/hotelRoutes.js";
import hotelBookingRoutes from "./routes/hotelBookingRoutes.js";
import transportRoutes from "./routes/transportRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import flightRoutes from "./routes/flightRoutes.js";
import destinationRoutes from "./routes/destinationRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import tripRouteRoutes from "./routes/tripRouteRoutes.js";
import referenceRoutes from "./routes/referenceRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import packingRoutes from "./routes/packingRoutes.js";
import nearbyRoutes from "./routes/nearbyRoutes.js";

const app = express();

// The sign-in limiter counts failures per address, so `req.ip` has to be the
// visitor's and not the proxy's. Opt-in, because trusting a forwarded header
// that nobody is actually setting lets a caller claim any address it likes
// and walk straight past the limiter. Set TRUST_PROXY to the number of
// proxies in front of this process when deploying behind one.
//
// The value is validated rather than passed through. Express hands whatever
// it is given to proxy-addr, which parses it lazily — the first time anything
// reads `req.ip`. A typo therefore does not fail at boot with a clear message;
// it throws `invalid IP address` from inside a dependency on every request, so
// the whole API answers 500 and the stack trace never mentions the variable
// that caused it. TRUST_PROXY=a cost an afternoon of exactly that. A hop count
// or one of proxy-addr's named presets is accepted; anything else is refused
// here, loudly, and the app runs untrusting rather than not at all.
const PROXY_PRESETS = ["loopback", "linklocal", "uniquelocal"];

if (process.env.TRUST_PROXY) {
  const raw = process.env.TRUST_PROXY.trim();
  const hops = Number(raw);

  if (Number.isInteger(hops) && hops >= 0) {
    app.set("trust proxy", hops);
  } else if (PROXY_PRESETS.includes(raw)) {
    app.set("trust proxy", raw);
  } else {
    console.warn(
      `[config] Ignoring TRUST_PROXY="${raw}" — expected a hop count (e.g. 1) or one of ` +
        `${PROXY_PRESETS.join(", ")}. Proxy headers will not be trusted, so rate limiting ` +
        `will key on the proxy's address rather than the visitor's.`
    );
  }
}

// A single allowed origin meant that opening the dev client at
// http://127.0.0.1:5173 instead of http://localhost:5173 — same server, same
// port, different origin to the browser — failed the preflight and surfaced
// in the UI as a bare "Failed to fetch" on the login form. CLIENT_URL still
// names the deployed client (a comma-separated list is accepted), and outside
// production any loopback origin is allowed so the address bar can say
// localhost, 127.0.0.1 or ::1 interchangeably.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, the seeder) send no Origin.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== "production" && LOOPBACK_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "TourGenie AI API" }));

app.use("/api/auth", authRoutes);
app.use("/api/destinations", destinationRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api", itineraryRoutes); // exposes /api/trips/:tripId/itinerary
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes); // FR-08 — SSLCommerz card/wallet payments
app.use("/api", expenseRoutes); // exposes /api/trips/:tripId/expenses & /budget
app.use("/api/attractions", attractionRoutes);
app.use("/api/hotels", hotelRoutes);
app.use("/api/hotel-bookings", hotelBookingRoutes); // FR-08 for accommodation
app.use("/api/transport", transportRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/community-posts", communityRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/reports", reportRoutes); // FR-23 — travellers flagging content
app.use("/api/admin", adminRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api", tripRouteRoutes); // exposes /api/trips/:tripId/route (FR-06)
app.use("/api/reference", referenceRoutes); // currencies + expense categories
app.use("/api", weatherRoutes); // exposes /api/trips/:tripId/weather (FR-11)
app.use("/api", packingRoutes); // exposes /api/trips/:tripId/packing-list (FR-15)
app.use("/api/nearby", nearbyRoutes); // FR-13

app.use(notFound);
app.use(errorHandler);

export default app;
