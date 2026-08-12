// Platform reference data: expense categories, interest tags, carbon
// factors, currency rates, app settings, and the cost-benchmark builder.

// ── FR-09 / FR-10 — expense & budget categories ──────────────────────
// `color` drives the donut chart on the Budget page; `default_budget_share`
// seeds the estimated split before any expense has been logged. Shares sum
// to 1.00 across the six categories.
export const expenseCategories = [
  { code: "transport", label: "Transport", color: "#1C8C82", icon: "Bus", sort_order: 1, default_budget_share: 0.22, description: "Intercity travel, local rides, fuel and fares." },
  { code: "hotel", label: "Hotel", color: "#EF8354", icon: "BedDouble", sort_order: 2, default_budget_share: 0.34, description: "Accommodation for the whole stay." },
  { code: "food", label: "Food", color: "#D9A441", icon: "UtensilsCrossed", sort_order: 3, default_budget_share: 0.22, description: "Meals, snacks and drinks." },
  { code: "attractions", label: "Attractions", color: "#146560", icon: "Ticket", sort_order: 4, default_budget_share: 0.10, description: "Entry fees, guides, tours and activities." },
  { code: "shopping", label: "Shopping", color: "#D96B3B", icon: "ShoppingBag", sort_order: 5, default_budget_share: 0.07, description: "Souvenirs and personal purchases." },
  { code: "emergency", label: "Emergency & Misc", color: "#8A7B6B", icon: "CircleAlert", sort_order: 6, default_budget_share: 0.05, description: "Medical, contingency and anything uncategorised." },
];

// ── FR-03 — interest chips on the Plan New Trip form ─────────────────
// The same codes are matched by ItineraryTemplate.interests and
// PackingTemplate.conditions.interests.
export const interestTags = [
  { code: "beach", label: "Beach", icon: "Waves", group: "nature", sort_order: 1, description: "Sand, sea and sunsets.", suits_destination_types: ["beach", "island"] },
  { code: "hills", label: "Hills & Mountains", icon: "Mountain", group: "nature", sort_order: 2, description: "Viewpoints, ridges and cool air.", suits_destination_types: ["hill"] },
  { code: "wildlife", label: "Wildlife", icon: "Bird", group: "nature", sort_order: 3, description: "National parks, safaris and birding.", suits_destination_types: ["forest", "nature", "island"] },
  { code: "waterfalls", label: "Waterfalls", icon: "Droplets", group: "nature", sort_order: 4, description: "Falls and river valleys — best after the monsoon.", suits_destination_types: ["hill", "nature"] },
  { code: "history", label: "History & Heritage", icon: "Landmark", group: "culture", sort_order: 5, description: "Forts, ruins and UNESCO sites.", suits_destination_types: ["heritage", "city", "metro"] },
  { code: "culture", label: "Local Culture", icon: "Users", group: "culture", sort_order: 6, description: "Villages, crafts and indigenous communities.", suits_destination_types: ["hill", "heritage", "city"] },
  { code: "religious", label: "Religious Sites", icon: "Moon", group: "culture", sort_order: 7, description: "Mosques, temples, shrines and monasteries.", suits_destination_types: ["city", "heritage", "metro"] },
  { code: "photography", label: "Photography", icon: "Camera", group: "activity", sort_order: 8, description: "Golden-hour spots and viewpoints.", suits_destination_types: ["beach", "hill", "heritage", "nature", "island"] },
  { code: "trekking", label: "Trekking", icon: "Footprints", group: "activity", sort_order: 9, description: "Multi-hour hikes and hill trails.", suits_destination_types: ["hill", "forest", "nature"] },
  { code: "adventure", label: "Adventure", icon: "Compass", group: "activity", sort_order: 10, description: "Caves, rafting, snorkelling and the rest.", suits_destination_types: ["hill", "island", "nature"] },
  { code: "boating", label: "Boating & Cruises", icon: "Ship", group: "activity", sort_order: 11, description: "River cruises, lake trips and launch journeys.", suits_destination_types: ["forest", "island", "city"] },
  { code: "food", label: "Food & Cuisine", icon: "UtensilsCrossed", group: "food", sort_order: 12, description: "Local specialities and street food.", suits_destination_types: ["city", "metro", "beach"] },
  { code: "shopping", label: "Shopping", icon: "ShoppingBag", group: "food", sort_order: 13, description: "Markets, malls and souvenirs.", suits_destination_types: ["metro", "city"] },
  { code: "relaxation", label: "Relaxation", icon: "Sun", group: "relaxation", sort_order: 14, description: "A slower pace, spas and long mornings.", suits_destination_types: ["beach", "island", "nature"] },
  { code: "family", label: "Family Friendly", icon: "Baby", group: "social", sort_order: 15, description: "Easy access, short walks and things for children.", suits_destination_types: ["beach", "city", "metro"] },
  { code: "nightlife", label: "Nightlife", icon: "Music", group: "social", sort_order: 16, description: "Evening entertainment and late dining.", suits_destination_types: ["metro", "city"] },
];

