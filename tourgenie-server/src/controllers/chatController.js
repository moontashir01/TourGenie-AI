// FR-05 — AI Chat Assistant.
//
// Every message is matched against ChatIntent (regex, then keyword fallback).
// "explain"/"none" intents are answered straight from the matched intent's
// response_template — no AI call, works with zero provider keys configured.
// The itinerary-editing intents (reduce_budget, add_day, filter_food…) call
// the AI planner with the traveler's own words as the instruction and the
// current itinerary as context, then replace the itinerary with the result —
// the same persistence path FR-04 generation uses.
import ChatSession from "../models/ChatSession.js";
import ChatIntent from "../models/ChatIntent.js";
import Trip from "../models/Trip.js";
import ItineraryItem from "../models/ItineraryItem.js";
import { adjustItineraryWithAI } from "../services/aiPlanner.js";
import { planWeatherSwaps } from "../services/weatherRewriter.js";
import { parseTripQuery, buildTripEstimate, describeEstimate } from "../services/tripEstimator.js";
import { getVirtualExpenses } from "./expenseController.js";
import { loadAttractionContext, augmentTravelItems, persistItinerary } from "./itineraryController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolveTrip, VIEW, OWN } from "../services/tripAccess.js";

const MUTATING_ACTIONS = new Set([
  "reduce_budget",
  "increase_budget",
  "add_day",
  "remove_day",
  "filter_food",
  "reorder_day",
  "add_activity",
]);

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined && vars[key] !== null ? vars[key] : ""));
}

async function matchIntent(message) {
  const intents = await ChatIntent.find({ is_active: true }).sort({ priority: -1 });

  for (const intent of intents) {
    for (const pattern of intent.patterns) {
      let regex;
      try {
        regex = new RegExp(pattern, "i");
      } catch {
        continue; // a malformed seeded pattern shouldn't break matching
      }
      if (regex.test(message)) return intent;
    }
  }

  const lower = message.toLowerCase();
  for (const intent of intents) {
    if (intent.keywords.some((k) => lower.includes(k.toLowerCase()))) return intent;
  }

  return intents.find((i) => i.code === "fallback") || intents[intents.length - 1] || null;
}

async function totalCostFor(trip) {
  const virtuals = await getVirtualExpenses(trip);
  // Same rule the Budget page uses: an airfare the traveler excluded from
  // the budget is shown but not counted against it.
  return virtuals
    .filter((e) => e.counts_toward_budget !== false)
    .reduce((sum, e) => sum + e.amount, 0);
}

async function loadTripWithHotels(tripId, userId) {
  return resolveTrip(tripId, userId, {
    level: VIEW,
    populate: [
      "hotel_id",
      "hotel_selections.hotel_id",
      ["destination_id", "name country country_code currency pricing_currency timezone"],
    ],
  });
}

async function applyItineraryEdit(trip, instruction) {
  const beforeTotal = await totalCostFor(trip);
  const beforeCount = await ItineraryItem.countDocuments({ trip_id: trip._id });

  const { attractions, candidateCities, mustVisitIds, mealGuidance } = await loadAttractionContext(trip);
  const existingItems = await ItineraryItem.find({ trip_id: trip._id }).sort({ day: 1, time: 1 });

  const { items, provider } = await adjustItineraryWithAI(trip, attractions, existingItems, instruction, candidateCities, mustVisitIds, mealGuidance);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("the AI returned an empty or invalid itinerary");
  }

  await augmentTravelItems(items, trip);
  const created = await persistItinerary(trip, items);

  const tripAfter = await loadTripWithHotels(trip._id, trip.user_id);
  const afterTotal = await totalCostFor(tripAfter);
  const days = created.reduce((max, i) => Math.max(max, i.day), trip.duration_days || 0);

  return {
    provider,
    total_cost: afterTotal,
    days,
    saved: Math.max(0, beforeTotal - afterTotal),
    applied_changes: {
      action: "",
      items_added: Math.max(0, created.length - beforeCount),
      items_removed: Math.max(0, beforeCount - created.length),
      items_updated: Math.min(beforeCount, created.length),
      cost_delta: afterTotal - beforeTotal,
    },
  };
}

