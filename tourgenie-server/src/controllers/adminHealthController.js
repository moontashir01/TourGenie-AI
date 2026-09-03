// System health — the one screen that says out loud what the app is doing
// quietly.
//
// Every external integration here is optional by design: with no keys at all
// the database answers everything and the traveller-facing UI labels the
// result as seeded. The cost of that design is that failure is invisible —
// a dead flight API, an unconfigured mailbox and a perfect deployment all
// look identical from the outside. This is where they stop looking identical.
import mongoose from "mongoose";
import AnalyticsSnapshot from "../models/AnalyticsSnapshot.js";
import AppSetting from "../models/AppSetting.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getProviderStatuses } from "../services/providerStatus.js";
import { isMailConfigured } from "../services/mailer.js";

// The reference collections the app cannot answer from if they are empty.
// This is npm run db:verify's question — "can the database answer this
// feature without an external call" — asked from inside the running server.
const REQUIRED_COLLECTIONS = [
  ["destinations", "Destination search (FR-03)"],
  ["countries", "Multi-country catalogue"],
  ["attractions", "Itinerary building (FR-04)"],
  ["hotels", "Hotel recommendation (FR-07)"],
  ["transportoptions", "Transport and booking (FR-06, FR-08)"],
  ["routes", "Route planning (FR-06)"],
  ["weatherforecasts", "Trip weather (FR-11)"],
  ["climatenormals", "Best time to visit"],
  ["costbenchmarks", "Budget estimation (FR-09)"],
  ["packingtemplates", "Packing lists (FR-15)"],
  ["chatintents", "Assistant answers with no AI key (FR-05)"],
  ["notificationtemplates", "Notifications (FR-18)"],
  ["translations", "Language switcher (FR-17)"],
  ["exchangerates", "Currency conversion"],
  ["appsettings", "Runtime limits"],
  ["analyticssnapshots", "Admin trends (FR-24)"],
];

const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

export const getSystemHealth = asyncHandler(async (req, res) => {
  const connection = mongoose.connection;
  const connected = connection.readyState === 1;

  let collections = [];
  let missing = [];
  if (connected) {
    const present = await connection.db.listCollections().toArray();
    const names = new Set(present.map((c) => c.name));
    collections = await Promise.all(
      present.map(async (c) => ({
        name: c.name,
        count: await connection.db.collection(c.name).countDocuments(),
      }))
    );
    collections.sort((a, b) => b.count - a.count);

    const counts = new Map(collections.map((c) => [c.name, c.count]));
    missing = REQUIRED_COLLECTIONS.filter(([name]) => !names.has(name) || !counts.get(name)).map(
      ([name, feature]) => ({ collection: name, feature })
    );
  }

  const [seedMarkers, latestSnapshot] = await Promise.all([
    AppSetting.find({ key: { $in: ["seed.last_run", "seed.version"] } }).lean(),
    AnalyticsSnapshot.findOne({ period: "day" }).sort({ date: -1 }).select("period_key computed_at").lean(),
  ]);
  const marker = Object.fromEntries(seedMarkers.map((s) => [s.key, s.value]));

  res.json({
    database: {
      state: DB_STATES[connection.readyState] || "unknown",
      name: connected ? connection.db.databaseName : "",
      host: connection.host || "",
      collections,
      total_documents: collections.reduce((sum, c) => sum + c.count, 0),
      // Empty is the only failure mode that matters here: a missing
      // reference collection turns a working feature into an empty screen.
      missing_reference_data: missing,
    },

    // configured / not configured, and what the last call did. A provider
    // with a key and no calls is not the same as one that is failing.
    providers: getProviderStatuses(),

    mail: {
      configured: isMailConfigured(),
      host: process.env.MAIL_HOST || "smtp.gmail.com",
      from: process.env.MAIL_FROM || process.env.MAIL_USER || "",
      // The reset flow silently logs the code to the server console when
      // this is off, which is fine in development and a silent failure in
      // production. It has never been visible anywhere until now.
      mode: isMailConfigured() ? "sending" : "logging codes to the server console",
      production: process.env.NODE_ENV === "production",
    },

    seed: {
      version: marker["seed.version"] || "unknown",
      last_run: marker["seed.last_run"] || null,
      latest_snapshot: latestSnapshot
        ? { period_key: latestSnapshot.period_key, computed_at: latestSnapshot.computed_at }
        : null,
    },

    server: {
      node: process.version,
      env: process.env.NODE_ENV || "development",
      uptime_seconds: Math.round(process.uptime()),
      started_at: new Date(Date.now() - process.uptime() * 1000),
    },

    generated_at: new Date(),
  });
});

export default { getSystemHealth };
