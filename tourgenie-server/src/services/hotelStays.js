// Check-in and check-out rows for the itinerary.
//
// The planner was asked to emit these and did so unreliably: usually a bare
// "Check in to hotel" with no property named and no cost, often no check-out
// at all. A model is the wrong tool for it — which hotel was chosen and what
// it costs are facts already on the trip, so these rows are derived here
// instead of being requested.
//
// Where the money sits, and why it sits there:
//   The whole stay is charged once, on the CHECK-OUT row. Splitting it per
//   night would put a hotel charge on days the traveller reads as sightseeing
//   days, and charging it on check-in makes a one-night stay look like it was
//   paid before it happened. One line, on the day you settle up.
//
//   The check-in row is deliberately ৳0. Both rows carry hotel_id, and the
//   budget uses that to suppress its own hotel estimate (expenseController's
//   virt_hotel_*) — otherwise the stay lands in the total twice.
import Hotel from "../models/Hotel.js";
import { nightsFromDays, roomsFor } from "./budgetEstimator.js";

/** Anything the planner produced for a hotel; replaced by the derived rows. */
export function isHotelRow(item) {
  return item?.category === "checkin" || item?.category === "checkout";
}

/**
 * Which city the traveller sleeps in on each day.
 *
 * A day's last activity is where they ended up, so that is the night's city.
 * The final day is the day they leave, so it is not a night anywhere — the
 * same rule the Budget page and the Itinerary sidebar already use.
 */
function nightsByCity(items) {
  const cityByDay = new Map();
  for (const item of [...items].sort((a, b) => a.day - b.day || String(a.time).localeCompare(String(b.time)))) {
    if (item.city) cityByDay.set(item.day, item.city);
  }

  const days = [...cityByDay.keys()].sort((a, b) => a - b);
  const sleepDays = days.slice(0, -1); // the last day is a departure, not a night

  const order = [];
  const nights = new Map();
  for (const day of sleepDays) {
    const city = cityByDay.get(day);
    if (!nights.has(city)) order.push({ city, firstDay: day });
    nights.set(city, (nights.get(city) || 0) + 1);
    const entry = order.find((o) => o.city === city);
    entry.lastDay = day;
  }
  return order.map((o) => ({ ...o, nights: nights.get(o.city) }));
}

function row({ day, time, category, hotel, city, activity, cost, notes }) {
  return {
    day,
    time,
    category,
    activity,
    location: hotel.name,
    city: city || hotel.city || "",
    est_cost: cost,
    notes,
    hotel_id: hotel._id,
    source: "hotel",
  };
}

/**
 * Adds check-in and check-out rows for whichever hotels the trip has chosen,
 * replacing anything the planner emitted. Mutates and returns `items`.
 */
export async function attachHotelStays(items, trip) {
  // Whatever the model produced for hotels is discarded: it has no property
  // and no price, and keeping it alongside these would double the rows.
  const planned = items.filter((i) => !isHotelRow(i));
  items.length = 0;
  items.push(...planned);

  const lastDay = items.reduce((max, i) => Math.max(max, i.day || 0), 0);
  if (!lastDay) return items;

  const added = [];

  if (trip.multi_city && trip.hotel_selections?.length) {
    // One stay per city, in the order the trip actually visits them.
    const stays = nightsByCity(items);
    const hotelIds = trip.hotel_selections.map((s) => s.hotel_id?._id || s.hotel_id).filter(Boolean);
    const hotels = await Hotel.find({ _id: { $in: hotelIds } }).lean();
    const byId = new Map(hotels.map((h) => [String(h._id), h]));

    for (const sel of trip.hotel_selections) {
      const hotel = byId.get(String(sel.hotel_id?._id || sel.hotel_id));
      if (!hotel) continue;

      const stay = stays.find((s) => s.city === sel.city);
      // A hotel picked for a city the plan never sleeps in gets no rows —
      // it would otherwise charge for nights that do not exist.
      if (!stay || stay.nights <= 0) continue;

      added.push(...buildPair({ hotel, trip, city: sel.city, arriveDay: stay.firstDay, departDay: stay.lastDay + 1, nights: stay.nights }));
    }
  } else if (trip.hotel_id) {
    const hotel = trip.hotel_id.name ? trip.hotel_id : await Hotel.findById(trip.hotel_id).lean();
    if (hotel) {
      const nights = nightsFromDays(trip.duration_days || lastDay);
      added.push(...buildPair({ hotel, trip, city: trip.destination, arriveDay: 1, departDay: lastDay, nights }));
    }
  }

  items.push(...added);
  return items;
}

function buildPair({ hotel, trip, city, arriveDay, departDay, nights }) {
  const rooms = roomsFor(trip.travelers);
  const rate = hotel.price_per_night || 0;
  const total = rate * nights * rooms;

  const roomLabel = rooms > 1 ? `${rooms} rooms` : "1 room";
  const nightLabel = `${nights} night${nights === 1 ? "" : "s"}`;

  return [
    row({
      day: arriveDay,
      // Late enough to sit after the day's arrival leg, early enough to
      // precede an evening meal.
      time: "15:00",
      category: "checkin",
      hotel,
      city,
      activity: `Check in — ${hotel.name}`,
      // Charged once, on check-out. Zero here keeps it out of the total twice.
      cost: 0,
      notes: `${roomLabel} · ${nightLabel} · ৳${rate.toLocaleString()} per night`,
    }),
    row({
      day: departDay,
      time: "11:00",
      category: "checkout",
      hotel,
      city,
      activity: `Check out — ${hotel.name}`,
      cost: total,
      notes: `${nightLabel} × ${roomLabel} at ৳${rate.toLocaleString()} per night`,
    }),
  ];
}

export default { attachHotelStays, isHotelRow };
