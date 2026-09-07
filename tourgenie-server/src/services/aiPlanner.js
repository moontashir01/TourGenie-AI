// FR-04 — AI Itinerary Generation.
// Tries providers in order of preference, skipping any without a
// configured key, and falling through to the next on failure (NFR-06:
// "the AI layer falls back to a secondary provider if the primary fails").
// Order: Groq (fast, free tier) -> Claude (primary per the SRS) -> OpenAI.

import { recordProviderCall } from "./providerStatus.js";

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Groq's free tier meters tokens per minute across prompt + completion, so the
// completion budget has to be sized against the prompt rather than fixed —
// asking for a flat 8000 made every request fail with 413 "Request too large".
const GROQ_TPM_LIMIT = Number(process.env.GROQ_TPM_LIMIT || 8000);
const MAX_OPTIONAL_ATTRACTIONS = Number(process.env.MAX_OPTIONAL_ATTRACTIONS || 25);
const MAX_CANDIDATE_CITIES = Number(process.env.MAX_CANDIDATE_CITIES || 12);

// Measured against Groq's own accounting on these prompts (~2.9 chars/token);
// deliberately pessimistic, because underestimating means a 413 rather than a
// slightly short completion.
function estimateTokens(text) {
  return Math.ceil(text.length / 2.9);
}

function groqCompletionBudget(prompt) {
  const headroom = GROQ_TPM_LIMIT - estimateTokens(prompt) - 500; // 500 = safety margin
  return Math.max(1200, Math.min(6000, headroom));
}

function daysBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

// The attractions the model is allowed to schedule.
function formatAttractionSection(attractions, mustVisitIds, pricingCurrency) {
  const mustSet = new Set(mustVisitIds || []);
  const describe = (a) =>
    `- id:${a._id} | ${a.name} (${a.category}) in ${a.city} | entry fee ${a.entry_fee} ${a.currency || pricingCurrency} | hours: ${a.open_hours}`;

  const must = attractions.filter((a) => mustSet.has(String(a._id)));

  // Picking attractions used to set a floor and no ceiling: the rest of the
  // catalogue was still offered as optional and the model cheerfully filled
  // the days with it, so a traveller who chose three places got a plan full
  // of ones they hadn't. Picks are now the complete set of catalogued
  // sightseeing — meals, travel, rest and free time still fill the day around
  // them, the model just may not add sights of its own choosing.
  if (must.length > 0) {
    return (
      `THE ONLY ATTRACTIONS ALLOWED — the traveler picked exactly these. Every one must appear as an item's ` +
      `attraction_id exactly once, and you must NOT schedule any other sightseeing stop, museum, landmark, ` +
      `beach, market or tour. Fill the rest of each day with meals, travel legs, rest and unstructured free ` +
      `time (attraction_id null):\n${must.map(describe).join("\n")}`
    );
  }

  // Nothing picked, so the whole catalogue is the menu. Free-tier Groq caps
  // tokens per minute, so it is capped too — a country with 60+ catalogued
  // attractions would otherwise push the prompt past the limit on its own.
  const optional = attractions.slice(0, MAX_OPTIONAL_ATTRACTIONS);
  return (
    `Attractions available (use these where relevant via their id in attraction_id; you may also add generic ` +
    `activities like meals or travel legs with attraction_id null):\n${
      optional.map(describe).join("\n") || "(none — invent reasonable generic activities and note costs are estimates)"
    }`
  );
}

// Anchors every meal's est_cost to the destination's real price level.
// Without this the model prices food at whatever squeezes inside the budget.
function foodPricingSection(trip, meals) {
  if (!meals) return "";
  return `Realistic food prices at the destination for the WHOLE party of ${trip.travelers} (BDT): breakfast ~${meals.breakfast}, lunch ~${meals.lunch}, dinner ~${meals.dinner}, street snack ~${meals.snack}. Every meal item's est_cost must be in line with these figures — NEVER lowball food to make the budget fit; if money is tight, drop optional paid activities instead.`;
}

// Safety net for when the model ignores the guidance anyway: a sit-down meal
// priced far below the destination's baseline is corrected to it.
function enforceMealFloors(items, meals) {
  if (!meals) return items;
  for (const item of items) {
    if (item.category !== "meal") continue;
    const hour = Number(item.time.slice(0, 2));
    const floor = hour < 11 ? meals.breakfast : hour < 16 ? meals.lunch : meals.dinner;
    if (floor > 0 && item.est_cost < floor * 0.7) item.est_cost = floor;
  }
  return items;
}

