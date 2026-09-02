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