// ── FR-16 — carbon emission factors ──────────────────────────────────
// Grams CO₂e per passenger-kilometre. Shared modes already assume typical
// occupancy, which `occupancy_assumption` records.
export const carbonFactors = [
  { mode: "walking", label: "Walking", category: "active", grams_co2_per_passenger_km: 0, occupancy_assumption: 1, is_shared: false, rating: "low", greener_alternatives: [], sort_order: 1, notes: "Zero direct emissions." },
  { mode: "cycling", label: "Cycling", category: "active", grams_co2_per_passenger_km: 0, occupancy_assumption: 1, is_shared: false, rating: "low", greener_alternatives: [], sort_order: 2, notes: "Zero direct emissions." },
  { mode: "train", label: "Train (intercity)", category: "rail", grams_co2_per_passenger_km: 35, occupancy_assumption: 300, rating: "low", greener_alternatives: [], sort_order: 3, source: "DEFRA 2023 national rail average", notes: "The lowest-emission motorised option for intercity travel in Bangladesh." },
  { mode: "bus", label: "Intercity bus (AC)", category: "road", grams_co2_per_passenger_km: 68, occupancy_assumption: 36, rating: "low", greener_alternatives: ["train"], sort_order: 4, source: "DEFRA 2023 coach average", notes: "Efficient per passenger because of high occupancy." },
  { mode: "bus_local", label: "Local bus", category: "road", grams_co2_per_passenger_km: 82, occupancy_assumption: 45, rating: "low", greener_alternatives: ["walking", "cycling"], sort_order: 5 },
  { mode: "launch", label: "River launch / ferry", category: "water", grams_co2_per_passenger_km: 63, occupancy_assumption: 400, rating: "low", greener_alternatives: ["train"], sort_order: 6, notes: "Low per passenger on the big Dhaka–Barishal launches; higher on small boats." },
  { mode: "boat_small", label: "Small engine boat", category: "water", grams_co2_per_passenger_km: 190, occupancy_assumption: 8, rating: "moderate", greener_alternatives: ["launch"], sort_order: 7 },
  { mode: "cng", label: "CNG auto-rickshaw", category: "road", grams_co2_per_passenger_km: 105, occupancy_assumption: 3, rating: "moderate", greener_alternatives: ["bus_local", "walking"], sort_order: 8, notes: "Compressed natural gas emits less than petrol, but occupancy is low." },
  { mode: "car_petrol", label: "Private car (petrol)", category: "road", grams_co2_per_passenger_km: 171, occupancy_assumption: 1.5, is_shared: false, rating: "high", greener_alternatives: ["bus", "train"], sort_order: 9, source: "DEFRA 2023 average petrol car" },
  { mode: "car_shared", label: "Shared car (4 passengers)", category: "road", grams_co2_per_passenger_km: 64, occupancy_assumption: 4, rating: "low", greener_alternatives: ["bus", "train"], sort_order: 10, notes: "Filling the car cuts per-passenger emissions to roughly bus level." },
  { mode: "motorbike", label: "Motorbike", category: "road", grams_co2_per_passenger_km: 103, occupancy_assumption: 1.2, is_shared: false, rating: "moderate", greener_alternatives: ["bus_local"], sort_order: 11 },
  { mode: "flight_domestic", label: "Domestic flight", category: "air", grams_co2_per_passenger_km: 255, occupancy_assumption: 120, rating: "very-high", greener_alternatives: ["train", "bus"], sort_order: 12, source: "DEFRA 2023 domestic aviation incl. radiative forcing", notes: "Short flights carry the takeoff/landing fuel burn over few kilometres, so per-km emissions are the worst of any mode." },
  { mode: "flight_short", label: "Short-haul international flight", category: "air", grams_co2_per_passenger_km: 156, occupancy_assumption: 180, rating: "high", greener_alternatives: ["train", "bus"], sort_order: 13, source: "DEFRA 2023 short-haul incl. radiative forcing" },
  { mode: "flight_long", label: "Long-haul flight", category: "air", grams_co2_per_passenger_km: 148, occupancy_assumption: 300, rating: "high", greener_alternatives: [], sort_order: 14, source: "DEFRA 2023 long-haul incl. radiative forcing" },
];

