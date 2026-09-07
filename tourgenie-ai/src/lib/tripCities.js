// Which cities a trip actually covers, and how long it stays in each.
//
// One rule decides it, and three places already depend on that rule: a day's
// last activity is where the traveller ended up, so that is the city they
// sleep in that night, and the final day is the day they leave — a night
// nowhere. The API prices the stay that way (services/hotelStays.js) and the
// Budget page splits the hotel cost that way, so the Itinerary page reads it
// from here instead of writing it out again.

/**
 * The cities the plan visits, in visit order.
 *
 * @param {Array<{day:number,time?:string,city?:string}>} items itinerary items
 * @returns {Array<{city:string,firstDay:number,lastDay:number,nights:number}>}
 *
 * A city the plan passes through without sleeping in — the departure city on
 * the last day, or a single-day stop — is kept, with `nights: 0`, because it
 * is still somewhere the trip goes. Callers that are pricing beds should read
 * `nights`; callers listing the route want the whole thing.
 */
export function cityStays(items) {
  const cityByDay = new Map();
  for (const item of [...items].sort((a, b) => a.day - b.day || String(a.time).localeCompare(String(b.time)))) {
    if (item.city) cityByDay.set(item.day, item.city);
  }

  const days = [...cityByDay.keys()].sort((a, b) => a - b);
  const sleepDays = days.slice(0, -1);

  const nights = new Map();
  for (const day of sleepDays) {
    const city = cityByDay.get(day);
    nights.set(city, (nights.get(city) || 0) + 1);
  }

  const stays = [];
  const byCity = new Map();
  for (const day of days) {
    const city = cityByDay.get(day);
    let stay = byCity.get(city);
    if (!stay) {
      stay = { city, firstDay: day, lastDay: day, nights: nights.get(city) || 0 };
      byCity.set(city, stay);
      stays.push(stay);
    }
    stay.lastDay = day;
  }
  return stays;
}

/** `{ Bangkok: 3, Phuket: 2 }` — nights only, for costing a stay. */
export function nightsByCity(items) {
  return Object.fromEntries(cityStays(items).map((stay) => [stay.city, stay.nights]));
}

export default { cityStays, nightsByCity };
