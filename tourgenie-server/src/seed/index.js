// TourGenie AI — database seeder.
//
//   npm run seed              refresh reference data, keep real user accounts
//   npm run seed:fresh        drop every collection first, then reseed
//   npm run seed -- --no-demo reference data only, no demo users or trips
//   npm run seed -- --weather-days=365
//
// Order matters: destinations first, because almost everything else resolves
// a destination_slug to a destination_id.

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { connectDB } from "../config/db.js";

// ── Models ──
import Destination from "../models/Destination.js";
import Country from "../models/Country.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import TransportOption from "../models/TransportOption.js";
import Airport from "../models/Airport.js";
import FlightOption from "../models/FlightOption.js";
import Route from "../models/Route.js";
import NearbyService from "../models/NearbyService.js";
import ClimateNormal from "../models/ClimateNormal.js";
import WeatherForecast from "../models/WeatherForecast.js";
import CostBenchmark from "../models/CostBenchmark.js";
import CarbonFactor from "../models/CarbonFactor.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import InterestTag from "../models/InterestTag.js";
import ExchangeRate from "../models/ExchangeRate.js";
import AppSetting from "../models/AppSetting.js";
import PackingTemplate from "../models/PackingTemplate.js";
import PackingList from "../models/PackingList.js";
import ItineraryTemplate from "../models/ItineraryTemplate.js";
import ChatIntent from "../models/ChatIntent.js";
import ChatSession from "../models/ChatSession.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import Notification from "../models/Notification.js";
import Translation from "../models/Translation.js";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Booking from "../models/Booking.js";
import Expense from "../models/Expense.js";
import Document from "../models/Document.js";
import CommunityPost from "../models/CommunityPost.js";
import Review from "../models/Review.js";
import AuditLog from "../models/AuditLog.js";
import AnalyticsSnapshot from "../models/AnalyticsSnapshot.js";

// ── Seed data ──
import {
  destinations as destinationData,
  attractions as attractionData,
  hotels as hotelData,
  transportOptions as transportData,
  airports as airportData,
  flightOptions as flightData,
  routes as routeData,
  namedServices,
  itineraryTemplates,
} from "./data/catalog.js";
import { generateAreaServices } from "./data/nearbyServices.js";
import {
  expenseCategories, interestTags, carbonFactors, exchangeRates,
  appSettings, buildCostBenchmarks,
} from "./data/reference.js";
import { packingTemplates } from "./data/packingTemplates.js";
import { countries as countryData } from "./data/countries.js";
import { chatIntents } from "./data/chatIntents.js";
import { notificationTemplates } from "./data/notificationTemplates.js";
import { translations } from "./data/translations.js";
import * as demo from "./data/demoContent.js";
import { validateCatalog } from "./validateCatalog.js";

// ── Generators ──
import { buildClimateNormals, buildDailyForecasts } from "./generators/weather.js";
import { writeAnalyticsSnapshots } from "./generators/analytics.js";
import { pickTemplate, buildItineraryItems, buildBudgetBreakdown, buildCarbonEstimate } from "./generators/itinerary.js";

// ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FRESH = args.includes("--fresh");
const SKIP_DEMO = args.includes("--no-demo");
const WEATHER_DAYS = Number((args.find((a) => a.startsWith("--weather-days=")) || "").split("=")[1]) || 180;

const DAY_MS = 86400000;
const warnings = [];
const summary = [];