function buildPrompt(trip, attractions, mustVisitIds = [], meals = null) {
  const numDays = daysBetween(trip.start_date, trip.end_date);
  const destinationCountry = trip.destination_id?.country || "the destination country";
  const pricingCurrency = trip.currency || trip.destination_id?.pricing_currency || "BDT";

  const attractionSection = formatAttractionSection(attractions, mustVisitIds, pricingCurrency);

  return `You are the itinerary-planning engine for TourGenie AI, a multi-country travel app. Build a realistic day-by-day itinerary for ${trip.destination}, ${destinationCountry}, as pure JSON — no markdown, no commentary, no code fences.

Trip details:
- Origin: ${trip.origin}
- Destination: ${trip.destination}
- Dates: ${trip.start_date.toISOString().slice(0, 10)} to ${trip.end_date.toISOString().slice(0, 10)} (${numDays} day${numDays > 1 ? "s" : ""})
- Travelers: ${trip.travelers}
- Total budget: ${trip.budget} ${pricingCurrency} for the whole party of ${trip.travelers}${trip.budget_includes_flights === false ? ` — this EXCLUDES the travel to and from ${trip.origin}, so plan on-trip costs only` : ` — this INCLUDES the travel to and from ${trip.origin}`}
- Interests: ${trip.interests?.join(", ") || "none specified"}
- Transport preference: ${trip.transport_preference}
- Hotel preference: ${trip.hotel_preference}
- Food preference: ${trip.food_preference}

${foodPricingSection(trip, meals)}

${attractionSection}

Return ONLY a JSON array (no wrapping object, no prose) of itinerary items, one entry per activity, in this exact shape:
[
  { "day": 1, "time": "08:00", "activity": "string", "location": "string", "est_cost": 0, "attraction_id": "string or null", "category": "travel|meal|sightseeing|activity|rest|shopping" }
]

Rules:
- Cover all ${numDays} day(s), roughly 3-5 activities per day including at least one meal.
- Where a THE ONLY ATTRACTIONS ALLOWED list is given, every id in it must appear as an item's attraction_id exactly once at a sensible time for its open hours, and NO other sightseeing stop may be scheduled — fill the remaining hours with meals, rest and free time instead.
- Keep the sum of est_cost values reasonably within the total budget of ${trip.budget} ${pricingCurrency} across the whole trip for all ${trip.travelers} traveler(s).
- Do NOT write hotel check-in or check-out items. The app adds those itself from the hotel the traveler actually booked, with its name and its real cost.
- time must be 24-hour "HH:MM".
- est_cost is a number in ${pricingCurrency} covering ALL ${trip.travelers} traveler(s) combined — never a per-person figure (0 for free activities).
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

// Split the traveler's actual trip length across their chosen cities,
// proportionally to each city's typical stay. The prompt states the result
// as explicit per-city day counts, so the plan always divides the traveler's
// OWN interval — never the catalogue's "recommended days" verbatim.
function allocateDaysAcrossCities(cities, totalDays) {
  if (!cities.length || totalDays < 1) return [];
  const weights = cities.map((c) => Math.max(1, c.recommended_days || 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const alloc = cities.map((c, i) => ({
    city: c.name,
    days: Math.max(1, Math.floor((totalDays * weights[i]) / totalWeight)),
    weight: weights[i],
  }));
  let used = alloc.reduce((sum, a) => sum + a.days, 0);
  // Hand leftover days to the highest-weight cities first.
  const byWeight = [...alloc].sort((a, b) => b.weight - a.weight);
  for (let i = 0; used < totalDays; i = (i + 1) % byWeight.length) {
    byWeight[i].days += 1;
    used += 1;
  }
  // More cities than days: trim the largest stays back toward 1 each.
  while (used > totalDays) {
    const biggest = alloc.filter((a) => a.days > 1).sort((a, b) => b.days - a.days)[0];
    if (!biggest) break;
    biggest.days -= 1;
    used -= 1;
  }
  return alloc.map(({ city, days }) => ({ city, days }));
}

// Everything the prompts need to pin cities to days: the traveler's picks,
// their day ranges, and a literal per-day city map. Shared by the main
// country prompt and the continuation prompt so both describe the same plan.
function buildCityPlanContext(trip, candidateCities, numDays) {
  const preferred = (trip.preferred_cities || [])
    .map((name) => candidateCities.find((c) => c.name.toLowerCase() === String(name).toLowerCase()))
    .filter(Boolean);

  const allocation = allocateDaysAcrossCities(preferred, numDays);
  const allocationOverbooked = allocation.reduce((sum, a) => sum + a.days, 0) > numDays;
  const entryPicked = preferred.some((c) => c.name.toLowerCase() === String(trip.entry_city).toLowerCase());

  // Explicit day RANGES, not just counts — models follow "days 1-6" far more
  // faithfully than "6 days", and the ranges are what the form previewed.
  let dayCursor = 1;
  const rangedAllocation = allocation.map((a) => {
    const startDay = dayCursor;
    const endDay = Math.min(numDays, dayCursor + a.days - 1);
    dayCursor = endDay + 1;
    return { ...a, startDay, endDay };
  });

  // A literal per-day city map — the one format the model can't reinterpret.
  const cityOnDay = [];
  for (const a of rangedAllocation) {
    for (let day = a.startDay; day <= a.endDay; day++) cityOnDay[day] = a.city;
  }
  const dayMapLines = [];
  if (preferred.length && !allocationOverbooked) {
    for (let day = 1; day <= numDays; day++) {
      const city = cityOnDay[day] || rangedAllocation[rangedAllocation.length - 1]?.city || trip.entry_city;
      const prev = cityOnDay[day - 1];
      const notes = [];
      if (day === 1) notes.push(`arrive from ${trip.origin} via ${trip.entry_city}`);
      if (prev && prev !== city) notes.push(`first item of the day: travel ${prev} → ${city}`);
      if (day === numDays) notes.push(`depart to ${trip.origin} via ${trip.entry_city} at the end of the day`);
      dayMapLines.push(`day ${day}: ${city}${notes.length ? ` (${notes.join("; ")})` : ""}`);
    }
  }

  return { preferred, rangedAllocation, allocationOverbooked, entryPicked, dayMapLines };
}

// Country-level trip ("Thailand" rather than one city): the AI also has to
// pick which cities to visit and plan the legs between them, so it gets the
// candidate city list instead of a single fixed destination.
function buildCountryPrompt(trip, attractions, candidateCities, mustVisitIds = [], meals = null) {
  const numDays = daysBetween(trip.start_date, trip.end_date);
  const pricingCurrency = trip.currency || "BDT";

  const { preferred, rangedAllocation, allocationOverbooked, entryPicked, dayMapLines } =
    buildCityPlanContext(trip, candidateCities, numDays);

  const describeCity = (c) => {
    const bits = [`recommended ${c.recommended_days} day${c.recommended_days > 1 ? "s" : ""}`];
    if (c.avg_daily_cost) bits.push(`~${c.avg_daily_cost} ${pricingCurrency}/day`);
    if (c.tags?.length) bits.push(`known for: ${c.tags.join(", ")}`);
    return `- ${c.name} (${bits.join(" · ")})${c.summary ? ` — ${c.summary}` : ""}`;
  };
  const cityList = candidateCities.slice(0, MAX_CANDIDATE_CITIES).map(describeCity).join("\n");

  const citySection = preferred.length
    ? `The traveler has ALREADY CHOSEN the cities for this ${numDays}-day trip. Divide the traveler's OWN ${numDays} day(s) between them EXACTLY like this — move to the next city with a "travel" item at the start of its first day:\n${rangedAllocation
        .map((a) => {
          const c = preferred.find((p) => p.name === a.city);
          const bits = [];
          if (c?.avg_daily_cost) bits.push(`~${c.avg_daily_cost} ${pricingCurrency}/day`);
          if (c?.tags?.length) bits.push(`known for: ${c.tags.join(", ")}`);
          const range = a.startDay === a.endDay ? `day ${a.startDay}` : `days ${a.startDay}-${a.endDay}`;
          return `- ${a.city}: ${range}${bits.length ? ` (${bits.join(" · ")})` : ""}`;
        })
        .join("\n")}${
        dayMapLines.length
          ? `\nDay-by-day city map — every item's "city" and "day" must agree with this map:\n${dayMapLines.join("\n")}`
          : ""
      }${
        allocationOverbooked
          ? "\nThe trip is shorter than one day per city — combine nearby cities on the same day where needed, but still set foot in every one."
          : ""
      }${
        entryPicked
          ? ""
          : `\n${trip.entry_city} is only the arrival/departure gateway — pass through it, do not spend the allocated days there.`
      }`
    : `Cities available in ${trip.destination} (choose a sensible subset based on the trip length — short trips should stay in 1-2 cities rather than rushing; longer trips can cover 3+):\n${cityList || "(no cities catalogued — invent well-known real cities in this country)"}`;

  const attractionSection = formatAttractionSection(attractions, mustVisitIds, pricingCurrency);
  const mustSet = new Set(mustVisitIds || []);
  const mustCities = [...new Set(attractions.filter((a) => mustSet.has(String(a._id))).map((a) => a.city))];

  return `You are the itinerary-planning engine for TourGenie AI, a multi-country travel app. The traveler wants a country-wide trip across ${trip.destination} rather than one fixed city — decide which cities to visit and build a realistic multi-city day-by-day itinerary as pure JSON, no markdown, no commentary, no code fences.

