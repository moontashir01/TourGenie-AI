// FR-03 — the confirmation document a traveller keeps.
//
// pdfkit rather than a headless browser: the API runs on free-tier hosting
// where a Chromium process would not fit in the memory ceiling, and this
// document is a table of text, not a web page.
//
// It renders with the built-in Helvetica, which is WinAnsi-encoded. There is
// no font file in this repo to embed, so every dynamic string goes through
// `safe()` and the taka sign is written as "BDT" — a missing glyph prints as
// noise, and noise on a confirmation is worse than a currency code.
import PDFDocument from "pdfkit";

const INK = "#0E1B24";
const MUTED = "#5A6B76";
const TEAL = "#1A4358";
const SUNSET = "#EF8354";
const SAND = "#DCD5CA";

const LABEL_W = 130;
const TIME_W = 42;
const COST_W = 84;

const DATE_OPTS = { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };

// Characters the traveller's own data can carry that Helvetica cannot draw.
// Mapped rather than dropped where an ASCII equivalent reads the same.
const SUBSTITUTIONS = [
  ["‘", "'"],
  ["’", "'"],
  ["“", '"'],
  ["”", '"'],
  ["–", "-"],
  ["—", "-"],
  ["→", "->"],
  ["…", "..."],
  ["৳", "BDT "],
  ["≈", "~"],
];

function safe(value) {
  if (value == null) return "";
  let out = String(value);
  for (const [from, to] of SUBSTITUTIONS) out = out.split(from).join(to);
  return out.replace(/[^\t\n\x20-\xFF]/g, "");
}

