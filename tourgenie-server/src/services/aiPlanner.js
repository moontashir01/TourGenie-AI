// FR-04 — AI Itinerary Generation.
// Tries providers in order of preference, skipping any without a
// configured key, and falling through to the next on failure (NFR-06:
// "the AI layer falls back to a secondary provider if the primary fails").
// Order: Groq (fast, free tier) -> Claude (primary per the SRS) -> OpenAI.

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

// Splits the catalog into "the traveler explicitly picked this" (hard
// requirement) vs "available, use at your discretion" — so a traveler who
// picked specific attractions actually gets them, rather than the AI being
// free to swap in whatever it likes.
function formatAttractionSection(attractions, mustVisitIds, pricingCurrency) {
  const mustSet = new Set(mustVisitIds || []);
  const describe = (a) =>
    `- id:${a._id} | ${a.name} (${a.category}) in ${a.city} | entry fee ${a.entry_fee} ${a.currency || pricingCurrency} | hours: ${a.open_hours}`;

  const must = attractions.filter((a) => mustSet.has(String(a._id)));
  // Free-tier Groq caps tokens per minute, so the optional catalog is capped
  // too — a country with 60+ catalogued attractions would otherwise push the
  // prompt past the limit on its own. Must-visits are never trimmed.
  const optional = attractions
    .filter((a) => !mustSet.has(String(a._id)))
    .slice(0, MAX_OPTIONAL_ATTRACTIONS);

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
- Total budget: ${trip.budget} ${pricingCurrency} for the whole party of ${trip.travelers}${trip.budget_includes_flights === false ? ` — this EXCLUDES the travel to and from ${trip.origin}, so plan on-trip costs only` : ` — this INCLUDES the travel to and from ${trip.origin}`}
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
- Keep the sum of est_cost values reasonably within the total budget of ${trip.budget} ${pricingCurrency} across the whole trip for all ${trip.travelers} traveler(s).
- time must be 24-hour "HH:MM".
- est_cost is a number in ${pricingCurrency} covering ALL ${trip.travelers} traveler(s) combined — never a per-person figure (0 for free activities).
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
    .slice(0, MAX_CANDIDATE_CITIES)
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
- Total budget: ${trip.budget} ${pricingCurrency} for the whole party of ${trip.travelers}${trip.budget_includes_flights === false ? ` — this EXCLUDES the travel to and from ${trip.origin}, so plan on-trip costs only` : ` — this INCLUDES the travel to and from ${trip.origin}`}
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
- Keep the sum of est_cost values reasonably within the total budget of ${trip.budget} ${pricingCurrency} across the whole trip for all ${trip.travelers} traveler(s).
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
export function sanitizeItems(items, attractions = []) {
  const validAttractionIds = new Set(attractions.map((a) => String(a._id)));

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
  if (start === -1 || end === -1) throw new Error("AI response did not contain a JSON array");
  return JSON.parse(withoutFences.slice(start, end + 1));
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
      temperature: 0.7,
      ...extraBody,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // 429 on the free tier is a per-minute token budget that refills in
    // seconds — worth one wait-and-retry before falling through to the next
    // provider, since the request itself is fine.
    const retryAfter = Number(res.headers.get("retry-after")) || Number(body.match(/try again in ([\d.]+)s/)?.[1]);
    if (res.status === 429 && retry && retryAfter && retryAfter <= 25) {
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
    throw new Error(`${providerName} response was cut off before the itinerary finished (raise max tokens)`);
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
  return sanitizeItems(items, attractions);
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
- Total budget: ${trip.budget} ${pricingCurrency} for the whole party of ${trip.travelers}${trip.budget_includes_flights === false ? ` — this EXCLUDES the travel to and from ${trip.origin}, so plan on-trip costs only` : ` — this INCLUDES the travel to and from ${trip.origin}`}

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
- time must be 24-hour "HH:MM". est_cost is a number in ${pricingCurrency} covering ALL ${trip.travelers} traveler(s) combined — never a per-person figure (0 for free activities).
- Only use attraction_id values from the lists above, or null.
- Output valid JSON only — it will be parsed programmatically.`;
}

export async function adjustItineraryWithAI(trip, attractions, existingItems, instruction, candidateCities = [], mustVisitIds = []) {
  const prompt = buildAdjustmentPrompt(trip, attractions, existingItems, instruction, candidateCities, mustVisitIds);
  const { items, provider } = await runProviders(prompt);
  return { items: sanitizeItems(items, attractions), provider };
}