function log(label, count, note = "") {
  summary.push({ label, count, note });
  console.log(`  ${String(count).padStart(6)}  ${label}${note ? `  — ${note}` : ""}`);
}
function warn(message) {
  warnings.push(message);
}
function daysFromNow(n) {
  const d = new Date(Date.now() + n * DAY_MS);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function daysAgo(n) {
  return new Date(Date.now() - n * DAY_MS);
}

// Collections the seeder owns outright — always replaced.
const REFERENCE_MODELS = [
  Country, Destination, Attraction, Hotel, TransportOption, Airport, FlightOption,
  Route, NearbyService, ClimateNormal, WeatherForecast, CostBenchmark,
  CarbonFactor, ExpenseCategory, InterestTag, ExchangeRate, AppSetting,
  PackingTemplate, ItineraryTemplate, ChatIntent, NotificationTemplate,
  Translation, AnalyticsSnapshot,
];

// Collections holding user-generated content — only wiped with --fresh.
const USER_MODELS = [
  User, Trip, ItineraryItem, Booking, Expense, Document, CommunityPost,
  Review, Notification, PackingList, ChatSession, AuditLog,
];

// ═════════════════════════════════════════════════════════════════════
async function seedReference() {
  console.log("\n▸ Reference data");

  // 0. Countries — canonical locale/currency metadata.
  await Country.deleteMany({});
  await Country.insertMany(countryData);
  log("countries", countryData.length, `${countryData.filter((country) => country.is_core).length} core`);

  // 1. Destinations — everything downstream resolves against these.
  await Destination.deleteMany({});
  const destinations = await Destination.insertMany(
    destinationData.map((d) => ({
      ...d,
      country_code: d.country_code || "BD",
      pricing_currency: d.pricing_currency || "BDT",
      is_international: d.is_international ?? (d.country_code ? d.country_code !== "BD" : false),
    }))
  );
  const destBySlug = new Map(destinations.map((d) => [d.slug, d]));
  const destByName = new Map(destinations.map((d) => [d.name.toLowerCase(), d]));
  log("destinations", destinations.length, `${destinations.filter((d) => !d.is_international).length} in Bangladesh`);

  const resolveDest = (slug, context) => {
    if (!slug) return null;
    const d = destBySlug.get(slug);
    if (!d) warn(`${context}: unknown destination slug "${slug}"`);
    return d || null;
  };

  // 2. Attractions
  await Attraction.deleteMany({});
  const attractions = await Attraction.insertMany(
    attractionData.map(({ destination_slug, ...a }) => {
      const d = resolveDest(destination_slug, `attraction "${a.name}"`);
      return {
        ...a,
        currency: a.currency || "BDT",
        destination_id: d?._id || null,
        is_free: a.is_free ?? a.entry_fee === 0,
      };
    })
  );
  const attractionBySlug = new Map(attractions.filter((a) => a.slug).map((a) => [a.slug, a._id]));
  log("attractions", attractions.length);

  // 3. Hotels
  await Hotel.deleteMany({});
  const hotels = await Hotel.insertMany(
    hotelData.map(({ destination_slug, ...h }) => {
      const d = resolveDest(destination_slug, `hotel "${h.name}"`);
      const prices = (h.room_types || []).map((r) => r.price_per_night);
      return {
        ...h,
        currency: h.currency || "BDT",
        destination_id: d?._id || null,
        price_range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: h.price_per_night, max: h.price_per_night },
      };
    })
  );
  log("hotels", hotels.length);

  // 4. Transport
  await TransportOption.deleteMany({});
  const transport = await TransportOption.insertMany(
    transportData.map((t) => ({
      ...t,
      currency: t.currency || "BDT",
      from_destination_id: destByName.get(t.from_city.toLowerCase())?._id || null,
      to_destination_id: destByName.get(t.to_city.toLowerCase())?._id || null,
    }))
  );
  log("transport options", transport.length, "bus, train and launch services");

  // 5. Aviation
  await Airport.deleteMany({});
  const airports = await Airport.insertMany(
    airportData.map(({ destination_slug, ...a }) => ({
      ...a,
      destination_id: destination_slug ? destBySlug.get(destination_slug)?._id || null : null,
    }))
  );
  log("airports", airports.length);

  await FlightOption.deleteMany({});
  const flights = await FlightOption.insertMany(flightData);
  log("flight schedules", flights.length);

  // 6. Routes
  await Route.deleteMany({});
  const routes = await Route.insertMany(
    routeData.map((r) => {
      const build = (end) => {
        const d = end.slug ? destBySlug.get(end.slug) : null;
        if (end.slug && !d && end.kind === "city") warn(`route endpoint: unknown slug "${end.slug}"`);
        return {
          name: end.name,
          kind: end.kind,
          ref_id: d?._id || (end.slug ? attractionBySlug.get(end.slug) : null) || null,
          lat_lng: end.lat_lng,
          location: end.lat_lng ? { type: "Point", coordinates: [end.lat_lng.lng, end.lat_lng.lat] } : undefined,
        };
      };
      return {
        ...r,
        from: build(r.from),
        to: build(r.to),
        geometry: { type: "LineString", coordinates: r.geometry },
      };
    })
  );
  log("routes", routes.length, "with polylines and turn-by-turn legs");

  // 7. Nearby services — named rows plus generated coverage per destination.
  await NearbyService.deleteMany({});
  const namedRows = namedServices.map(({ destination_slug, ...s }) => ({
    ...s,
    destination_id: destination_slug ? destBySlug.get(destination_slug)?._id || null : null,
    source: "seeded",
  }));
  const generatedRows = destinations.flatMap((d) =>
    generateAreaServices(d).map(({ destination_slug, ...s }) => ({
      ...s,
      destination_id: d._id,
    }))
  );
  const services = await NearbyService.insertMany([...namedRows, ...generatedRows]);
  log("nearby services", services.length, `${namedRows.length} named, ${generatedRows.length} generated coverage`);

  // 8. Climate normals and the rolling forecast window
  await ClimateNormal.deleteMany({});
  const normals = destinations.flatMap((d) => {
    const rows = buildClimateNormals(d);
    if (!rows.length) warn(`climate: no profile mapped for "${d.slug}"`);
    return rows;
  });
  await ClimateNormal.insertMany(normals);
  log("climate normals", normals.length, "12 months per destination");

  await WeatherForecast.deleteMany({});
  let forecastCount = 0;
  for (const d of destinations) {
    const rows = buildDailyForecasts(d, { days: WEATHER_DAYS });
    if (rows.length) {
      await WeatherForecast.insertMany(rows, { ordered: false });
      forecastCount += rows.length;
    }
  }
  log("weather forecasts", forecastCount, `${WEATHER_DAYS} days ahead, per destination`);

  // 9. Cost benchmarks
  await CostBenchmark.deleteMany({});
  const benchmarks = destinations.flatMap((d) =>
    buildCostBenchmarks(d).map(({ destination_slug, ...b }) => ({ ...b, destination_id: d._id }))
  );
  await CostBenchmark.insertMany(benchmarks);
  log("cost benchmarks", benchmarks.length, "3 tiers per destination");

  // 10. Small reference tables
  await CarbonFactor.deleteMany({});
  await CarbonFactor.insertMany(carbonFactors);
  log("carbon factors", carbonFactors.length);

  await ExpenseCategory.deleteMany({});
  await ExpenseCategory.insertMany(expenseCategories);
  log("expense categories", expenseCategories.length);

  await InterestTag.deleteMany({});
  await InterestTag.insertMany(interestTags);
  log("interest tags", interestTags.length);

  await ExchangeRate.deleteMany({});
  await ExchangeRate.insertMany(exchangeRates);
  log("exchange rates", exchangeRates.length);

  await AppSetting.deleteMany({});
  await AppSetting.insertMany(appSettings);
  log("app settings", appSettings.length);

  // 11. Rule tables
  await PackingTemplate.deleteMany({});
  await PackingTemplate.insertMany(packingTemplates);
  log("packing templates", packingTemplates.length, `${packingTemplates.reduce((n, t) => n + t.items.length, 0)} items`);

  await ChatIntent.deleteMany({});
  await ChatIntent.insertMany(chatIntents);
  log("chat intents", chatIntents.length, `${chatIntents.filter((i) => i.is_quick_action).length} quick actions`);

  await NotificationTemplate.deleteMany({});
  await NotificationTemplate.insertMany(notificationTemplates);
  log("notification templates", notificationTemplates.length);

  // 12. Itinerary templates
  await ItineraryTemplate.deleteMany({});
  const templates = await ItineraryTemplate.insertMany(
    itineraryTemplates.map(({ destination_slug, ...t }) => {
      const d = resolveDest(destination_slug, `itinerary template "${t.code}"`);
      for (const day of t.days) {
        for (const item of day.items) {
          if (item.attraction_slug && !attractionBySlug.has(item.attraction_slug)) {
            warn(`itinerary template "${t.code}": unknown attraction slug "${item.attraction_slug}"`);
          }
        }
      }
      return { ...t, currency: t.currency || "BDT", destination_id: d?._id || null, city: d?.name || "" };
    })
  );
  log("itinerary templates", templates.length, `${templates.reduce((n, t) => n + t.days.length, 0)} planned days`);

  // 13. Translations
  await Translation.deleteMany({});
  await Translation.insertMany(translations);
  const keyCount = Object.values(translations[0].strings).reduce((n, ns) => n + Object.keys(ns).length, 0);
  log("translations", translations.length, `${keyCount} keys per language`);

  return { destinations, destBySlug, destByName, attractions, attractionBySlug, hotels, transport, routes, templates };
}