function buildWeatherReply(result) {
  const lines = [result.summary];

  for (const swap of result.swaps.slice(0, 6)) {
    lines.push(`• Day ${swap.day}, ${swap.time} — "${swap.from.activity}" → ${swap.to.activity} (${swap.to.detail})`);
  }
  if (result.swaps.length > 6) {
    lines.push(`• …and ${result.swaps.length - 6} more`);
  }
  for (const miss of result.unmatched.slice(0, 3)) {
    lines.push(`• Day ${miss.day}, ${miss.time} — "${miss.activity}": ${miss.reason}`);
  }

  return lines.join("\n");
}


/**
 * "I want to go to Sajek for 3 days" — a question about a place, not an
 * instruction to edit a plan.
 *
 * This runs before every other branch because the failure it prevents is the
 * worst one available: the add-an-activity pattern matches "i want to go
 * to…", so naming any destination used to rewrite whatever itinerary
 * happened to be open. A first-time user with no trip got that too, against
 * whichever trip id was left in their browser.
 *
 * Returns null when the message is genuinely about the open trip, so normal
 * editing is untouched.
 */
async function tryPlanEnquiry({ message, trip, user, intent }) {
  const explicit = intent.action?.type === "plan_enquiry";
  const parsed = await parseTripQuery(message, { defaultOrigin: user.city || "Dhaka" });

  if (!parsed.destination) {
    // "How much will this cost?" with a trip open is a question about that
    // trip. plan_enquiry outranks ask_budget in the match, so it has to hand
    // the message over rather than just decline.
    if (trip) return { delegateTo: "ask_budget" };
    if (!explicit) return null;
    const examples = parsed.known_destinations
      .filter((d) => !d.is_international)
      .slice(0, 4)
      .map((d) => d.name)
      .join(", ");
    return {
      reply:
        "Tell me where you're thinking of going and I'll work out what it costs — " +
        `something like "3 days in Cox's Bazar for 2 people". I have figures for ${parsed.known_destinations.length} destinations, including ${examples}.`,
      source: "database",
    };
  }

  // A message about the trip already open belongs to the normal edit flow.
  if (!explicit && trip) {
    const tripPlaces = [trip.destination, trip.entry_city].filter(Boolean).map((n) => n.toLowerCase());
    if (tripPlaces.includes(parsed.destination.name.toLowerCase())) return null;
  }

  const estimate = await buildTripEstimate({
    destination: parsed.destination,
    days: parsed.days,
    travelers: parsed.travelers,
    tier: parsed.tier,
    origin: parsed.origin,
  });

  const { reply, source } = await describeEstimate(estimate);

  // Naming a different place while a trip is open is ambiguous — answer the
  // question, then say plainly that nothing was changed.
  const note =
    trip && trip.destination.toLowerCase() !== parsed.destination.name.toLowerCase()
      ? `\n\n_Your ${trip.destination} trip hasn't been changed. Use Plan New Trip to start a ${parsed.destination.name} one._`
      : "\n\n_Ready to book it? Use Plan New Trip and I'll build the day-by-day plan._";

  return { reply: reply + note, source, estimate };
}

async function findOrCreateSession({ userId, tripId, sessionId }) {
  if (sessionId) {
    const existing = await ChatSession.findOne({ _id: sessionId, user_id: userId });
    if (existing) return existing;
  }
  if (tripId) {
    const existing = await ChatSession.findOne({ user_id: userId, trip_id: tripId }).sort({ last_message_at: -1 });
    if (existing) return existing;
  }
  return new ChatSession({ user_id: userId, trip_id: tripId || null });
}

export const getQuickActions = asyncHandler(async (req, res) => {
  const intents = await ChatIntent.find({ is_active: true, is_quick_action: true }).sort({ quick_action_order: 1 });
  res.json({
    quick_actions: intents.map((i) => ({ code: i.code, label: i.quick_action_label })),
  });
});

