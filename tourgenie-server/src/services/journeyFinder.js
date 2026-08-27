// "How do I get there, how long does it take, what does it cost."
//
// Extracted from the destination comparison so the chat assistant answers
// the same way the compare page does — one implementation, one answer.
import Route from "../models/Route.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exact(name) {
  return new RegExp(`^${escapeRegex(String(name).trim())}$`, "i");
}

/**
 * A direct corridor where one is seeded, otherwise the best two-hop path.
 *
 * Sajek is the case that forces this: nobody drives Dhaka to Sajek in one
 * leg — you go to Khagrachari and join the convoy — so reporting "no route"
 * would be describing a gap in the seed data rather than the journey.
 */
export async function findJourney(originName, destinationName) {
  if (!originName || !destinationName) return null;
  const from = exact(originName);
  const to = exact(destinationName);

  const direct = await Route.findOne({ "from.name": from, "to.name": to })
    .sort({ is_default: -1, duration_min: 1 })
    .lean();
  if (direct) {
    return {
      from: direct.from.name,
      to: direct.to.name,
      distance_km: direct.distance_km,
      duration_min: direct.duration_min,
      mode: direct.mode,
      est_fare_bdt: direct.est_fare_bdt,
      carbon_kg: direct.carbon_kg,
      direct: true,
      via: [],
    };
  }

  const [outbound, inbound] = await Promise.all([
    Route.find({ "from.name": from }).lean(),
    Route.find({ "to.name": to }).lean(),
  ]);

  const secondLegByCity = new Map();
  for (const leg of inbound) {
    const key = leg.from.name.toLowerCase();
    const best = secondLegByCity.get(key);
    if (!best || leg.duration_min < best.duration_min) secondLegByCity.set(key, leg);
  }

  let best = null;
  for (const first of outbound) {
    const second = secondLegByCity.get(first.to.name.toLowerCase());
    if (!second) continue;
    const total = first.duration_min + second.duration_min;
    if (!best || total < best.duration_min) {
      best = {
        from: first.from.name,
        to: second.to.name,
        distance_km: +(first.distance_km + second.distance_km).toFixed(1),
        duration_min: total,
        // Two modes on one journey: name the longer leg's, since that is
        // what the traveller will remember it as.
        mode: first.duration_min >= second.duration_min ? first.mode : second.mode,
        est_fare_bdt: (first.est_fare_bdt || 0) + (second.est_fare_bdt || 0),
        carbon_kg: +((first.carbon_kg || 0) + (second.carbon_kg || 0)).toFixed(1),
        direct: false,
        via: [first.to.name],
      };
    }
  }
  return best;
}

export default { findJourney };
