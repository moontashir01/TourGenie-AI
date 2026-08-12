// Turns an ItineraryTemplate into ItineraryItem documents, and derives the
// budget breakdown (FR-09) and carbon estimate (FR-16) for a trip.
//
// This is the same algorithm the itinerary controller should run at request
// time — the seeder uses it so that seeded trips and user-created trips
// produce identical shapes.

const DAY_MS = 86400000;

/**
 * Score a template against a trip. Higher is better; -1 means unusable.
 */
export function scoreTemplate(template, { destinationId, days, budgetTier, interests = [] }) {
  if (String(template.destination_id) !== String(destinationId)) return -1;

  let score = 100;

  // Duration: an exact match is ideal; each day of stretch or trim costs.
  score -= Math.abs(template.duration_days - days) * 12;

  if (template.budget_tier === budgetTier) score += 25;

  // Interest overlap, as a share of what the traveller asked for.
  if (interests.length && template.interests?.length) {
    const overlap = interests.filter((i) => template.interests.includes(i)).length;
    score += Math.round((overlap / interests.length) * 40);
  }

  score += (template.popularity || 50) / 10;
  return score;
}

export function pickTemplate(templates, criteria) {
  let best = null;
  let bestScore = -Infinity;
  for (const t of templates) {
    const s = scoreTemplate(t, criteria);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return bestScore < 0 ? null : best;
}

/**
 * Expand a template to exactly `days` days.
 *
 * Shorter than the template: drop the middle days, always keeping the first
 * (arrival) and last (departure) — those carry the travel legs.
 * Longer: repeat the middle days, marking the repeats as free time rather
 * than duplicating activities verbatim.
 */
function fitDays(templateDays, days) {
  const n = templateDays.length;
  if (n === days) return templateDays;

  if (days < n) {
    const kept = [templateDays[0]];
    const middle = templateDays.slice(1, -1);
    const needed = days - 2;
    if (needed > 0) {
      const step = middle.length / needed;
      for (let i = 0; i < needed; i++) kept.push(middle[Math.floor(i * step)]);
    }
    if (days > 1) kept.push(templateDays[n - 1]);
    return kept.slice(0, days);
  }

  // Longer than the template — insert flexible days before the last day.
  const out = templateDays.slice(0, -1);
  const extra = days - n;
  for (let i = 0; i < extra; i++) {
    out.push({
      day: 0,
      theme: "Free day",
      items: [
        { time: "09:00", activity: "Breakfast", location: "Hotel", est_cost: 250, duration_min: 45, category: "meal" },
        { time: "10:30", activity: "Free time — revisit a favourite spot or explore locally", location: "Around town", est_cost: 400, duration_min: 240, category: "activity", is_optional: true },
        { time: "14:00", activity: "Lunch", location: "Local restaurant", est_cost: 400, duration_min: 60, category: "meal" },
        { time: "16:00", activity: "Rest or optional excursion", location: "Around town", est_cost: 500, duration_min: 180, category: "rest", is_optional: true },
        { time: "20:00", activity: "Dinner", location: "Local restaurant", est_cost: 500, duration_min: 75, category: "meal" },
      ],
    });
  }
  out.push(templateDays[templateDays.length - 1]);
  return out;
}

/**
 * @param {object} template  ItineraryTemplate document
 * @param {object} trip      Trip document (needs _id, start_date, duration_days)
 * @param {Map}    attractionBySlug  slug -> Attraction._id
 * @param {object} opts      { pace }
 * @returns {Array} plain objects ready for ItineraryItem.insertMany
 */
export function buildItineraryItems(template, trip, attractionBySlug = new Map(), opts = {}) {
  const days = trip.duration_days || template.duration_days;
  const fitted = fitDays(template.days, days);
  const pace = opts.pace || template.pace;
  const start = new Date(trip.start_date);

  const items = [];
  fitted.forEach((day, dayIndex) => {
    const dayNumber = dayIndex + 1;
    const date = new Date(start.getTime() + dayIndex * DAY_MS);

    let dayItems = day.items;
    if (pace === "relaxed") dayItems = dayItems.filter((i) => !i.is_optional);

    dayItems.forEach((item, sortOrder) => {
      items.push({
        trip_id: trip._id,
        attraction_id: item.attraction_slug ? attractionBySlug.get(item.attraction_slug) || null : null,
        day: dayNumber,
        date,
        time: item.time,
        activity: item.activity,
        location: item.location || "",
        est_cost: item.est_cost || 0,
        duration_min: item.duration_min || 60,
        category: item.category || "activity",
        day_theme: day.theme || "",
        weather_dependent: Boolean(item.weather_dependent),
        sort_order: sortOrder,
        source: "template",
        lat_lng: { lat: null, lng: null },
      });
    });
  });

  return items;
}

/**
 * FR-09 — categorised budget from the cost benchmark, itinerary and hotel.
 * Returns { lines, estimated_total }.
 */
export function buildBudgetBreakdown({ benchmark, categories, days, travelers, hotelPricePerNight, transportFare }) {
  const byCode = new Map(categories.map((c) => [c.code, c]));
  const perDay = benchmark?.per_person_per_day || {};

  const accommodation = hotelPricePerNight != null
    ? hotelPricePerNight * Math.max(1, days - 1) // nights, not days
    : (perDay.accommodation || 0) * Math.max(1, days - 1) * travelers;

  const amounts = {
    transport: (transportFare != null ? transportFare * travelers * 2 : 0) + (perDay.local_transport || 0) * days * travelers,
    hotel: Math.round(accommodation),
    food: (perDay.food || 0) * days * travelers,
    attractions: (perDay.attractions || 0) * days * travelers,
    shopping: (perDay.shopping || 0) * days * travelers,
    emergency: (perDay.misc || 0) * days * travelers,
  };

  const lines = Object.entries(amounts)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => {
      const meta = byCode.get(category);
      return {
        category,
        label: meta?.label || category,
        amount: Math.round(amount),
        color: meta?.color || "#8A7B6B",
      };
    })
    .sort((a, b) => (byCode.get(a.category)?.sort_order || 99) - (byCode.get(b.category)?.sort_order || 99));

  return {
    lines,
    estimated_total: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

/**
 * FR-16 — distance × emission factor ÷ 1000, doubled for the return leg.
 */
export function buildCarbonEstimate({ route, factor, travelers }) {
  if (!route || !factor) return null;
  const perPersonOneWay = (route.distance_km * factor.grams_co2_per_passenger_km) / 1000;
  const perPerson = +(perPersonOneWay * 2).toFixed(2); // there and back
  return {
    total_kg: +(perPerson * travelers).toFixed(2),
    per_person_kg: perPerson,
    mode: factor.mode,
    distance_km: route.distance_km * 2,
    rating: factor.rating,
    computed_at: new Date(),
  };
}

export default { scoreTemplate, pickTemplate, buildItineraryItems, buildBudgetBreakdown, buildCarbonEstimate };