Trip details:
- Origin: ${trip.origin}
- Country: ${trip.destination}
- Dates: ${trip.start_date.toISOString().slice(0, 10)} to ${trip.end_date.toISOString().slice(0, 10)} (${numDays} day${numDays > 1 ? "s" : ""})
- Travelers: ${trip.travelers}
- Total budget: ${trip.budget} ${pricingCurrency} for the whole party of ${trip.travelers}${trip.budget_includes_flights === false ? ` — this EXCLUDES the travel to and from ${trip.origin}, so plan on-trip costs only` : ` — this INCLUDES the travel to and from ${trip.origin}`}
- Interests: ${trip.interests?.join(", ") || "none specified"}
- Transport preference: ${trip.transport_preference}
- Hotel preference: ${trip.hotel_preference}
- Food preference: ${trip.food_preference}

${citySection}
${mustCities.length > 0 ? `\nThe cities you choose MUST include: ${mustCities.join(", ")} — the traveler picked specific attractions there (see the attractions list below).` : ""}

${foodPricingSection(trip, meals)}

${trip.entry_city}, is the international gateway city — the trip must begin and end there.

${attractionSection}

Return ONLY a JSON array (no wrapping object, no prose) of itinerary items, one entry per activity, in this exact shape:
[
  { "day": 1, "time": "08:00", "activity": "string", "location": "string", "city": "string — the real city this happens in, must be one of the cities you chose", "est_cost": 0, "attraction_id": "string or null", "category": "travel|meal|sightseeing|activity|rest|shopping", "from_city": "string or null — only set on category=travel items", "to_city": "string or null — only set on category=travel items" }
]
Keep the JSON compact: omit "attraction_id", "from_city" and "to_city" entirely when they would be null — from_city/to_city belong ONLY on travel items.

