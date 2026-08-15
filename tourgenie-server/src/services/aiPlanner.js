// FR-04 — AI Itinerary Generation.
// Tries providers in order of preference, skipping any without a
// configured key, and falling through to the next on failure (NFR-06:
// "the AI layer falls back to a secondary provider if the primary fails").
// Order: Groq (fast, free tier) -> Claude (primary per the SRS) -> OpenAI.

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function daysBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

// Splits the catalog into "the traveler explicitly picked this" (hard
// requirement) vs "available, use at your discretion" — so a traveler who
// picked specific attractions actually gets them, rather than the AI being
// free to swap in whatever it likes.
function formatAttractionSection(attractions, mustVisitIds, pricingCurrency) {
  const mustSet = new Set(mustVisitIds || []);
  const describe = (a) =>
    `- id:${a._id} | ${a.name} (${a.category}) in ${a.city} | entry fee ${a.entry_fee} ${a.currency || pricingCurrency} | hours: ${a.open_hours}`;

  const must = attractions.filter((a) => mustSet.has(String(a._id)));
  const optional = attractions.filter((a) => !mustSet.has(String(a._id)));

  const parts = [];
  if (must.length > 0) {
    parts.push(
      `MUST INCLUDE — the traveler specifically picked these; every one of them must appear as an item's attraction_id exactly once somewhere in the itinerary:\n${must.map(describe).join("\n")}`
    );
  }
  parts.push(
    `${must.length > 0 ? "Other attractions available (optional — use where they fit, no obligation to include them)" : "Attractions available (use these where relevant via their id in attraction_id; you may also add generic activities like meals or travel legs with attraction_id null)"}:\n${
      optional.map(describe).join("\n") || "(none — invent reasonable generic activities and note costs are estimates)"
    }`
  );
  return parts.join("\n\n");
}