// ═════════════════════════════════════════════════════════════════════
// Packing list generation (FR-15) — the same rule match the API should run.
function matchesConditions(template, ctx) {
  if (template.always_include) return true;
  const c = template.conditions || {};
  let matched = false;

  if (c.international_only && !ctx.isInternational) return false;
  if (c.international_only && ctx.isInternational) matched = true;

  if (c.min_days != null) {
    if (ctx.days < c.min_days) return false;
    matched = true;
  }
  if (c.max_days != null) {
    if (ctx.days > c.max_days) return false;
    matched = true;
  }
  if (c.min_temp_c != null) {
    if (ctx.tempMax < c.min_temp_c) return false;
    matched = true;
  }
  if (c.max_temp_c != null) {
    if (ctx.tempMin > c.max_temp_c) return false;
    matched = true;
  }
  if (c.packing_hints?.length && c.packing_hints.some((h) => ctx.hints.has(h))) matched = true;
  if (c.weather_conditions?.length && c.weather_conditions.some((w) => ctx.conditions.has(w))) matched = true;
  if (c.destination_types?.length && c.destination_types.includes(ctx.destinationType)) matched = true;
  if (c.interests?.length && c.interests.some((i) => ctx.interests.includes(i))) matched = true;

  return matched;
}

function resolveQty(rule, qty, days, travelers) {
  switch (rule) {
    case "per_day": return Math.max(1, days) * travelers;
    case "per_2_days": return Math.max(1, Math.ceil(days / 2)) * travelers;
    case "per_traveler": return travelers;
    default: return qty || 1;
  }
}