Rules:
- Cover all ${numDays} day(s), roughly ${numDays >= 8 ? "3-4" : "3-5"} activities per day including at least one meal.
${preferred.length > 0 ? `- Follow the day ranges above exactly (${rangedAllocation.map((a) => `${a.city} ${a.startDay === a.endDay ? `day ${a.startDay}` : `days ${a.startDay}-${a.endDay}`}`).join(", ")}) — they divide the traveler's own travel dates. The first day of each new city starts with a "travel" item carrying from_city, to_city, a realistic transport mode in "activity" and a realistic est_cost.\n` : ""}- Where a THE ONLY ATTRACTIONS ALLOWED list is given, every id in it must appear as an item's attraction_id exactly once in whichever city it belongs to, and NO other sightseeing stop may be scheduled — fill the remaining hours with meals, rest and free time instead.
- Day 1's first item must be a "travel" item with from_city "${trip.origin}" and to_city "${trip.entry_city}" (the international arrival).
- The last day's final item must be a "travel" item with from_city set to whatever city the traveler ends the trip in and to_city "${trip.origin}" (the international departure).
- Whenever the traveler moves between two cities within ${trip.destination}, add a "travel" item on that transition with from_city and to_city set to the two real city names (never the country name), and describe a realistic transport mode in "activity" (e.g. "Overnight train to Chiang Mai", "Domestic flight to Phuket", "Bus to Pattaya") with a realistic est_cost.
- Every item's "city" field must be a real city name, never the country name.
- Keep the sum of est_cost values reasonably within the total budget of ${trip.budget} ${pricingCurrency} across the whole trip for all ${trip.travelers} traveler(s).
- Do NOT write hotel check-in or check-out items. The app adds those itself from the hotel the traveler actually booked, with its name and its real cost.
- time must be 24-hour "HH:MM".
- est_cost is a number in ${pricingCurrency} covering ALL ${trip.travelers} traveler(s) combined — never a per-person figure (0 for free activities).
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

const ITEM_CATEGORIES = [
  "travel",
  "meal",
  "sightseeing",
  "activity",
  "rest",
  "shopping",
  "checkin",
  "checkout",
];