function buildPrompt(trip, attractions, mustVisitIds = []) {
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
- Total budget: ${trip.budget} ${pricingCurrency}
- Interests: ${trip.interests?.join(", ") || "none specified"}
- Transport preference: ${trip.transport_preference}
- Hotel preference: ${trip.hotel_preference}
- Food preference: ${trip.food_preference}

${attractionSection}

Return ONLY a JSON array (no wrapping object, no prose) of itinerary items, one entry per activity, in this exact shape:
[
  { "day": 1, "time": "08:00", "activity": "string", "location": "string", "est_cost": 0, "attraction_id": "string or null", "category": "travel|meal|sightseeing|activity|rest|shopping|checkin|checkout" }
]

Rules:
- Cover all ${numDays} day(s), roughly 3-5 activities per day including at least one meal.
- Every attraction id listed under MUST INCLUDE (if any) must appear as an item's attraction_id exactly once, scheduled at a sensible time given its open hours.
- Keep the sum of est_cost values reasonably within the total budget of ${trip.budget} ${pricingCurrency} across the whole trip.
- time must be 24-hour "HH:MM".
- est_cost is a number in ${pricingCurrency} (0 for free activities).
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

// Country-level trip ("Thailand" rather than one city): the AI also has to
// pick which cities to visit and plan the legs between them, so it gets the
// candidate city list instead of a single fixed destination.
function buildCountryPrompt(trip, attractions, candidateCities, mustVisitIds = []) {
  const numDays = daysBetween(trip.start_date, trip.end_date);
  const pricingCurrency = trip.currency || "BDT";

  const cityList = candidateCities
    .map((c) => {
      const bits = [`recommended ${c.recommended_days} day${c.recommended_days > 1 ? "s" : ""}`];
      if (c.avg_daily_cost) bits.push(`~${c.avg_daily_cost} ${pricingCurrency}/day`);
      if (c.tags?.length) bits.push(`known for: ${c.tags.join(", ")}`);
      return `- ${c.name} (${bits.join(" · ")})${c.summary ? ` — ${c.summary}` : ""}`;
    })
    .join("\n");

  const attractionSection = formatAttractionSection(attractions, mustVisitIds, pricingCurrency);
  const mustSet = new Set(mustVisitIds || []);
  const mustCities = [...new Set(attractions.filter((a) => mustSet.has(String(a._id))).map((a) => a.city))];

  return `You are the itinerary-planning engine for TourGenie AI, a multi-country travel app. The traveler wants a country-wide trip across ${trip.destination} rather than one fixed city — decide which cities to visit and build a realistic multi-city day-by-day itinerary as pure JSON, no markdown, no commentary, no code fences.

Trip details:
- Origin: ${trip.origin}
- Country: ${trip.destination}
- Dates: ${trip.start_date.toISOString().slice(0, 10)} to ${trip.end_date.toISOString().slice(0, 10)} (${numDays} day${numDays > 1 ? "s" : ""})
- Travelers: ${trip.travelers}
- Total budget: ${trip.budget} ${pricingCurrency}
- Interests: ${trip.interests?.join(", ") || "none specified"}
- Transport preference: ${trip.transport_preference}
- Hotel preference: ${trip.hotel_preference}
- Food preference: ${trip.food_preference}

Cities available in ${trip.destination} (choose a sensible subset based on the trip length — short trips should stay in 1-2 cities rather than rushing; longer trips can cover 3+):
${cityList || "(no cities catalogued — invent well-known real cities in this country)"}
${mustCities.length > 0 ? `\nThe cities you choose MUST include: ${mustCities.join(", ")} — the traveler picked specific attractions there (see MUST INCLUDE below).` : ""}

${trip.entry_city}, is the international gateway city — the trip must begin and end there.

${attractionSection}

Return ONLY a JSON array (no wrapping object, no prose) of itinerary items, one entry per activity, in this exact shape:
[
  { "day": 1, "time": "08:00", "activity": "string", "location": "string", "city": "string — the real city this happens in, must be one of the cities you chose", "est_cost": 0, "attraction_id": "string or null", "category": "travel|meal|sightseeing|activity|rest|shopping|checkin|checkout", "from_city": "string or null — only set on category=travel items", "to_city": "string or null — only set on category=travel items" }
]

Rules:
- Cover all ${numDays} day(s), roughly 3-5 activities per day including at least one meal.
- Every attraction id listed under MUST INCLUDE (if any) must appear as an item's attraction_id exactly once, in whichever city it belongs to.
- Day 1's first item must be a "travel" item with from_city "${trip.origin}" and to_city "${trip.entry_city}" (the international arrival).
- The last day's final item must be a "travel" item with from_city set to whatever city the traveler ends the trip in and to_city "${trip.origin}" (the international departure).
- Whenever the traveler moves between two cities within ${trip.destination}, add a "travel" item on that transition with from_city and to_city set to the two real city names (never the country name), and describe a realistic transport mode in "activity" (e.g. "Overnight train to Chiang Mai", "Domestic flight to Phuket", "Bus to Pattaya") with a realistic est_cost.
- Every item's "city" field must be a real city name, never the country name.
- Keep the sum of est_cost values reasonably within the total budget of ${trip.budget} ${pricingCurrency} across the whole trip.
- time must be 24-hour "HH:MM".
- est_cost is a number in ${pricingCurrency} (0 for free activities).
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

function extractJsonArray(text) {
  const trimmed = text.trim();
  const withoutFences = trimmed.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI response did not contain a JSON array");
  return JSON.parse(withoutFences.slice(start, end + 1));
}

// Shared helper for any OpenAI-compatible chat completions endpoint
// (OpenAI itself, and Groq, which mirrors the same request/response shape).
async function callOpenAICompatible(prompt, { baseUrl, apiKey, model, providerName }) {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${providerName} API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${providerName} API returned no text content`);
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
      max_tokens: 2000,
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
    try {
      const items = await provider.call(prompt);
      return { items, provider: provider.name.toLowerCase() };
    } catch (err) {
      console.warn(`${provider.name} itinerary generation failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError;
}

export async function generateItineraryWithAI(trip, attractions, candidateCities = [], mustVisitIds = []) {
  const prompt = trip.multi_city
    ? buildCountryPrompt(trip, attractions, candidateCities, mustVisitIds)
    : buildPrompt(trip, attractions, mustVisitIds);
  const { items } = await runProviders(prompt);
  return items;
}

// FR-05 — Chat Assistant itinerary edits ("make it cheaper", "add a day",
// "vegetarian only"…). Unlike generation, this feeds the existing itinerary
// back in and asks for a revised full plan, so activities the request didn't
// touch stay put rather than the AI starting over from a blank slate.
function buildAdjustmentPrompt(trip, attractions, existingItems, instruction, candidateCities, mustVisitIds = []) {
  const numDays = trip.duration_days || daysBetween(trip.start_date, trip.end_date);
  const pricingCurrency = trip.currency || trip.destination_id?.pricing_currency || "BDT";

  const currentItinerary = existingItems
    .map((i) => `day:${i.day} time:${i.time} [${i.category}] ${i.activity} @ ${i.location}${i.city ? ` (${i.city})` : ""} — cost ${i.est_cost} ${pricingCurrency}`)
    .join("\n");

  const attractionSection = formatAttractionSection(attractions, mustVisitIds, pricingCurrency);

  const cityContext = trip.multi_city
    ? `This is a multi-city trip across ${trip.destination}. Cities available:\n${candidateCities
        .map((c) => `- ${c.name} (recommended ${c.recommended_days} day${c.recommended_days > 1 ? "s" : ""})`)
        .join("\n")}\n${trip.entry_city} is the international gateway — the trip must still begin and end there. Keep using real city names (never the country name) in "city", "from_city" and "to_city".`
    : `Destination: ${trip.destination}.`;

  return `You are the itinerary-adjustment engine for TourGenie AI's chat assistant. A traveler already has the itinerary below for their trip and just asked, in chat, for a change. Apply their request and output the FULL revised itinerary as pure JSON — no markdown, no commentary, no code fences.

Trip details:
- Origin: ${trip.origin}
- ${cityContext}
- Trip length: ${numDays} day${numDays > 1 ? "s" : ""} (change this only if the request explicitly asks to add/remove days)
- Travelers: ${trip.travelers}
- Total budget: ${trip.budget} ${pricingCurrency}

Current itinerary:
${currentItinerary || "(empty — nothing planned yet)"}

Traveler's request: "${instruction}"

${attractionSection}

Return ONLY a JSON array (no wrapping object, no prose) of itinerary items, one entry per activity, in this exact shape:
[
  { "day": 1, "time": "08:00", "activity": "string", "location": "string", "city": "string or null", "est_cost": 0, "attraction_id": "string or null", "category": "travel|meal|sightseeing|activity|rest|shopping|checkin|checkout", "from_city": "string or null — only for category=travel", "to_city": "string or null — only for category=travel" }
]

Rules:
- Apply the traveler's request faithfully — that might mean changing costs, adding/removing a day, changing pace, swapping meals, or adding rainy-day alternatives.
- Every attraction id listed under MUST INCLUDE (if any) must still appear as an item's attraction_id exactly once — the traveler picked those specifically, so keep them even while applying the requested change.
- Keep everything the request didn't ask you to change as close to the original as makes sense.
- Output a complete itinerary covering every day of the (possibly changed) trip length — not just the days you touched.
- time must be 24-hour "HH:MM". est_cost is a number in ${pricingCurrency} (0 for free activities).
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

export async function adjustItineraryWithAI(trip, attractions, existingItems, instruction, candidateCities = [], mustVisitIds = []) {
  const prompt = buildAdjustmentPrompt(trip, attractions, existingItems, instruction, candidateCities, mustVisitIds);
  return runProviders(prompt);
}
