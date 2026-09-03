// Chart tokens, kept apart from the chart components so editing either one
// still hot-reloads (Fast Refresh only works for modules that export
// components exclusively).
//
// Everything here maps to the palette in tailwind.config.js.

// Ordered so adjacent series stay distinguishable.
export const CHART_COLORS = [
  "#1C8C82", // teal
  "#EF8354", // sunset
  "#D9A441", // gold
  "#146560", // teal-dark
  "#D96B3B", // sunset-dark
  "#8A7F6A", // muted sand
  "#123244", // ink-800
];

// Named expense/budget categories, so "Food" is the same gold on the Budget
// donut and in the admin breakdowns.
export const CATEGORY_COLORS = {
  Transport: "#1C8C82",
  Hotel: "#EF8354",
  Food: "#D9A441",
  Attractions: "#146560",
  Shopping: "#D96B3B",
  Miscellaneous: "#8A7F6A",
};

export const AXIS = {
  stroke: "#0B1F2E",
  tick: { fontSize: 11, fill: "rgba(11,31,46,0.45)", fontFamily: "Inter, sans-serif" },
  line: { stroke: "rgba(11,31,46,0.12)" },
};

export const GRID_STROKE = "rgba(11,31,46,0.07)";

/** Taka amounts read better abbreviated on an axis than as full figures. */
export function compactBdt(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 10_000_000) return `৳${(n / 10_000_000).toFixed(1)}cr`;
  if (Math.abs(n) >= 100_000) return `৳${(n / 100_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1_000) return `৳${(n / 1_000).toFixed(0)}k`;
  return `৳${n}`;
}