// Words models reach for that mean one of our categories but aren't it.
// Anything unrecognised falls back to "activity" rather than failing the save.
const CATEGORY_ALIASES = {
  transport: "travel",
  transfer: "travel",
  transit: "travel",
  flight: "travel",
  drive: "travel",
  commute: "travel",
  food: "meal",
  dining: "meal",
  breakfast: "meal",
  lunch: "meal",
  dinner: "meal",
  snack: "meal",
  sight: "sightseeing",
  sightsee: "sightseeing",
  tour: "sightseeing",
  visit: "sightseeing",
  attraction: "sightseeing",
  relax: "rest",
  leisure: "rest",
  free: "rest",
  hotel: "checkin",
  accommodation: "checkin",
  "check-in": "checkin",
  "check in": "checkin",
  "check-out": "checkout",
  "check out": "checkout",
  shop: "shopping",
  market: "shopping",
};

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// The model is asked for a strict shape but doesn't always honour it — it
// invents attraction ids ("CB001"), reaches for categories outside our enum
// ("nightlife"), or writes a time range instead of a timestamp. Mongoose
// rejects all of those at insert with a ValidationError, which surfaced to the
// traveler as a bare "Validation failed". Repair what is repairable and drop
// what isn't, so one stray field can't sink a whole generated plan.
export function sanitizeItems(items, attractions = [], mustVisitIds = []) {
  const validAttractionIds = new Set(attractions.map((a) => String(a._id)));
  // When the traveler picked attractions, those are the only ones allowed.
  // The prompt says so, but a prompt is a request and models take liberties —
  // this makes the ceiling real. Empty means they picked none, so the whole
  // catalogue stands.
  const allowed = new Set((mustVisitIds || []).map(String));

  const cleaned = [];
  for (const raw of Array.isArray(items) ? items : []) {
    if (!raw || typeof raw !== "object") continue;

    const activity = String(raw.activity ?? "").trim();
    if (!activity) continue; // required by the schema, and useless without it

    const day = Math.floor(Number(raw.day));
    if (!Number.isFinite(day) || day < 1) continue;

    // "09:00", "9:00", "09:00-09:30" and "09:00 AM" all reduce to "09:00".
    const timeMatch = String(raw.time ?? "").match(/(\d{1,2}):(\d{2})/);
    const time = timeMatch
      ? `${String(Math.min(23, Number(timeMatch[1]))).padStart(2, "0")}:${timeMatch[2]}`
      : "09:00";

    const rawCategory = String(raw.category ?? "").trim().toLowerCase();
    const category = ITEM_CATEGORIES.includes(rawCategory)
      ? rawCategory
      : CATEGORY_ALIASES[rawCategory] || "activity";

    // Only ids that are real, catalogued attractions survive; invented ones
    // become null so the item still stands as a generic activity.
    const attractionId = raw.attraction_id == null ? null : String(raw.attraction_id);
    const attraction_id =
      attractionId && OBJECT_ID_RE.test(attractionId) && validAttractionIds.has(attractionId)
        ? attractionId
        : null;

    // A catalogued sight the traveler did not pick is dropped outright rather
    // than demoted to a generic item: keeping it would leave "Visit the Grand
    // Palace" in the plan with the id stripped off, which is the same
    // complaint with the link removed.
    if (allowed.size > 0 && attraction_id && !allowed.has(attraction_id)) continue;

    // The hotel stay is written by itineraryController from the traveler's
    // actual booking, so anything the model invented here is discarded.
    if (category === "checkin" || category === "checkout") continue;

    const estCost = Number(raw.est_cost);

    cleaned.push({
      day,
      time,
      activity,
      location: String(raw.location ?? "").trim(),
      city: String(raw.city ?? "").trim(),
      from_city: String(raw.from_city ?? "").trim(),
      to_city: String(raw.to_city ?? "").trim(),
      est_cost: Number.isFinite(estCost) && estCost > 0 ? estCost : 0,
      category,
      attraction_id,
    });
  }

  if (cleaned.length === 0) {
    throw new Error("AI returned no usable itinerary items");
  }
  return cleaned.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

function extractJsonArray(text) {
  const trimmed = text.trim();
  const withoutFences = trimmed.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");
  if (start === -1) throw new Error("AI response did not contain a JSON array");
  const raw = end > start ? withoutFences.slice(start, end + 1) : withoutFences.slice(start);
  try {
    return JSON.parse(raw);
  } catch {
    // Repair the two failure shapes these models actually produce: trailing
    // commas, and an array cut off mid-object. Items are flat objects, so
    // every "}" closes a complete item — salvage everything up to the last one.
    const noTrailing = raw.replace(/,\s*([\]}])/g, "$1");
    try {
      return JSON.parse(noTrailing);
    } catch {
      const lastComplete = noTrailing.lastIndexOf("}");
      if (lastComplete > 0) {
        return JSON.parse(noTrailing.slice(0, lastComplete + 1).replace(/,\s*$/, "") + "]");
      }
      throw new Error("AI response was not valid JSON");
    }
  }
}

