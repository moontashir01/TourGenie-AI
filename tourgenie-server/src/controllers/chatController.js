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
import { getVirtualExpenses } from "./expenseController.js";
import { loadAttractionContext, augmentTravelItems, persistItinerary } from "./itineraryController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const MUTATING_ACTIONS = new Set([
  "reduce_budget",
  "increase_budget",
  "add_day",
  "remove_day",
  "filter_food",
  "swap_weather_dependent",
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
  return Trip.findOne({ _id: tripId, user_id: userId })
    .populate("hotel_id")
    .populate("hotel_selections.hotel_id")
    .populate("destination_id", "name country country_code currency pricing_currency timezone");
}

async function applyItineraryEdit(trip, instruction) {
  const beforeTotal = await totalCostFor(trip);
  const beforeCount = await ItineraryItem.countDocuments({ trip_id: trip._id });

  const { attractions, candidateCities, mustVisitIds } = await loadAttractionContext(trip);
  const existingItems = await ItineraryItem.find({ trip_id: trip._id }).sort({ day: 1, time: 1 });

  const { items, provider } = await adjustItineraryWithAI(trip, attractions, existingItems, instruction, candidateCities, mustVisitIds);
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
  if (tripId) {
    trip = await loadTripWithHotels(tripId, req.user._id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
  }

  const intent = await matchIntent(message);
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

  if (intent.requires_trip && !trip) {
    replyText = "I need an active trip to work with first — open one from your dashboard, then tell me what you'd like to change.";
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
