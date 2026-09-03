// What a catalogue record is holding up, and what deleting it would do.
//
// Catalogue rows are referenced by things that outlive them: a trip names a
// destination, a ticket names a schedule, a review names an attraction. The
// portal answers three questions here — what points at this, may it be
// removed outright, and what does "delete" mean if not.
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import HotelBooking from "../models/HotelBooking.js";
import ItineraryItem from "../models/ItineraryItem.js";
import Review from "../models/Review.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import Destination from "../models/Destination.js";
import TransportOption from "../models/TransportOption.js";
import HotelRate from "../models/HotelRate.js";
import Expense from "../models/Expense.js";
import PackingList from "../models/PackingList.js";
import ChatSession from "../models/ChatSession.js";
import Route from "../models/Route.js";

/**
 * Everything pointing at one record, as { label, count } rows.
 *
 * A "blocking" reference is one that would be left broken by a hard delete —
 * a ticket someone holds, a review someone wrote. A non-blocking one is
 * merely informative, like how many hotels sit in a city.
 */
export async function referencesTo(kind, doc) {
  const id = doc._id;

  if (kind === "destination") {
    const [trips, attractions, hotels, transport] = await Promise.all([
      Trip.countDocuments({ $or: [{ destination_id: id }, { destination: doc.name }] }),
      Attraction.countDocuments({ destination_id: id, deleted_at: null }),
      Hotel.countDocuments({ destination_id: id, deleted_at: null }),
      TransportOption.countDocuments({
        $or: [{ from_destination_id: id }, { to_destination_id: id }],
        deleted_at: null,
      }),
    ]);
    // All four block. An earlier version treated the catalogue children as
    // merely informative, and hard-deleting a city with sixteen attractions,
    // hotels and schedules hanging off it stranded every one of them — the
    // exact failure these guards exist to prevent.
    return [
      { label: "trips", count: trips, blocking: true },
      { label: "attractions", count: attractions, blocking: true },
      { label: "hotels", count: hotels, blocking: true },
      { label: "transport schedules", count: transport, blocking: true },
    ];
  }

  if (kind === "attraction") {
    const [reviews, items] = await Promise.all([
      Review.countDocuments({ attraction_id: id }),
      ItineraryItem.countDocuments({ attraction_id: id }),
    ]);
    return [
      { label: "reviews", count: reviews, blocking: true },
      { label: "itinerary items", count: items, blocking: true },
    ];
  }

  if (kind === "hotel") {
    const [bookings, trips, rates] = await Promise.all([
      HotelBooking.countDocuments({ hotel_id: id }),
      Trip.countDocuments({ $or: [{ hotel_id: id }, { "hotel_selections.hotel_id": id }] }),
      HotelRate.countDocuments({ hotel_id: id }),
    ]);
    return [
      { label: "reservations", count: bookings, blocking: true },
      { label: "trips that chose it", count: trips, blocking: true },
      { label: "cached rates", count: rates, blocking: false },
    ];
  }

  if (kind === "transport") {
    const live = await Booking.countDocuments({
      transport_id: id,
      status: { $in: ["pending", "confirmed"] },
    });
    const past = await Booking.countDocuments({ transport_id: id, status: "cancelled" });
    return [
      { label: "live bookings", count: live, blocking: true },
      { label: "cancelled bookings", count: past, blocking: false },
    ];
  }

  if (kind === "airport") {
    const [destinations, flights] = await Promise.all([
      Destination.countDocuments({ nearest_airport: doc.iata, deleted_at: null }),
      // Flights reference airports by IATA code rather than by id.
      (await import("../models/FlightOption.js")).default.countDocuments({
        $or: [{ from_iata: doc.iata }, { to_iata: doc.iata }],
        deleted_at: null,
      }),
    ]);
    return [
      { label: "flights", count: flights, blocking: true },
      { label: "destinations using it", count: destinations, blocking: true },
    ];
  }

  if (kind === "country") {
    const [destinations, users] = await Promise.all([
      Destination.countDocuments({ country_code: doc.code, deleted_at: null }),
      (await import("../models/User.js")).default.countDocuments({ country_code: doc.code }),
    ]);
    return [
      { label: "destinations", count: destinations, blocking: true },
      { label: "travellers based there", count: users, blocking: true },
    ];
  }

  // Reference data is referenced by *code*, not by id: an expense names its
  // category, a trip names its interests. Those two block, because deleting
  // the row leaves a value in use that nothing can any longer explain.
  if (kind === "expense_category") {
    const expenses = await Expense.countDocuments({ category: doc.code });
    return [{ label: "logged expenses", count: expenses, blocking: true }];
  }

  if (kind === "interest_tag") {
    const trips = await Trip.countDocuments({ interests: doc.code });
    return [{ label: "trips that chose it", count: trips, blocking: true }];
  }

  // The rest are informative. A packing list already generated keeps the
  // items it was given, a chat reply keeps its text, and a route keeps the
  // emissions figure it was computed with — none of them break if the row
  // behind them is gone, so removing it is allowed with the count shown.
  if (kind === "packing_template") {
    const lists = await PackingList.countDocuments({ "trip_context.templates_applied": doc.code });
    return [{ label: "packing lists built from it", count: lists, blocking: false }];
  }

  if (kind === "chat_intent") {
    const replies = await ChatSession.countDocuments({ "messages.intent_code": doc.code });
    return [{ label: "assistant replies", count: replies, blocking: false }];
  }

  if (kind === "carbon_factor") {
    const routes = await Route.countDocuments({ mode: doc.mode, deleted_at: null });
    return [{ label: "routes using that mode", count: routes, blocking: false }];
  }

  // Routes, nearby services and itinerary templates are referenced by nothing
  // at all: a trip stores the plan it was given, not the template it came
  // from, and the map redraws from whatever routes exist.
  return [];
}

/** The blocking rows, if any — the reason a hard delete is refused. */
export function blockers(references) {
  return references.filter((r) => r.blocking && r.count > 0);
}

/**
 * The admin "delete": the row is marked and deactivated rather than removed,
 * so nothing that already points at it breaks. `is_active: false` is what
 * makes it disappear from the traveller app, since every public query
 * already filters on it.
 */
export async function softDelete(doc, userId) {
  doc.deleted_at = new Date();
  doc.deleted_by = userId;
  doc.is_active = false;
  await doc.save();
  return doc;
}

export async function restore(doc) {
  doc.deleted_at = null;
  doc.deleted_by = null;
  doc.is_active = true;
  await doc.save();
  return doc;
}