// ── Currency reference (1 unit = N BDT), indicative only ─────────────
export const exchangeRates = [
  { currency: "BDT", name: "Bangladeshi Taka", symbol: "৳", rate: 1, decimals: 0 },
  { currency: "USD", name: "US Dollar", symbol: "$", rate: 122.0 },
  { currency: "EUR", name: "Euro", symbol: "€", rate: 132.5 },
  { currency: "GBP", name: "British Pound", symbol: "£", rate: 155.0 },
  { currency: "INR", name: "Indian Rupee", symbol: "₹", rate: 1.42 },
  { currency: "NPR", name: "Nepalese Rupee", symbol: "रू", rate: 0.89 },
  { currency: "THB", name: "Thai Baht", symbol: "฿", rate: 3.55 },
  { currency: "MYR", name: "Malaysian Ringgit", symbol: "RM", rate: 27.4 },
  { currency: "SGD", name: "Singapore Dollar", symbol: "S$", rate: 91.0 },
  { currency: "AED", name: "UAE Dirham", symbol: "د.إ", rate: 33.2 },
  { currency: "MVR", name: "Maldivian Rufiyaa", symbol: "Rf", rate: 7.9 },
  { currency: "SAR", name: "Saudi Riyal", symbol: "﷼", rate: 32.5 },
  { currency: "QAR", name: "Qatari Riyal", symbol: "﷼", rate: 33.5 },
  { currency: "TRY", name: "Turkish Lira", symbol: "₺", rate: 3.1 },
];

// ── Platform settings ────────────────────────────────────────────────
export const appSettings = [
  { key: "booking.mock_only", value: true, type: "boolean", group: "features", label: "Mock booking only", description: "FR-08: bookings are demonstration records. No carrier API and no payment gateway are integrated.", is_editable: false },
  { key: "booking.service_charge_bdt", value: 0, type: "number", group: "limits", label: "Booking service charge", description: "Added to every mock booking. Zero while booking is demo-only." },
  { key: "booking.max_passengers", value: 10, type: "number", group: "limits", label: "Maximum passengers per booking" },
  { key: "trip.max_duration_days", value: 30, type: "number", group: "limits", label: "Maximum trip length in days" },
  { key: "trip.max_travelers", value: 20, type: "number", group: "limits", label: "Maximum travellers per trip" },
  { key: "trip.default_budget_tier", value: "mid", type: "string", group: "general", label: "Default budget tier" },
  { key: "document.max_size_mb", value: 10, type: "number", group: "limits", label: "Maximum document upload size (MB)", description: "FR-14 precondition: the file must be within the size limit." },
  { key: "document.allowed_types", value: ["image/jpeg", "image/png", "image/webp", "application/pdf"], type: "array", group: "limits", label: "Allowed document MIME types" },
  { key: "weather.forecast_window_days", value: 180, type: "number", group: "features", label: "Weather forecast window", description: "How many days ahead the forecast generator fills. Dates beyond this fall back to monthly climate normals." },
  { key: "itinerary.source_priority", value: ["template", "groq", "claude", "openai"], type: "array", group: "ai", label: "Itinerary generation order", description: "FR-04 / NFR-06: the database template is tried first so generation always works; an AI provider refines it when a key is configured.", is_public: false },
  { key: "chat.source_priority", value: ["database", "groq", "claude", "openai"], type: "array", group: "ai", label: "Chat assistant answer order", description: "FR-05: intents in the database answer first, so the assistant works with no AI key.", is_public: false },
  { key: "currency.base", value: "BDT", type: "string", group: "general", label: "Base currency" },
  { key: "language.default", value: "en", type: "string", group: "general", label: "Default interface language" },
  { key: "language.supported", value: ["en", "bn", "hi", "ar", "zh"], type: "array", group: "general", label: "Supported languages", description: "FR-17." },
  { key: "nearby.default_radius_km", value: 5, type: "number", group: "features", label: "Default nearby-service search radius" },
  { key: "nearby.max_radius_km", value: 25, type: "number", group: "limits", label: "Maximum nearby-service search radius" },
  { key: "community.require_moderation", value: false, type: "boolean", group: "features", label: "Hold new posts for moderation", description: "FR-19 / FR-23: when true, posts start as pending instead of approved." },
  { key: "analytics.snapshot_days", value: 180, type: "number", group: "features", label: "Days of daily analytics history to keep" },
];

// ── FR-09 — cost benchmark builder ───────────────────────────────────
//
// Rather than hand-writing 27 destinations × 3 tiers, each destination's
// mid-tier daily cost (from the destination catalogue) is split across
// categories by these shares and scaled per tier. Overrides below correct
// the places where the generic model is wrong.

const TIER_MULTIPLIER = { budget: 0.55, mid: 1.0, luxury: 2.15 };