// Shared helper for any OpenAI-compatible chat completions endpoint
// (OpenAI itself, and Groq, which mirrors the same request/response shape).
async function callOpenAICompatible(prompt, { baseUrl, apiKey, model, providerName, extraBody = {}, retry = true }) {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      // The output is parsed programmatically — a cooler temperature buys
      // JSON discipline, which matters more here than creative variety.
      temperature: 0.4,
      ...extraBody,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // 429 on the free tier is a per-minute token budget that refills in
    // seconds — worth one wait-and-retry before falling through to the next
    // provider, since the request itself is fine.
    const retryAfter = Number(res.headers.get("retry-after")) || Number(body.match(/try again in ([\d.]+)s/)?.[1]);
    // Long trips make several sequential calls (continuation), so a minute-
    // budget refill of up to 60s is worth waiting out rather than failing.
    if (res.status === 429 && retry && retryAfter && retryAfter <= 60) {
      await new Promise((r) => setTimeout(r, (retryAfter + 0.5) * 1000));
      return callOpenAICompatible(prompt, { baseUrl, apiKey, model, providerName, extraBody, retry: false });
    }
    // Rate/size limits are the two failures a traveler can actually act on, so
    // say what happened instead of forwarding the provider's raw JSON.
    if (res.status === 429) {
      throw new Error(
        `${providerName} rate limit reached${retryAfter ? ` — try again in about ${Math.ceil(retryAfter)}s` : " — try again shortly"}`
      );
    }
    if (res.status === 413) {
      throw new Error(
        `${providerName} rejected the request as too large for its per-minute token limit — lower MAX_OPTIONAL_ATTRACTIONS or raise GROQ_TPM_LIMIT to match your plan`
      );
    }
    throw new Error(`${providerName} API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const text = choice?.message?.content;
  if (!text) throw new Error(`${providerName} API returned no text content`);
  if (choice.finish_reason === "length") {
    // The completion budget ran out mid-plan. Salvage every complete item —
    // the continuation loop plans the remaining days in a follow-up call.
    try {
      return extractJsonArray(text);
    } catch {
      throw new Error(`${providerName} response was cut off before the itinerary finished (raise max tokens)`);
    }
  }
  return extractJsonArray(text);
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return callOpenAICompatible(prompt, {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    model: GROQ_MODEL,
    providerName: "Groq",
    // Reasoning models on Groq (gpt-oss, qwen) spend the completion budget on
    // hidden reasoning before emitting any JSON, so without a raised ceiling
    // the response stops mid-array with finish_reason "length". The ceiling is
    // computed from the prompt to stay inside the per-minute token limit.
    extraBody: { max_completion_tokens: groqCompletionBudget(prompt), reasoning_effort: "low" },
  });
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return callOpenAICompatible(prompt, {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    apiKey,
    model: OPENAI_MODEL,
    providerName: "OpenAI",
    extraBody: { max_tokens: 8000 },
  });
}

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Claude API returned no text content");
  return extractJsonArray(text);
}

const PROVIDERS = [
  { name: "Groq", envKey: "GROQ_API_KEY", call: callGroq },
  { name: "Claude", envKey: "ANTHROPIC_API_KEY", call: callClaude },
  { name: "OpenAI", envKey: "OPENAI_API_KEY", call: callOpenAI },
];

async function runProviders(prompt) {
  const configured = PROVIDERS.filter((p) => process.env[p.envKey]);

  if (configured.length === 0) {
    throw new Error(
      "No AI provider is configured. Set GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in your .env file."
    );
  }

  let lastError;
  for (const provider of configured) {
    // Two attempts per provider: free-tier models occasionally emit broken
    // JSON or get cut off, and a fresh sample usually lands — cheaper than
    // failing the whole generation when no fallback provider is configured.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const items = await provider.call(prompt);
        recordProviderCall(provider.name.toLowerCase(), true);
        return { items, provider: provider.name.toLowerCase() };
      } catch (err) {
        console.warn(`${provider.name} itinerary generation failed (attempt ${attempt}):`, err.message);
        // Falling back to the next provider is silent by design; the admin
        // health panel is where that silence is broken.
        recordProviderCall(provider.name.toLowerCase(), false, err.message);
        lastError = err;
      }
    }
  }

  throw lastError;
}

// Asks for the days a truncated plan is missing. Days already planned are
// final; the model only produces day fromDay+1 .. numDays, grounded in where
// the traveler is at the end of the last planned day.
function buildContinuationPrompt(trip, attractions, candidateCities, mustVisitIds, plannedItems, fromDay, numDays, instruction = "", meals = null) {
  const pricingCurrency = trip.currency || trip.destination_id?.pricing_currency || "BDT";
  const lastCity =
    [...plannedItems.filter((i) => i.day === fromDay)].reverse().find((i) => i.city)?.city ||
    (trip.multi_city ? trip.entry_city : trip.destination);
  // Must-visit attractions already scheduled don't need demanding twice.
  const remainingMust = (mustVisitIds || []).filter(
    (id) => !plannedItems.some((i) => String(i.attraction_id) === String(id))
  );
  const attractionSection = formatAttractionSection(attractions, remainingMust, pricingCurrency);

  let cityContext = "";
  if (trip.multi_city) {
    const { dayMapLines } = buildCityPlanContext(trip, candidateCities, numDays);
    const remainingMap = dayMapLines.slice(fromDay); // lines for days fromDay+1 .. numDays
    cityContext = remainingMap.length
      ? `Day-by-day city map for the remaining days — every item's "city" and "day" must agree with it:\n${remainingMap.join("\n")}`
      : `This is a multi-city trip across ${trip.destination}. The trip must end back at ${trip.entry_city} on day ${numDays} for the departure to ${trip.origin}. Use real city names (never the country name) in "city", "from_city" and "to_city".`;
  }

  return `You are the itinerary-planning engine for TourGenie AI. This trip's itinerary already covers days 1-${fromDay} and those days are FINAL — do not repeat or change them. Continue the SAME trip from day ${fromDay + 1} through day ${numDays}, as pure JSON — no markdown, no commentary.

Trip details:
- Origin: ${trip.origin}
- Destination: ${trip.destination}
- Total trip length: ${numDays} days — you are planning days ${fromDay + 1}-${numDays} ONLY
- Travelers: ${trip.travelers}
- Total budget: ${trip.budget} ${pricingCurrency} for the whole party across ALL ${numDays} days
- Interests: ${trip.interests?.join(", ") || "none specified"}
- Food preference: ${trip.food_preference}
${instruction ? `- The traveler's request (already applied to days 1-${fromDay}; keep honouring it): "${instruction}"` : ""}
At the end of day ${fromDay} the traveler is in ${lastCity}.

${cityContext}

${foodPricingSection(trip, meals)}

${attractionSection}

Return ONLY a JSON array of itinerary items covering days ${fromDay + 1} to ${numDays}, in this exact shape:
[
  { "day": ${fromDay + 1}, "time": "08:00", "activity": "string", "location": "string", "city": "string", "est_cost": 0, "attraction_id": "string or null", "category": "travel|meal|sightseeing|activity|rest|shopping", "from_city": "string — travel items only", "to_city": "string — travel items only" }
]
Keep the JSON compact: omit "attraction_id", "from_city" and "to_city" entirely when they would be null.

Rules:
- Plan EVERY day from ${fromDay + 1} to ${numDays}, roughly ${numDays >= 8 ? "3-4" : "3-5"} activities per day including at least one meal. No "day" value outside that range.
- Do NOT write hotel check-in or check-out items. The app adds those itself from the hotel the traveler actually booked, with its name and its real cost.
- time must be 24-hour "HH:MM". est_cost is a number in ${pricingCurrency} covering ALL ${trip.travelers} traveler(s) combined.
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

// One AI call can't always hold a whole month of itinerary — free-tier
// completion budgets cut long plans off around two weeks. Keep asking for
// the missing days until the trip is fully covered.
async function completeItinerary(trip, attractions, candidateCities, mustVisitIds, firstItems, numDays, instruction = "", meals = null) {
  let items = firstItems;
  for (let round = 0; round < 6; round++) {
    const maxDay = items.reduce((max, i) => Math.max(max, i.day), 0);
    if (maxDay >= numDays) return items;

    const prompt = buildContinuationPrompt(trip, attractions, candidateCities, mustVisitIds, items, maxDay, numDays, instruction, meals);
    const { items: more } = await runProviders(prompt);
    const cleaned = sanitizeItems(more, attractions, mustVisitIds).filter((i) => i.day > maxDay && i.day <= numDays);
    if (!cleaned.length) break; // no forward progress — stop rather than loop
    items = [...items, ...cleaned].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  }

  const finalMaxDay = items.reduce((max, i) => Math.max(max, i.day), 0);
  if (finalMaxDay < numDays) {
    throw new Error(`the AI only managed to plan ${finalMaxDay} of ${numDays} days — try again in a minute`);
  }
  return items;
}

export async function generateItineraryWithAI(trip, attractions, candidateCities = [], mustVisitIds = [], meals = null) {
  const numDays = daysBetween(trip.start_date, trip.end_date);
  const prompt = trip.multi_city
    ? buildCountryPrompt(trip, attractions, candidateCities, mustVisitIds, meals)
    : buildPrompt(trip, attractions, mustVisitIds, meals);
  const { items } = await runProviders(prompt);
  const first = sanitizeItems(items, attractions, mustVisitIds);
  const completed = await completeItinerary(trip, attractions, candidateCities, mustVisitIds, first, numDays, "", meals);
  return enforceMealFloors(completed, meals);
}

// FR-05 — Chat Assistant itinerary edits ("make it cheaper", "add a day",
// "vegetarian only"…). Unlike generation, this feeds the existing itinerary
// back in and asks for a revised full plan, so activities the request didn't
// touch stay put rather than the AI starting over from a blank slate.
function buildAdjustmentPrompt(trip, attractions, existingItems, instruction, candidateCities, mustVisitIds = [], meals = null) {
  const numDays = trip.duration_days || daysBetween(trip.start_date, trip.end_date);
  const pricingCurrency = trip.currency || trip.destination_id?.pricing_currency || "BDT";

  const currentItinerary = existingItems
    .map((i) => `day:${i.day} time:${i.time} [${i.category}] ${i.activity} @ ${i.location}${i.city ? ` (${i.city})` : ""} — cost ${i.est_cost} ${pricingCurrency}`)
    .join("\n");

  const attractionSection = formatAttractionSection(attractions, mustVisitIds, pricingCurrency);

  const cityContext = trip.multi_city
    ? `This is a multi-city trip across ${trip.destination}. Cities available:\n${candidateCities
        .map((c) => `- ${c.name} (recommended ${c.recommended_days} day${c.recommended_days > 1 ? "s" : ""})`)
        .join("\n")}\n${trip.entry_city} is the international gateway — the trip must still begin and end there. Keep using real city names (never the country name) in "city", "from_city" and "to_city".${
        trip.preferred_cities?.length
          ? `\nThe traveler chose to visit: ${trip.preferred_cities.join(", ")} — every one of these cities must stay in the revised plan unless the request explicitly says to drop one.`
          : ""
      }`
    : `Destination: ${trip.destination}.`;

  return `You are the itinerary-adjustment engine for TourGenie AI's chat assistant. A traveler already has the itinerary below for their trip and just asked, in chat, for a change. Apply their request and output the FULL revised itinerary as pure JSON — no markdown, no commentary, no code fences.

Trip details:
- Origin: ${trip.origin}
- ${cityContext}
- Trip length: ${numDays} day${numDays > 1 ? "s" : ""} (change this only if the request explicitly asks to add/remove days)
- Travelers: ${trip.travelers}
- Total budget: ${trip.budget} ${pricingCurrency} for the whole party of ${trip.travelers}${trip.budget_includes_flights === false ? ` — this EXCLUDES the travel to and from ${trip.origin}, so plan on-trip costs only` : ` — this INCLUDES the travel to and from ${trip.origin}`}

Current itinerary:
${currentItinerary || "(empty — nothing planned yet)"}

Traveler's request: "${instruction}"

${foodPricingSection(trip, meals)}

${attractionSection}

Return ONLY a JSON array (no wrapping object, no prose) of itinerary items, one entry per activity, in this exact shape:
[
  { "day": 1, "time": "08:00", "activity": "string", "location": "string", "city": "string or null", "est_cost": 0, "attraction_id": "string or null", "category": "travel|meal|sightseeing|activity|rest|shopping", "from_city": "string or null — only for category=travel", "to_city": "string or null — only for category=travel" }
]
Keep the JSON compact: omit "attraction_id", "from_city" and "to_city" entirely when they would be null — from_city/to_city belong ONLY on travel items.

Rules:
- Apply the traveler's request faithfully — that might mean changing costs, adding/removing a day, changing pace, swapping meals, or adding rainy-day alternatives.
- Where a THE ONLY ATTRACTIONS ALLOWED list is given, every id in it must still appear as an item's attraction_id exactly once and no other sightseeing may be introduced — the traveler picked those specifically, so keep them even while applying the requested change.
- Keep everything the request didn't ask you to change as close to the original as makes sense.
- Output a complete itinerary covering every day of the (possibly changed) trip length — not just the days you touched.
- Do NOT write hotel check-in or check-out items. The app adds those itself from the hotel the traveler actually booked, with its name and its real cost.
- time must be 24-hour "HH:MM". est_cost is a number in ${pricingCurrency} covering ALL ${trip.travelers} traveler(s) combined — never a per-person figure (0 for free activities).
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

export async function adjustItineraryWithAI(trip, attractions, existingItems, instruction, candidateCities = [], mustVisitIds = [], meals = null) {
  const numDays = trip.duration_days || daysBetween(trip.start_date, trip.end_date);
  const prompt = buildAdjustmentPrompt(trip, attractions, existingItems, instruction, candidateCities, mustVisitIds, meals);
  const { items, provider } = await runProviders(prompt);
  let cleaned = sanitizeItems(items, attractions, mustVisitIds);

  // A long trip's revised plan can also outgrow one completion. Top up only
  // when the result is clearly truncated (more than one day short) — a plan
  // exactly one day shorter may be a deliberate "remove a day" request.
  const maxDay = cleaned.reduce((max, i) => Math.max(max, i.day), 0);
  if (maxDay < numDays - 1) {
    cleaned = await completeItinerary(trip, attractions, candidateCities, mustVisitIds, cleaned, numDays, instruction, meals);
  }
  return { items: enforceMealFloors(cleaned, meals), provider };
}
