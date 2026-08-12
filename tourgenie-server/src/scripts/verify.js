// npm run db:verify
//
// Runs one representative query per functional requirement, using the exact
// shape the corresponding API route should use. If every check passes, the
// database can answer that feature without an external call.

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

import Destination from "../models/Destination.js";
import Country from "../models/Country.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import TransportOption from "../models/TransportOption.js";
import FlightOption from "../models/FlightOption.js";
import Airport from "../models/Airport.js";
import Route from "../models/Route.js";
import NearbyService from "../models/NearbyService.js";
import WeatherForecast from "../models/WeatherForecast.js";
import ClimateNormal from "../models/ClimateNormal.js";
import CostBenchmark from "../models/CostBenchmark.js";
import CarbonFactor from "../models/CarbonFactor.js";
import ItineraryTemplate from "../models/ItineraryTemplate.js";
import PackingTemplate from "../models/PackingTemplate.js";
import ChatIntent from "../models/ChatIntent.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import Translation from "../models/Translation.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import InterestTag from "../models/InterestTag.js";
import ExchangeRate from "../models/ExchangeRate.js";
import AppSetting from "../models/AppSetting.js";
import AnalyticsSnapshot from "../models/AnalyticsSnapshot.js";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";

const results = [];
function check(fr, label, ok, detail) {
  results.push({ fr, label, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"}  ${fr.padEnd(7)} ${label.padEnd(38)} ${detail}`);
}

async function run() {
  await connectDB();
  console.log(`\nVerifying "${mongoose.connection.db.databaseName}" — one query per functional requirement\n`);

  // ── FR-03: destination search ──
  const searchHits = await Destination.find(
    { $text: { $search: "beach coral island" }, is_active: true },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } }).limit(5).lean();
  check("FR-03", "Destination text search", searchHits.length > 0,
    searchHits.map((d) => d.name).join(", ") || "no hits");

  const interests = await InterestTag.countDocuments({ is_active: true });
  check("FR-03", "Interest chips for the plan form", interests > 0, `${interests} tags`);

  // ── Five-country catalogue coverage ──
  const coreCountries = await Country.find({ is_core: true, is_active: true }).sort({ code: 1 }).lean();
  check("—", "Five core country profiles", coreCountries.length === 5,
    coreCountries.map((country) => country.code).join(", "));

  const expandedCoverage = await Destination.aggregate([
    { $match: { country_code: { $in: ["TH", "MY", "IN", "NP"] }, is_active: true } },
    { $lookup: { from: "attractions", localField: "_id", foreignField: "destination_id", as: "attractions" } },
    { $lookup: { from: "hotels", localField: "_id", foreignField: "destination_id", as: "hotels" } },
    { $lookup: { from: "itinerarytemplates", localField: "_id", foreignField: "destination_id", as: "templates" } },
    { $lookup: { from: "climatenormals", localField: "_id", foreignField: "destination_id", as: "climate" } },
    {
      $project: {
        name: 1,
        country_code: 1,
        attractions: { $size: "$attractions" },
        hotels: { $size: "$hotels" },
        templates: { $size: "$templates" },
        climate: { $size: "$climate" },
      },
    },
  ]);
  const completeExpandedCoverage = expandedCoverage.every(
    (destination) => destination.attractions >= 4 && destination.hotels >= 2 && destination.templates >= 1 && destination.climate === 12,
  );
  check("—", "Expanded-country destination coverage",
    expandedCoverage.length === 20 && completeExpandedCoverage,
    `${expandedCoverage.length}/20 destinations meet attraction/hotel/template/climate requirements`);

  // ── FR-04: itinerary template lookup ──
  const cox = await Destination.findOne({ slug: "coxs-bazar" }).lean();
  const templates = await ItineraryTemplate.find({ destination_id: cox._id, is_active: true }).lean();
  const totalPlannedDays = templates.reduce((n, t) => n + t.days.length, 0);
  check("FR-04", "Itinerary templates for Cox's Bazar", templates.length > 0,
    `${templates.length} templates, ${totalPlannedDays} planned days`);

  // ── FR-05: chat intents ──
  const quickActions = await ChatIntent.find({ is_quick_action: true, is_active: true })
    .sort({ quick_action_order: 1 }).lean();
  check("FR-05", "Chat quick actions", quickActions.length === 4,
    quickActions.map((i) => `"${i.quick_action_label}"`).join(", "));

  // ── FR-06: route with polyline ──
  const route = await Route.findOne({
    "from.name": "Dhaka", "to.name": "Cox's Bazar", is_default: true,
  }).lean();
  check("FR-06", "Dhaka → Cox's Bazar default route", Boolean(route),
    route ? `${route.distance_km} km, ${route.duration_min} min, ${route.geometry.coordinates.length} polyline points, ${route.legs.length} legs` : "missing");

  const routeVariants = await Route.countDocuments({ "from.name": "Dhaka", "to.name": "Cox's Bazar" });
  check("FR-06", "Alternative route variants", routeVariants > 1, `${routeVariants} variants`);

  // ── FR-07: hotels ranked by price and rating ──
  const coxHotels = await Hotel.find({ destination_id: cox._id }).sort({ rating: -1 }).limit(3).lean();
  check("FR-07", "Hotels ranked for a destination", coxHotels.length > 0,
    coxHotels.map((h) => `${h.name} ৳${h.price_per_night}`).join(" | "));

  // Geo-ranked: hotels nearest the beach.
  const nearBeach = await Hotel.find({
    location: { $near: { $geometry: { type: "Point", coordinates: [91.9764, 21.4272] }, $maxDistance: 5000 } },
  }).limit(3).lean();
  check("FR-07", "Hotels by proximity ($near)", nearBeach.length > 0,
    `${nearBeach.length} within 5 km of Laboni Beach`);

  // ── FR-08: transport for a city pair ──
  const services = await TransportOption.find({
    from_city: "Dhaka", to_city: "Cox's Bazar", is_active: true,
  }).sort({ depart_time: 1 }).lean();
  check("FR-08", "Transport options for a city pair", services.length > 0,
    `${services.length} services (${[...new Set(services.map((s) => s.mode))].join(", ")})`);

  // ── Flights (previously a live API call) ──
  const originAirport = await Airport.findOne({ city: "Dhaka" }).lean();
  const flights = await FlightOption.find({
    from_iata: originAirport.iata, to_iata: "DXB", is_active: true,
  }).sort({ total_fare_bdt: 1 }).lean();
  check("—", "Flight schedules DAC → DXB", flights.length > 0,
    flights.map((f) => `${f.flight_number} ৳${f.total_fare_bdt}`).join(", "));

  // ── FR-09: cost benchmark ──
  const benchmark = await CostBenchmark.findOne({ destination_id: cox._id, tier: "mid" }).lean();
  const perDay = benchmark
    ? Object.values(benchmark.per_person_per_day).reduce((a, b) => a + b, 0)
    : 0;
  check("FR-09", "Cost benchmark (Cox's Bazar, mid)", Boolean(benchmark),
    `৳${perDay}/person/day across ${Object.keys(benchmark?.per_person_per_day || {}).length} categories`);

  const categories = await ExpenseCategory.find().sort({ sort_order: 1 }).lean();
  const shareSum = categories.reduce((n, c) => n + c.default_budget_share, 0);
  check("FR-09", "Expense categories and colours", Math.abs(shareSum - 1) < 0.001,
    `${categories.length} categories, shares sum to ${shareSum.toFixed(2)}`);

  // ── FR-11: weather for a date range ──
  const from = new Date(); from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 6 * 86400000);
  const forecast = await WeatherForecast.find({
    destination_id: cox._id, date: { $gte: from, $lte: to },
  }).sort({ date: 1 }).lean();
  check("FR-11", "7-day forecast for a destination", forecast.length === 7,
    forecast.map((f) => `${Math.round(f.temp_max_c)}°/${f.condition}`).join(" "));

  const withAlerts = await WeatherForecast.countDocuments({ "alerts.0": { $exists: true } });
  check("FR-11", "Forecast days carrying alerts", withAlerts > 0, `${withAlerts} days across all destinations`);

  const normals = await ClimateNormal.countDocuments({ destination_id: cox._id });
  check("FR-11", "Monthly climate normals (fallback)", normals === 12, `${normals} months`);

  // ── FR-12: attractions ──
  const attractions = await Attraction.find({ destination_id: cox._id, is_active: true })
    .sort({ popularity: -1 }).lean();
  check("FR-12", "Attractions for a destination", attractions.length > 0,
    `${attractions.length} — top: ${attractions[0]?.name}`);

  const rated = await Attraction.countDocuments({ review_count: { $gt: 0 } });
  check("FR-12", "Attractions with rolled-up ratings", rated > 0, `${rated} attractions`);

  // ── FR-13: nearby services via geo ──
  const nearby = await NearbyService.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [91.9789, 21.4238] },
        distanceField: "distance_m",
        maxDistance: 5000,
        spherical: true,
        query: { is_active: true },
      },
    },
    { $limit: 6 },
    { $project: { name: 1, category: 1, distance_m: { $round: ["$distance_m", 0] } } },
  ]);
  check("FR-13", "Nearby services ($geoNear)", nearby.length > 0,
    nearby.slice(0, 3).map((n) => `${n.name} (${n.distance_m}m)`).join(", "));

  const byCategory = await NearbyService.distinct("category");
  check("FR-13", "Service categories covered", byCategory.length >= 8, byCategory.join(", "));

  // ── FR-15: packing rules ──
  const alwaysOn = await PackingTemplate.countDocuments({ always_include: true, is_active: true });
  const conditional = await PackingTemplate.countDocuments({ always_include: false, is_active: true });
  check("FR-15", "Packing templates", alwaysOn > 0 && conditional > 0,
    `${alwaysOn} baseline + ${conditional} conditional`);

  // ── FR-16: carbon factors ──
  const factors = await CarbonFactor.find().sort({ grams_co2_per_passenger_km: 1 }).lean();
  const train = factors.find((f) => f.mode === "train");
  const flight = factors.find((f) => f.mode === "flight_domestic");
  check("FR-16", "Carbon factors, train vs flight", Boolean(train && flight),
    `train ${train?.grams_co2_per_passenger_km} g/pkm vs domestic flight ${flight?.grams_co2_per_passenger_km} g/pkm`);

  const tripsWithCarbon = await Trip.countDocuments({ "carbon.total_kg": { $gt: 0 } });
  check("FR-16", "Trips carrying a carbon estimate", tripsWithCarbon > 0, `${tripsWithCarbon} trips`);

  // ── FR-17: translations ──
  const langs = await Translation.find({ is_active: true }).lean();
  const enKeys = langs.find((l) => l.lang === "en");
  const nsCount = Object.keys(enKeys?.strings || {}).length;
  const complete = langs.every(
    (l) => Object.keys(l.strings).length === nsCount
  );
  check("FR-17", "Languages with matching key sets", langs.length === 5 && complete,
    langs.map((l) => l.native_label).join(", "));

  // ── FR-18: notification templates ──
  const notifTemplates = await NotificationTemplate.countDocuments({ is_active: true });
  const events = await NotificationTemplate.distinct("trigger.event");
  check("FR-18", "Notification rules", notifTemplates > 0,
    `${notifTemplates} templates across ${events.length} trigger events`);

  // ── FR-24: analytics ──
  const monthly = await AnalyticsSnapshot.find({ period: "month" }).sort({ date: 1 }).lean();
  check("FR-24", "Monthly analytics roll-up", monthly.length > 0,
    monthly.map((m) => `${m.period_key}:${m.metrics.trips_created}`).join(" "));

  const latest = await AnalyticsSnapshot.findOne({ period: "day" }).sort({ date: -1 }).lean();
  check("FR-24", "Latest daily snapshot", Boolean(latest),
    latest ? `${latest.metrics.users_total} users, ${latest.metrics.trips_total} trips, top: ${latest.top_destinations[0]?.city}` : "missing");

  // ── Data integrity ──
  const orphanAttractions = await Attraction.countDocuments({ destination_id: null });
  check("—", "Attractions linked to a destination", orphanAttractions === 0,
    orphanAttractions === 0 ? "all linked" : `${orphanAttractions} orphaned`);

  const orphanHotels = await Hotel.countDocuments({ destination_id: null });
  check("—", "Hotels linked to a destination", orphanHotels === 0,
    orphanHotels === 0 ? "all linked" : `${orphanHotels} orphaned`);

  const geoAttractions = await Attraction.countDocuments({ "location.coordinates.0": { $exists: true } });
  const totalAttractions = await Attraction.countDocuments();
  check("—", "Attractions with GeoJSON point", geoAttractions === totalAttractions,
    `${geoAttractions}/${totalAttractions}`);

  const plannedTrips = await Trip.countDocuments({ status: { $ne: "draft" } });
  const tripsWithItems = (await ItineraryItem.distinct("trip_id")).length;
  check("—", "Non-draft trips with itinerary items", tripsWithItems > 0,
    `${tripsWithItems}/${plannedTrips}`);

  const admins = await User.countDocuments({ role: "admin" });
  check("—", "Admin account present", admins > 0, `${admins} admin`);

  const settings = await AppSetting.countDocuments();
  const rates = await ExchangeRate.countDocuments();
  check("—", "Config and FX reference", settings > 0 && rates > 0,
    `${settings} settings, ${rates} currencies`);

  // ── Summary ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  ✗ ${f.fr} ${f.label} — ${f.detail}`);
  }

  // ── Collection census ──
  console.log("\nCollections:");
  const collections = await mongoose.connection.db.listCollections().toArray();
  const rows = await Promise.all(
    collections.map(async (c) => ({
      name: c.name,
      count: await mongoose.connection.db.collection(c.name).countDocuments(),
      indexes: (await mongoose.connection.db.collection(c.name).indexes()).length,
    }))
  );
  rows.sort((a, b) => b.count - a.count);
  let total = 0;
  for (const r of rows) {
    total += r.count;
    console.log(`  ${String(r.count).padStart(6)}  ${r.name.padEnd(24)} ${r.indexes} idx`);
  }
  console.log(`  ${String(total).padStart(6)}  TOTAL across ${rows.length} collections`);

  await mongoose.disconnect();
  process.exit(failed.length ? 1 : 0);
}

run().catch(async (err) => {
  console.error("Verification failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