export const getSession = asyncHandler(async (req, res) => {
  const filter = { user_id: req.user._id };
  if (req.query.trip_id) filter.trip_id = req.query.trip_id;
  const session = await ChatSession.findOne(filter).sort({ last_message_at: -1 });
  res.json({ session: session || null });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const message = req.body.message?.trim();
  if (!message) return res.status(400).json({ message: "message is required" });

  const tripId = req.body.trip_id || null;
  let trip = null;
  let role = null;
  if (tripId) {
    ({ trip, role } = await loadTripWithHotels(tripId, req.user._id));
    if (!trip) return res.status(404).json({ message: "Trip not found" });
  }

  // A chat edit doesn't patch the plan — it regenerates it, deleting and
  // recreating every row. Two people doing that at once would silently throw
  // one of them away, so for now the AI may only rewrite the owner's plan.
  // Everyone with access can still ask it questions.
  const mayEditWithAI = role === OWN;

  let intent = await matchIntent(message);
  if (!intent) return res.status(500).json({ message: "No chat intents are configured — run the seed script." });

  const vars = {
    traveler_name: req.user.name,
    destination: trip?.destination || "",
    days: trip?.duration_days || "",
    budget: trip?.budget || "",
    saved: 0,
    total_cost: 0,
  };

  let replyText;
  let source = "database";
  let appliedChanges = null;

  let enquiry = await tryPlanEnquiry({ message, trip, user: req.user, intent });

  // A handover replaces the matched intent and re-enters the normal flow.
  if (enquiry?.delegateTo) {
    const delegate = await ChatIntent.findOne({ code: enquiry.delegateTo, is_active: true });
    if (delegate) intent = delegate;
    enquiry = null;
  }

  if (enquiry) {
    replyText = enquiry.reply;
    source = enquiry.source;
  } else if (intent.requires_trip && !trip) {
    replyText = "I need an active trip to work with first — open one from your dashboard, then tell me what you'd like to change.";
  } else if (intent.action.type === "swap_weather_dependent" && trip && !mayEditWithAI) {
    replyText = "Only the owner of a shared trip can have the assistant reshuffle it for the weather.";
  } else if (intent.action.type === "swap_weather_dependent" && trip) {
    // FR-05 × FR-11 × FR-12, answered from stored data: the forecast picks
    // the days, weather_dependent picks the activities, is_indoor picks the
    // replacements. dry_run false means the traveler asked to apply it.
    const result = await planWeatherSwaps(trip, { apply: intent.action.params?.dry_run === false });
    replyText = buildWeatherReply(result);
    if (result.applied) {
      vars.total_cost = await totalCostFor(trip);
      appliedChanges = {
        action: "swap_weather_dependent",
        items_added: 0,
        items_removed: 0,
        items_updated: result.swaps.length,
        cost_delta: Math.round(result.cost_delta || 0),
      };
    }
  } else if (MUTATING_ACTIONS.has(intent.action.type) && trip && !mayEditWithAI) {
    replyText =
      "This trip is shared with you, and AI edits rewrite the whole itinerary — so only its owner can make them here. " +
      "You can still add, move and remove activities yourself on the Itinerary page.";
  } else if (MUTATING_ACTIONS.has(intent.action.type) && trip) {
    try {
      const result = await applyItineraryEdit(trip, message);
      source = result.provider;
      vars.saved = result.saved;
      vars.total_cost = result.total_cost;
      vars.days = result.days;
      appliedChanges = { ...result.applied_changes, action: intent.action.type };
      replyText = fillTemplate(intent.response_template, vars);
    } catch (err) {
      replyText = `I couldn't apply that change (${err.message}). Your itinerary hasn't been modified — try rephrasing, or check that an AI provider key is configured on the server.`;
    }
  } else {
    if (trip) vars.total_cost = await totalCostFor(trip);
    replyText = fillTemplate(intent.response_template, vars);
  }

  const session = await findOrCreateSession({ userId: req.user._id, tripId, sessionId: req.body.session_id });
  session.messages.push({ role: "user", content: message });
  session.messages.push({
    role: "assistant",
    content: replyText,
    intent_code: intent.code,
    source,
    applied_changes: appliedChanges,
  });
  session.last_message_at = new Date();
  if (tripId && !session.trip_id) session.trip_id = tripId;
  await session.save();

  res.json({
    reply: replyText,
    intent_code: intent.code,
    source,
    applied_changes: appliedChanges,
    followup_suggestions: intent.followup_suggestions,
    session_id: session._id,
  });
});