// Fractions of the mid-tier daily spend, per destination type.
const CATEGORY_SHARE = {
  default: { accommodation: 0.4, food: 0.26, local_transport: 0.14, attractions: 0.12, shopping: 0.05, misc: 0.03 },
  metro: { accommodation: 0.38, food: 0.24, local_transport: 0.14, attractions: 0.1, shopping: 0.11, misc: 0.03 },
  beach: { accommodation: 0.42, food: 0.28, local_transport: 0.12, attractions: 0.11, shopping: 0.04, misc: 0.03 },
  island: { accommodation: 0.44, food: 0.3, local_transport: 0.1, attractions: 0.11, shopping: 0.02, misc: 0.03 },
  hill: { accommodation: 0.38, food: 0.24, local_transport: 0.2, attractions: 0.13, shopping: 0.02, misc: 0.03 },
  forest: { accommodation: 0.35, food: 0.22, local_transport: 0.25, attractions: 0.14, shopping: 0.01, misc: 0.03 },
  heritage: { accommodation: 0.36, food: 0.26, local_transport: 0.18, attractions: 0.16, shopping: 0.01, misc: 0.03 },
};

// Local transport rates in BDT, by country.
const TRANSPORT_RATES = {
  BD: { cng_per_km: 35, rickshaw_short_trip: 40, local_bus: 20, ride_share_per_km: 28, reserved_car_per_day: 4500 },
  NP: { cng_per_km: 45, rickshaw_short_trip: 60, local_bus: 25, ride_share_per_km: 40, reserved_car_per_day: 6500 },
  TH: { cng_per_km: 95, rickshaw_short_trip: 140, local_bus: 35, ride_share_per_km: 80, reserved_car_per_day: 12000 },
  MY: { cng_per_km: 85, rickshaw_short_trip: 0, local_bus: 55, ride_share_per_km: 70, reserved_car_per_day: 11000 },
  AE: { cng_per_km: 150, rickshaw_short_trip: 0, local_bus: 100, ride_share_per_km: 130, reserved_car_per_day: 18000 },
  IN: { cng_per_km: 40, rickshaw_short_trip: 55, local_bus: 22, ride_share_per_km: 32, reserved_car_per_day: 5200 },
  SG: { cng_per_km: 180, rickshaw_short_trip: 0, local_bus: 130, ride_share_per_km: 160, reserved_car_per_day: 22000 },
  MV: { cng_per_km: 0, rickshaw_short_trip: 0, local_bus: 150, ride_share_per_km: 0, reserved_car_per_day: 0 },
};

// Where the generic model needs correcting — mostly places whose transport
// or accommodation cost is structurally unusual.
const OVERRIDES = {
  sundarbans: { note: "Costs are package-based: the cruise fare covers boat, meals, guide and forest permit. Little is bought separately." },
  "saint-martins": { note: "Ferry fare and the November–March-only season push effective cost above the daily figure." },
  "sajek-valley": { note: "Add the Khagrachari transfer and convoy — Sajek itself is cheap once you arrive." },
  male: { note: "Guesthouse-island rates, not resort rates. A resort stay is several times this figure." },
};

export function buildCostBenchmarks(destination) {
  const base = destination.avg_daily_cost || 3000;
  const share = CATEGORY_SHARE[destination.type] || CATEGORY_SHARE.default;
  const rates = TRANSPORT_RATES[destination.country_code] || TRANSPORT_RATES.BD;
  const override = OVERRIDES[destination.slug] || {};

  return Object.entries(TIER_MULTIPLIER).map(([tier, mult]) => {
    const daily = base * mult;
    const round = (n) => Math.round(n / 10) * 10;

    const perDay = {
      accommodation: round(daily * share.accommodation),
      food: round(daily * share.food),
      local_transport: round(daily * share.local_transport),
      attractions: round(daily * share.attractions),
      shopping: round(daily * share.shopping),
      misc: round(daily * share.misc),
    };

    const foodDaily = perDay.food;
    return {
      destination_slug: destination.slug,
      city: destination.name,
      tier,
      currency: "BDT",
      per_person_per_day: perDay,
      meal_costs: {
        breakfast: round(foodDaily * 0.2),
        lunch: round(foodDaily * 0.32),
        dinner: round(foodDaily * 0.38),
        street_snack: round(foodDaily * 0.1),
      },
      local_transport_rates: {
        cng_per_km: Math.round(rates.cng_per_km * (tier === "luxury" ? 1.15 : 1)),
        rickshaw_short_trip: rates.rickshaw_short_trip,
        local_bus: rates.local_bus,
        ride_share_per_km: rates.ride_share_per_km,
        reserved_car_per_day: Math.round(rates.reserved_car_per_day * mult),
      },
      hotel_price_range: {
        min: round(perDay.accommodation * 1.4),
        max: round(perDay.accommodation * 3.2),
      },
      notes: override.note || "",
    };
  });
}

export default {
  expenseCategories,
  interestTags,
  carbonFactors,
  exchangeRates,
  appSettings,
  buildCostBenchmarks,
};