function money(amount) {
  return `BDT ${Math.round(Number(amount) || 0).toLocaleString("en-US")}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", DATE_OPTS);
}

// ── layout helpers ───────────────────────────────────────────────────
// pdfkit paginates `text()` on its own but not the rules and columns drawn
// around it, so anything that positions by hand asks for room first.

const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const pageBottom = (doc) => doc.page.height - doc.page.margins.bottom;

function ensure(doc, height) {
  if (doc.y + height > pageBottom(doc)) doc.addPage();
}

function rule(doc, { color = SAND, weight = 0.5, gap = 8 } = {}) {
  ensure(doc, gap * 2);
  const y = doc.y;
  doc
    .save()
    .lineWidth(weight)
    .strokeColor(color)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
    .restore();
  doc.y = y + gap;
}

function heading(doc, text) {
  ensure(doc, 34);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(safe(text), doc.page.margins.left, doc.y);
  doc.moveDown(0.3);
  rule(doc, { color: INK, weight: 0.8, gap: 6 });
}

function note(doc, text) {
  ensure(doc, 16);
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(safe(text), doc.page.margins.left, doc.y, {
    width: contentWidth(doc),
  });
  doc.moveDown(0.3);
}

/** Label on the left, value on the right of the same line. */
function factRow(doc, label, value) {
  if (value === "" || value == null) return;
  const left = doc.page.margins.left;
  const valueW = contentWidth(doc) - LABEL_W;
  const text = safe(value);
  const height = Math.max(12, doc.font("Helvetica").fontSize(9.5).heightOfString(text, { width: valueW }));
  ensure(doc, height + 6);

  const y = doc.y;
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(safe(label).toUpperCase(), left, y + 1, { width: LABEL_W });
  doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(text, left + LABEL_W, y, { width: valueW });
  doc.y = y + height + 4;
}

/** Label left, money right-aligned — the budget and per-day totals. */
function amountRow(doc, label, value, { bold = false, color = INK } = {}) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  const text = safe(label);
  const height = Math.max(12, doc.font(font).fontSize(9.5).heightOfString(text, { width: width - COST_W - 8 }));
  ensure(doc, height + 6);

  const y = doc.y;
  doc.font(font).fontSize(9.5).fillColor(color).text(text, left, y, { width: width - COST_W - 8 });
  doc.font(font).fontSize(9.5).fillColor(color).text(value, left + width - COST_W, y, {
    width: COST_W,
    align: "right",
  });
  doc.y = y + height + 4;
}

// ── sections ─────────────────────────────────────────────────────────

function masthead(doc, trip) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("TourGenie ", left, doc.y, { continued: true });
  doc.fillColor(SUNSET).text("AI");
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("Trip confirmation", left, doc.y, { width });
  doc.moveDown(0.8);

  doc
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor(INK)
    .text(safe(trip.title || `${trip.origin} -> ${trip.destination}`), left, doc.y, { width });

  const dates = `${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}`;
  const people = `${trip.travelers} ${trip.travelers === 1 ? "traveller" : "travellers"}`;
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(MUTED)
    .text(safe(`${dates}  ·  ${trip.duration_days} days  ·  ${people}`), left, doc.y + 2, { width });

  doc.moveDown(0.8);
  rule(doc, { color: INK, weight: 1.2, gap: 10 });
}

function facts(doc, trip, budget) {
  const country = trip.destination_id?.country;
  factRow(doc, "Route", `${trip.origin} -> ${trip.destination}`);
  factRow(doc, "Destination", country ? `${trip.destination}, ${country}` : trip.destination);
  if (trip.multi_city && trip.preferred_cities?.length) {
    factRow(doc, "Cities", trip.preferred_cities.join(", "));
  }
  factRow(doc, "Dates", `${formatDate(trip.start_date)} to ${formatDate(trip.end_date)}`);
  factRow(doc, "Travellers", String(trip.travelers));
  factRow(doc, "Budget", money(trip.budget));
  factRow(doc, "Planned cost", money(budget.spent));
  if (trip.carbon?.total_kg > 0) {
    factRow(doc, "Carbon", `${trip.carbon.total_kg} kg CO2 (${trip.carbon.per_person_kg} kg per person)`);
  }
}

function reservations(doc, transport, hotels) {
  if (!transport.length && !hotels.length) return;
  heading(doc, "Reservations");
  note(doc, "Demonstration records - no payment was taken and nothing is reserved with any operator or property.");

  for (const booking of transport) {
    const journey = booking.journey || {};
    const operator = journey.operator || booking.transport_id?.operator || "Transport";
    amountRow(doc, `${operator}  ·  ${booking.reference || ""}`, money(booking.total_fare), { bold: true });
    const legs = [
      `${journey.from_city || ""} -> ${journey.to_city || ""}`,
      journey.depart_time ? `${journey.depart_time}-${journey.arrive_time || ""}` : "",
      formatDate(booking.travel_date),
      booking.seats?.length ? `seats ${booking.seats.join(", ")}` : "",
    ].filter(Boolean);
    note(doc, legs.join("  ·  "));
  }

  for (const booking of hotels) {
    const property = booking.property || {};
    amountRow(doc, `${property.name || "Hotel"}  ·  ${booking.reference || ""}`, money(booking.total_amount), {
      bold: true,
    });
    const detail = [
      `${booking.rooms} x ${booking.room_type}`,
      `${formatDate(booking.check_in)} -> ${formatDate(booking.check_out)}`,
      `${booking.nights} night${booking.nights === 1 ? "" : "s"}`,
      property.address || "",
      property.phone || "",
    ].filter(Boolean);
    note(doc, detail.join("  ·  "));
  }
}

function dayByDay(doc, trip, items) {
  heading(doc, "Day by day");

  if (!items.length) {
    note(doc, "No itinerary has been generated for this trip yet.");
    return;
  }

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const days = [...new Set(items.map((i) => i.day))].sort((a, b) => a - b);

  for (const day of days) {
    const dayItems = items
      .filter((i) => i.day === day)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const dayCost = dayItems.reduce((sum, i) => sum + (i.est_cost || 0), 0);
    const theme = dayItems.find((i) => i.day_theme)?.day_theme;
    // Fall back to the trip's own calendar when an item carries no date —
    // hand-added activities are saved without one.
    const date =
      dayItems.find((i) => i.date)?.date ||
      new Date(new Date(trip.start_date).getTime() + (day - 1) * 86400000);

    // Keep a day header with at least its first row rather than stranding it
    // at the foot of a page.
    ensure(doc, 60);
    doc.moveDown(0.5);
    const headerY = doc.y;
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(TEAL)
      .text(safe(`Day ${day}`), left, headerY, { width: width - COST_W - 8 });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(safe([formatDate(date), theme].filter(Boolean).join("  ·  ")), left, doc.y, {
        width: width - COST_W - 8,
      });
    if (dayCost > 0) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(MUTED)
        .text(money(dayCost), left + width - COST_W, headerY, { width: COST_W, align: "right" });
    }
    doc.y = Math.max(doc.y, headerY + 22);
    rule(doc, { color: SAND, weight: 0.5, gap: 5 });

    for (const item of dayItems) {
      const detail = [item.location, item.city].filter(Boolean).join(" · ");
      const bodyW = width - TIME_W - COST_W - 12;
      const activityH = doc.font("Helvetica").fontSize(9.5).heightOfString(safe(item.activity), { width: bodyW });
      const detailH = detail ? doc.font("Helvetica").fontSize(8.5).heightOfString(safe(detail), { width: bodyW }) : 0;
      ensure(doc, activityH + detailH + 8);

      const y = doc.y;
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(safe(item.time), left, y + 1, { width: TIME_W });
      doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(safe(item.activity), left + TIME_W, y, { width: bodyW });
      if (detail) {
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(safe(detail), left + TIME_W, doc.y, { width: bodyW });
      }
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(item.est_cost > 0 ? money(item.est_cost) : "Free", left + width - COST_W, y + 1, {
          width: COST_W,
          align: "right",
        });
      doc.y = y + activityH + detailH + 6;
    }
  }
}

function budgetSection(doc, budget) {
  heading(doc, "Budget");

  const categories = Object.entries(budget.byCategory || {}).sort((a, b) => b[1] - a[1]);
  for (const [category, amount] of categories) amountRow(doc, category, money(amount));

  if (categories.length) rule(doc, { color: INK, weight: 0.8, gap: 6 });

  amountRow(doc, "Trip cost", money(budget.spent), { bold: true });
  amountRow(doc, "Planned budget", money(budget.budget));
  amountRow(
    doc,
    budget.over_budget ? "Over budget by" : "Left over",
    money(budget.over_budget ? budget.overspend : budget.remaining),
    { bold: true, color: budget.over_budget ? SUNSET : TEAL }
  );

  if (budget.flights_excluded > 0) {
    note(
      doc,
      `${money(budget.flights_excluded)} for getting there and back is shown separately - ` +
        `this budget does not cover it.`
    );
  }
  if (budget.logged_total > 0) {
    note(doc, `${money(budget.logged_total)} of this is logged spending; the rest is estimated.`);
  }
}

function footer(doc) {
  doc.moveDown(1);
  rule(doc, { color: SAND, weight: 0.5, gap: 6 });
  note(
    doc,
    `Generated ${formatDate(new Date())} by TourGenie AI. Costs are estimates in BDT. ` +
      `Bookings shown are demonstration records - no payment was taken.`
  );
}

/**
 * The whole plan as one PDF, returned as a Buffer ready to attach.
 *
 * `budget` is the summary from expenseController.buildBudgetSummary — the
 * same figures the Budget page shows, so a printed plan and the app can
 * never disagree about what the trip costs.
 */
export function buildTripPdf({ trip, items = [], budget, transport = [], hotels = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: safe(trip.title || `${trip.origin} to ${trip.destination}`),
        Author: "TourGenie AI",
        Subject: "Trip confirmation",
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      masthead(doc, trip);
      facts(doc, trip, budget);
      reservations(doc, transport, hotels);
      dayByDay(doc, trip, items);
      budgetSection(doc, budget);
      footer(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** What the attachment is called in the traveller's mailbox. */
export function tripPdfFilename(trip) {
  const slug = safe(trip.title || `${trip.destination}-trip`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `tourgenie-${slug || "trip"}.pdf`;
}