function buildPackingList(templatesList, ctx) {
  const applied = templatesList
    .filter((t) => t.is_active !== false && matchesConditions(t, ctx))
    .sort((a, b) => b.priority - a.priority);

  const byCategory = new Map();
  const seen = new Map(); // item name -> the priority that claimed it

  for (const t of applied) {
    for (const item of t.items) {
      const key = item.name.toLowerCase();
      if (seen.has(key) && seen.get(key) >= t.priority) continue;
      seen.set(key, t.priority);

      if (!byCategory.has(t.category)) byCategory.set(t.category, new Map());
      byCategory.get(t.category).set(key, {
        name: item.name,
        qty: resolveQty(item.qty_rule, item.qty, ctx.days, ctx.travelers),
        essential: item.essential,
        checked: false,
        note: item.note || "",
        from_template: t.code,
      });
    }
  }

  return {
    categories: [...byCategory.entries()].map(([category, items]) => ({
      category,
      items: [...items.values()].sort((a, b) => Number(b.essential) - Number(a.essential)),
    })),
    templates_applied: applied.map((t) => t.code),
  };
}

// ═════════════════════════════════════════════════════════════════════
async function seedDemo(ref) {
  console.log("\n▸ Demo accounts and activity");

  const { destBySlug, destByName, attractionBySlug, hotels, transport, routes, templates } = ref;

  const categories = await ExpenseCategory.find().lean();
  const carbonList = await CarbonFactor.find().lean();
  const carbonByMode = new Map(carbonList.map((c) => [c.mode, c]));
  const benchmarks = await CostBenchmark.find().lean();
  const benchmarkKey = (destId, tier) => `${destId}|${tier}`;
  const benchmarkMap = new Map(benchmarks.map((b) => [benchmarkKey(b.destination_id, b.tier), b]));
  const packTemplates = await PackingTemplate.find().lean();
  const notifTemplates = await NotificationTemplate.find({ is_active: true }).lean();

  // ── Users ──
  await User.deleteMany({ email: { $in: demo.users.map((u) => u.email) } });
  const passwordCache = new Map();
  const userDocs = [];
  for (const u of demo.users) {
    if (!passwordCache.has(u.password)) {
      passwordCache.set(u.password, await bcrypt.hash(u.password, 10));
    }
    userDocs.push({
      name: u.name,
      email: u.email,
      password_hash: passwordCache.get(u.password),
      role: u.role,
      language: u.language,
      country: u.country || "Bangladesh",
      country_code: u.country_code || ({ Thailand: "TH", Malaysia: "MY", India: "IN", Nepal: "NP" }[u.country] || "BD"),
      city: u.city || "",
      is_active: u.is_active !== false,
      email_verified: Boolean(u.email_verified),
      preferences: { ...(u.preferences || {}) },
      created_at: daysAgo(u.days_ago),
      last_login_at: daysAgo(Math.max(0, u.days_ago - 5)),
    });
  }
  const users = await User.insertMany(userDocs);
  const userByEmail = new Map(users.map((u) => [u.email, u]));
  log("demo users", users.length, `1 admin, ${users.length - 1} travellers`);

  // ── Trips, itineraries, budgets, carbon ──
  const tripIds = [];
  await Trip.deleteMany({ user_id: { $in: users.map((u) => u._id) } });

  const createdTrips = [];
  for (const t of demo.trips) {
    const user = userByEmail.get(t.user_email);
    if (!user) { warn(`trip: unknown user "${t.user_email}"`); continue; }

    const dest = destByName.get(t.destination.toLowerCase());
    const origin = destByName.get(t.origin.toLowerCase());
    if (!dest) { warn(`trip: unknown destination "${t.destination}"`); continue; }

    const start = daysFromNow(t.start_offset_days);
    const end = new Date(start.getTime() + t.nights * DAY_MS);
    const days = t.nights + 1;

    // Pick a hotel in the destination that fits the tier.
    const candidateHotels = hotels.filter(
      (h) => String(h.destination_id) === String(dest._id) && h.budget_tier === t.budget_tier
    );
    const hotel = candidateHotels[0] || hotels.find((h) => String(h.destination_id) === String(dest._id)) || null;

    // Transport and route between origin and destination.
    const transportOption = transport.find(
      (x) => x.from_city.toLowerCase() === t.origin.toLowerCase() && x.to_city.toLowerCase() === t.destination.toLowerCase()
    ) || null;
    const route = routes.find(
      (r) => r.from.name.toLowerCase() === t.origin.toLowerCase() && r.to.name.toLowerCase() === t.destination.toLowerCase() && r.is_default
    ) || routes.find(
      (r) => r.from.name.toLowerCase() === t.origin.toLowerCase() && r.to.name.toLowerCase() === t.destination.toLowerCase()
    ) || null;

    const benchmark = benchmarkMap.get(benchmarkKey(dest._id, t.budget_tier));
    const { lines, estimated_total } = buildBudgetBreakdown({
      benchmark,
      categories,
      days,
      travelers: t.travelers,
      hotelPricePerNight: hotel?.price_per_night,
      transportFare: transportOption?.fare,
    });

    const carbonMode = route?.mode === "train" ? "train"
      : route?.mode === "launch" ? "launch"
      : route?.mode === "flight" ? "flight_short"
      : transportOption?.mode === "train" ? "train"
      : transportOption?.mode === "launch" ? "launch"
      : "bus";
    const carbon = buildCarbonEstimate({
      route,
      factor: carbonByMode.get(carbonMode),
      travelers: t.travelers,
    }) || undefined;

    const hasItinerary = t.status !== "draft";

    const trip = await Trip.create({
      user_id: user._id,
      hotel_id: hasItinerary ? hotel?._id || null : null,
      origin: t.origin,
      destination: t.destination,
      origin_destination_id: origin?._id || null,
      destination_id: dest._id,
      start_date: start,
      end_date: end,
      travelers: t.travelers,
      budget: t.budget,
      status: t.status,
      interests: t.interests,
      budget_tier: t.budget_tier,
      title: `${days} day${days > 1 ? "s" : ""} in ${t.destination}`,
      budget_breakdown: lines,
      estimated_total,
      route_id: route?._id || null,
      transport_option_id: hasItinerary ? transportOption?._id || null : null,
      carbon,
      cover: t.cover,
      created_at: daysAgo(t.created_days_ago),
      itinerary_generated_at: hasItinerary ? daysAgo(Math.max(0, t.created_days_ago - 1)) : null,
      itinerary_source: hasItinerary ? "template" : "",
    });
    createdTrips.push({ trip, spec: t, dest, origin, hotel, transportOption, benchmark });
    tripIds.push(trip._id);
  }
  log("demo trips", createdTrips.length);

  // ── Itinerary items ──
  await ItineraryItem.deleteMany({ trip_id: { $in: tripIds } });
  let itemCount = 0;
  let plannedWithTemplate = 0;
  for (const { trip, dest, origin } of createdTrips) {
    if (trip.status === "draft") continue;
    const template = pickTemplate(templates, {
      destinationId: dest._id,
      days: trip.duration_days,
      budgetTier: trip.budget_tier,
      interests: trip.interests,
    });
    if (!template) continue;
    plannedWithTemplate++;
    const items = buildItineraryItems(template, trip, attractionBySlug);
    if (items.length) {
      await ItineraryItem.insertMany(items);
      itemCount += items.length;
    }
  }
  log("itinerary items", itemCount, `${plannedWithTemplate} trips planned from templates`);

  // ── Bookings ──
  await Booking.deleteMany({ trip_id: { $in: tripIds } });
  const bookingDocs = [];
  for (const { trip, spec, transportOption } of createdTrips) {
    if (!transportOption || trip.status === "draft") continue;
    const passengers = Array.from({ length: spec.travelers }, (_, i) =>
      i === 0 ? userByEmail.get(spec.user_email).name : `Companion ${i}`
    );
    const seats = passengers.map((_, i) => `${transportOption.seat_prefix || "A"}${i + 1}`);
    bookingDocs.push({
      trip_id: trip._id,
      user_id: trip.user_id,
      transport_id: transportOption._id,
      passengers,
      passenger_details: passengers.map((name, i) => ({ name, seat: seats[i] })),
      seats,
      fare_per_passenger: transportOption.fare,
      total_fare: transportOption.fare * spec.travelers,
      status: trip.status === "completed" ? "confirmed" : "confirmed",
      reference: `TG-${trip._id.toString().slice(-6).toUpperCase()}`,
      journey: {
        operator: transportOption.operator,
        mode: transportOption.mode,
        from_city: transportOption.from_city,
        to_city: transportOption.to_city,
        depart_time: transportOption.depart_time,
        arrive_time: transportOption.arrive_time,
        service_class: transportOption.service_class,
        boarding_point: transportOption.boarding_point,
      },
      travel_date: trip.start_date,
      created_at: daysAgo(Math.max(0, spec.created_days_ago - 1)),
    });
  }
  const bookings = await Booking.insertMany(bookingDocs);
  log("demo bookings", bookings.length, "all mock — FR-08");

  // ── Expenses (completed and active trips only) ──
  await Expense.deleteMany({ trip_id: { $in: tripIds } });
  const expenseDocs = [];
  for (const { trip, spec } of createdTrips) {
    if (!["completed", "active"].includes(trip.status)) continue;
    // Log roughly the planned breakdown as actual spend, with a small
    // variance so the "estimated vs actual" comparison is meaningful.
    for (const line of trip.budget_breakdown) {
      const variance = 0.82 + ((line.amount % 7) / 20); // deterministic 0.82–1.12
      const amount = Math.round(line.amount * variance);
      if (amount <= 0) continue;
      expenseDocs.push({
        trip_id: trip._id,
        user_id: trip.user_id,
        category: line.category,
        description: `${line.label} — ${trip.destination}`,
        amount,
        date: new Date(trip.start_date.getTime() + DAY_MS),
        currency: "BDT",
        payment_method: line.category === "hotel" ? "card" : "cash",
        split_between: spec.travelers,
        created_at: new Date(trip.start_date.getTime() + DAY_MS),
      });
    }
  }
  const expenses = await Expense.insertMany(expenseDocs);
  log("demo expenses", expenses.length);

  // ── Packing lists (planned and active trips) ──
  await PackingList.deleteMany({ trip_id: { $in: tripIds } });
  const packingDocs = [];
  for (const { trip, dest, origin } of createdTrips) {
    if (!["planned", "active"].includes(trip.status)) continue;

    const forecasts = await WeatherForecast.find({
      destination_id: dest._id,
      date: { $gte: trip.start_date, $lte: trip.end_date },
    }).lean();

    const hints = new Set();
    const conditions = new Set();
    let tempMin = Infinity;
    let tempMax = -Infinity;
    for (const f of forecasts) {
      f.packing_hints.forEach((h) => hints.add(h));
      conditions.add(f.condition);
      tempMin = Math.min(tempMin, f.temp_min_c);
      tempMax = Math.max(tempMax, f.temp_max_c);
    }
    if (!forecasts.length) { tempMin = 20; tempMax = 30; }

    const ctx = {
      days: trip.duration_days,
      travelers: trip.travelers,
      tempMin, tempMax, hints, conditions,
      destinationType: dest.type,
      interests: trip.interests,
      isInternational: Boolean(origin && origin.country_code !== dest.country_code),
    };
    const { categories: packCategories, templates_applied } = buildPackingList(packTemplates, ctx);

    packingDocs.push({
      trip_id: trip._id,
      user_id: trip.user_id,
      categories: packCategories,
      based_on: {
        days: trip.duration_days,
        travelers: trip.travelers,
        temp_min_c: Number.isFinite(tempMin) ? tempMin : null,
        temp_max_c: Number.isFinite(tempMax) ? tempMax : null,
        weather_summary: forecasts.length
          ? `${forecasts.length} day forecast, ${tempMin}–${tempMax} °C, ${[...conditions].join(", ")}`
          : "No forecast available for these dates",
        packing_hints: [...hints],
        interests: trip.interests,
        templates_applied,
      },
    });
  }
  const packingLists = await PackingList.insertMany(packingDocs);
  log("packing lists", packingLists.length, `${packingLists.reduce((n, p) => n + p.categories.reduce((m, c) => m + c.items.length, 0), 0)} items generated`);

  // ── Community posts ──
  await CommunityPost.deleteMany({ user_id: { $in: users.map((u) => u._id) } });
  const postDocs = demo.communityPosts.map((p) => {
    const user = userByEmail.get(p.user_email);
    const dest = destByName.get(p.place.toLowerCase());
    return {
      user_id: user._id,
      destination_id: dest?._id || null,
      place: p.place,
      content: p.content,
      rating: p.rating,
      likes: p.likes,
      tags: p.tags || [],
      is_pinned: Boolean(p.is_pinned),
      moderation_status: "approved",
      created_at: daysAgo(p.days_ago),
    };
  });
  const posts = await CommunityPost.insertMany(postDocs);
  log("community posts", posts.length);

  // ── Reviews ──
  await Review.deleteMany({ user_id: { $in: users.map((u) => u._id) } });
  const reviewDocs = [];
  for (const r of demo.reviews) {
    const user = userByEmail.get(r.user_email);
    const attractionId = attractionBySlug.get(r.attraction_slug);
    if (!attractionId) { warn(`review: unknown attraction slug "${r.attraction_slug}"`); continue; }
    reviewDocs.push({
      user_id: user._id,
      attraction_id: attractionId,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment,
      moderation_status: "approved",
      created_at: daysAgo(r.days_ago),
    });
  }
  const reviews = await Review.insertMany(reviewDocs);
  log("attraction reviews", reviews.length);

  // Refresh the denormalised rating on every reviewed attraction — insertMany
  // bypasses the post-save hook that normally does this.
  const ratingRows = await Review.aggregate([
    { $match: { is_hidden: false } },
    { $group: { _id: "$attraction_id", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Promise.all(
    ratingRows.map((r) =>
      Attraction.updateOne({ _id: r._id }, { rating: Math.round(r.avg * 10) / 10, review_count: r.count })
    )
  );
  log("attraction ratings refreshed", ratingRows.length);

  // ── Documents ──
  await Document.deleteMany({ user_id: { $in: users.map((u) => u._id) } });
  const documentDocs = demo.documents.map((d) => ({
    user_id: userByEmail.get(d.user_email)._id,
    type: d.type,
    title: d.title,
    // Placeholder URL — FR-14 stores a Cloudinary URL once uploads are wired.
    file_url: `https://res.cloudinary.com/demo/image/upload/tourgenie/${d.type}-placeholder.png`,
    expiry_date: d.expiry_offset_days != null ? daysFromNow(d.expiry_offset_days) : null,
    document_number: d.document_number || "",
    issued_by: d.issued_by || "",
    mime_type: "image/png",
    created_at: daysAgo(d.days_ago),
  }));
  const documents = await Document.insertMany(documentDocs);
  log("demo documents", documents.length);

  // ── Notifications, generated from the templates ──
  await Notification.deleteMany({ user_id: { $in: users.map((u) => u._id) } });
  const notificationDocs = [];
  const render = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

  for (const { trip } of createdTrips) {
    const hoursToStart = (trip.start_date - Date.now()) / 3600000;
    for (const nt of notifTemplates) {
      let fires = false;
      if (nt.trigger.event === "trip_start_approaching") {
        fires = hoursToStart > 0 && hoursToStart <= nt.trigger.offset_hours;
      } else if (nt.trigger.event === "itinerary_generated") {
        fires = Boolean(trip.itinerary_generated_at);
      } else if (nt.trigger.event === "trip_completed") {
        fires = trip.status === "completed";
      }
      if (!fires) continue;

      const vars = {
        destination: trip.destination,
        origin: trip.origin,
        trip_title: trip.title,
        trip_id: trip._id.toString(),
        days: String(trip.duration_days),
        date: trip.start_date.toISOString().slice(0, 10),
      };
      notificationDocs.push({
        user_id: trip.user_id,
        trip_id: trip._id,
        template_code: nt.code,
        type: nt.type,
        title: render(nt.title_template, vars),
        message: render(nt.message_template, vars),
        severity: nt.severity,
        icon: nt.icon,
        action_url: render(nt.action_url, vars),
        is_read: false,
        created_at: new Date(),
        deliver_at: new Date(),
      });
    }
  }
  // Document-expiry notifications
  for (const doc of documents) {
    if (!doc.expiry_date) continue;
    const daysToExpiry = Math.round((doc.expiry_date - Date.now()) / DAY_MS);
    const tpl = notifTemplates.find(
      (t) => t.trigger.event === "document_expiring" && daysToExpiry <= t.trigger.threshold
    );
    if (!tpl) continue;
    const vars = {
      document_type: doc.title || doc.type,
      days: String(daysToExpiry),
      date: doc.expiry_date.toISOString().slice(0, 10),
    };
    notificationDocs.push({
      user_id: doc.user_id,
      template_code: `${tpl.code}:${doc._id}`,
      type: tpl.type,
      title: render(tpl.title_template, vars),
      message: render(tpl.message_template, vars),
      severity: tpl.severity,
      icon: tpl.icon,
      action_url: tpl.action_url,
      created_at: new Date(),
    });
  }
  const notifications = await Notification.insertMany(notificationDocs, { ordered: false });
  log("notifications", notifications.length, "generated from templates");

  // ── Chat sessions ──
  await ChatSession.deleteMany({ user_id: { $in: users.map((u) => u._id) } });
  const plannedTrips = createdTrips.filter((c) => c.trip.status === "planned").slice(0, 4);
  const chatDocs = plannedTrips.map(({ trip }) => ({
    user_id: trip.user_id,
    trip_id: trip._id,
    title: `Planning ${trip.destination}`,
    last_message_at: daysAgo(2),
    messages: [
      { role: "user", content: "Make it cheaper", created_at: daysAgo(2) },
      {
        role: "assistant",
        intent_code: "reduce_budget",
        source: "database",
        content: `I've reworked your ${trip.destination} plan to bring the cost down. I swapped paid activities for free alternatives where the experience holds up, moved meals towards local restaurants, and dropped the optional add-ons.`,
        applied_changes: { action: "reduce_budget", items_updated: 4, items_removed: 2, cost_delta: -Math.round(trip.estimated_total * 0.18) },
        created_at: daysAgo(2),
      },
    ],
    created_at: daysAgo(2),
  }));
  const chats = await ChatSession.insertMany(chatDocs);
  log("chat sessions", chats.length);

  // ── Denormalised user counters ──
  await Promise.all(
    users.map(async (u) => {
      const [trips, bookingsCount, reviewsCount, postsCount] = await Promise.all([
        Trip.countDocuments({ user_id: u._id }),
        Booking.countDocuments({ user_id: u._id }),
        Review.countDocuments({ user_id: u._id }),
        CommunityPost.countDocuments({ user_id: u._id }),
      ]);
      await User.updateOne(
        { _id: u._id },
        { stats: { trips_count: trips, bookings_count: bookingsCount, reviews_count: reviewsCount, posts_count: postsCount } }
      );
    })
  );
  log("user stat counters", users.length, "recomputed");
}

// ═════════════════════════════════════════════════════════════════════
async function ensureIndexes() {
  console.log("\n▸ Indexes");
  const all = [...REFERENCE_MODELS, ...USER_MODELS];
  let total = 0;
  for (const Model of all) {
    await Model.syncIndexes();
    const idx = await Model.collection.indexes();
    total += idx.length;
  }
  log("indexes across all collections", total, "including 2dsphere and text");
}

// ═════════════════════════════════════════════════════════════════════
async function run() {
  const started = Date.now();
  const catalogue = validateCatalog();
  console.log(
    `\nCatalogue validated: ${catalogue.summary.destinations} destinations across ${catalogue.summary.countries} countries`,
  );
  await connectDB();
  console.log(`\nTourGenie AI — seeding "${mongoose.connection.db.databaseName}"`);
  console.log(`Mode: ${FRESH ? "FRESH (drop everything)" : "refresh reference data"}${SKIP_DEMO ? ", no demo content" : ""}`);

  if (FRESH) {
    console.log("\n▸ Dropping existing collections");
    for (const Model of [...REFERENCE_MODELS, ...USER_MODELS]) {
      await Model.deleteMany({});
    }
    console.log(`  ${REFERENCE_MODELS.length + USER_MODELS.length} collections cleared`);
  }

  const ref = await seedReference();
  if (!SKIP_DEMO) await seedDemo(ref);
  await ensureIndexes();

  // Analytics last — it aggregates over everything above.
  console.log("\n▸ Analytics");
  const counts = await writeAnalyticsSnapshots({ days: 180 });
  log("analytics snapshots", counts.daily + counts.monthly, `${counts.daily} daily, ${counts.monthly} monthly`);

  const totalDocs = summary.reduce((n, s) => n + s.count, 0);
  console.log(`\n✓ Seed complete in ${((Date.now() - started) / 1000).toFixed(1)}s — ${totalDocs.toLocaleString()} documents written`);

  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} warning${warnings.length > 1 ? "s" : ""}:`);
    for (const w of warnings.slice(0, 25)) console.log(`  · ${w}`);
    if (warnings.length > 25) console.log(`  · …and ${warnings.length - 25} more`);
  }

  if (!SKIP_DEMO) {
    console.log("\nSign in with:");
    console.log(`  admin      admin@tourgenie.ai / ${demo.ADMIN_PASSWORD}`);
    console.log(`  traveller  moontashir@tourgenie.ai / ${demo.DEMO_PASSWORD}`);
    console.log(`  traveller  sadman@tourgenie.ai / ${demo.DEMO_PASSWORD}`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\n✗ Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
