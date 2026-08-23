// FR-15 — Smart Packing Assistant, the rule engine.
//
// One implementation shared by the API (packingController) and the seeder,
// so a list generated at request time and a seeded demo list can never
// disagree. No AI call — the "smart" part is the rule match against the
// trip's weather, destination types, interests and duration.

export function matchesConditions(template, ctx) {
  if (template.always_include) return true;
  const c = template.conditions || {};
  let matched = false;

  if (c.international_only && !ctx.isInternational) return false;
  if (c.international_only && ctx.isInternational) matched = true;

  if (c.min_days != null) {
    if (ctx.days < c.min_days) return false;
    matched = true;
  }
  if (c.max_days != null) {
    if (ctx.days > c.max_days) return false;
    matched = true;
  }
  if (c.min_temp_c != null) {
    if (ctx.tempMax < c.min_temp_c) return false;
    matched = true;
  }
  if (c.max_temp_c != null) {
    if (ctx.tempMin > c.max_temp_c) return false;
    matched = true;
  }
  if (c.packing_hints?.length && c.packing_hints.some((h) => ctx.hints.has(h))) matched = true;
  if (c.weather_conditions?.length && c.weather_conditions.some((w) => ctx.conditions.has(w))) matched = true;
  // A multi-city trip can span several destination types (beach + hill);
  // one overlap is enough. Single-type callers pass destinationType.
  const types = ctx.destinationTypes || (ctx.destinationType ? [ctx.destinationType] : []);
  if (c.destination_types?.length && types.some((t) => c.destination_types.includes(t))) matched = true;
  if (c.interests?.length && c.interests.some((i) => ctx.interests.includes(i))) matched = true;

  return matched;
}

export function resolveQty(rule, qty, days, travelers) {
  switch (rule) {
    case "per_day": return Math.max(1, days) * travelers;
    case "per_2_days": return Math.max(1, Math.ceil(days / 2)) * travelers;
    case "per_traveler": return travelers;
    default: return qty || 1;
  }
}

export function buildPackingList(templatesList, ctx) {
  const applied = templatesList
    .filter((t) => t.is_active !== false && matchesConditions(t, ctx))
    .sort((a, b) => b.priority - a.priority);

  const byCategory = new Map();
  const seen = new Map(); // item name -> the priority that claimed it

  for (const t of applied) {
    for (const item of t.items) {
      const key = item.name.toLowerCase();
      if (seen.has(key) && seen.get(key) >= t.priority) continue;
      seen.set(key, t.priority);

      if (!byCategory.has(t.category)) byCategory.set(t.category, new Map());
      byCategory.get(t.category).set(key, {
        name: item.name,
        qty: resolveQty(item.qty_rule, item.qty, ctx.days, ctx.travelers),
        essential: item.essential,
        checked: false,
        note: item.note || "",
        from_template: t.code,
      });
    }
  }

  return {
    categories: [...byCategory.entries()].map(([category, items]) => ({
      category,
      items: [...items.values()].sort((a, b) => Number(b.essential) - Number(a.essential)),
    })),
    templates_applied: applied.map((t) => t.code),
  };
}

export default { matchesConditions, resolveQty, buildPackingList };
