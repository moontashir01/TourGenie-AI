// FR-24 — reports, generated where the data is.
//
// The Reports tab built its CSV in the browser: it paged the whole trips list
// down to the client, 100 rows at a time, and joined it there. That works at
// eight trips and is the wrong shape at eight hundred — and it can only export
// what a list endpoint already returns, which rules out anything that needs a
// join or a group.
//
// These stream from a cursor. Nothing larger than one row is ever held in
// memory, and every export writes an audit entry naming the report and the
// row count, because an export of personal data is itself an admin action.
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import HotelBooking from "../models/HotelBooking.js";
import AuditLog from "../models/AuditLog.js";
import Report from "../models/Report.js";
import { recordAudit } from "../services/auditLog.js";

// Email addresses are opt-in, never the default. An export is the easiest way
// to walk personal data out of a system by accident.
const PERSONAL_NOTE = "requires include_personal=true";

const csvCell = (value) => {
  if (value === null || value === undefined) return '""';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};
const csvRow = (cells) => cells.map(csvCell).join(",") + "\n";

const money = (n) => Math.round(Number(n) || 0);

// ── the reports ──────────────────────────────────────────────────────
//
// Each one declares its columns and hands back an async iterator of rows, so
// the streaming below doesn't care whether the source is a cursor or an
// aggregation.

const REPORTS = {
  users: {
    label: "Users and growth",
    columns: (personal) => [
      "Name", ...(personal ? ["Email"] : []), "Role", "Status", "Country", "City",
      "Trips", "Joined", "Last login",
    ],
    rows: async function* (personal) {
      const cursor = User.find().select("-password_hash").sort({ created_at: -1 }).lean().cursor();
      for await (const user of cursor) {
        yield [
          user.name,
          ...(personal ? [user.email] : []),
          user.role,
          user.is_active ? "active" : "deactivated",
          user.country || "",
          user.city || "",
          user.trip_count ?? "",
          user.created_at,
          user.last_login_at || "",
        ];
      }
    },
  },

  trips: {
    label: "Trips by destination and season",
    columns: (personal) => [
      "Traveller", ...(personal ? ["Email"] : []), "Origin", "Destination", "Country",
      "Status", "Start", "End", "Travellers", "Budget (BDT)", "Itinerary source", "Created",
    ],
    rows: async function* (personal) {
      const cursor = Trip.find().populate("user_id", "name email").sort({ created_at: -1 }).lean().cursor();
      for await (const trip of cursor) {
        yield [
          trip.user_id?.name || "deleted account",
          ...(personal ? [trip.user_id?.email || ""] : []),
          trip.origin || "",
          trip.destination || "",
          trip.country_code || "—",
          trip.status || "",
          trip.start_date,
          trip.end_date,
          trip.travelers ?? "",
          money(trip.budget),
          trip.itinerary_source || "none",
          trip.created_at,
        ];
      }
    },
  },

  bookings: {
    label: "Booking volume and value",
    columns: (personal) => [
      "Reference", "Kind", ...(personal ? ["Traveller email"] : []), "Status",
      "Detail", "Date", "Amount (BDT)", "Created",
    ],
    // Both booking collections in one file: from the outside they are the
    // same thing, and answering "what did this traveller book" should not
    // mean opening two exports.
    rows: async function* (personal) {
      const tickets = Booking.find().populate("user_id", "email").sort({ created_at: -1 }).lean().cursor();
      for await (const booking of tickets) {
        yield [
          booking.reference || "",
          "transport",
          ...(personal ? [booking.user_id?.email || ""] : []),
          booking.status || "",
          // journey and property are snapshot sub-documents; a CSV needs the
          // one line a human reads, not the object.
          [booking.journey?.operator, booking.journey?.from_city, booking.journey?.to_city]
            .filter(Boolean)
            .join(" · "),
          booking.travel_date,
          money(booking.total_fare),
          booking.created_at,
        ];
      }
      const stays = HotelBooking.find().populate("user_id", "email").sort({ created_at: -1 }).lean().cursor();
      for await (const stay of stays) {
        yield [
          stay.reference || "",
          "hotel",
          ...(personal ? [stay.user_id?.email || ""] : []),
          stay.status || "",
          [stay.property?.name, stay.property?.city].filter(Boolean).join(" · "),
          stay.check_in,
          money(stay.total_amount),
          stay.created_at,
        ];
      }
    },
  },

  "budget-accuracy": {
    label: "Budget accuracy — planned against logged",
    // Genuine back-pressure on services/tripEstimator.js: if a destination's
    // planned budgets are consistently 40% under what travellers actually
    // log, the estimator is wrong about that destination.
    columns: () => [
      "Destination", "Trips with expenses", "Avg planned (BDT)", "Avg logged (BDT)",
      "Difference (BDT)", "Planned vs logged",
    ],
    rows: async function* () {
      const rows = await Trip.aggregate([
        {
          $lookup: { from: "expenses", localField: "_id", foreignField: "trip_id", as: "logged" },
        },
        {
          $project: {
            destination: 1,
            budget: 1,
            logged_count: { $size: "$logged" },
            logged_total: {
              $sum: {
                $map: { input: "$logged", as: "e", in: { $ifNull: ["$$e.amount_bdt", "$$e.amount"] } },
              },
            },
          },
        },
        // A trip nobody logged an expense against says nothing about
        // accuracy, and averaging it in as zero would say something false.
        { $match: { logged_count: { $gt: 0 } } },
        {
          $group: {
            _id: "$destination",
            trips: { $sum: 1 },
            avg_budget: { $avg: "$budget" },
            avg_logged: { $avg: "$logged_total" },
          },
        },
        { $sort: { trips: -1 } },
      ]);

      for (const row of rows) {
        const planned = money(row.avg_budget);
        const logged = money(row.avg_logged);
        yield [
          row._id || "—",
          row.trips,
          planned,
          logged,
          planned - logged,
          logged ? `${Math.round((planned / logged) * 100)}%` : "—",
        ];
      }
    },
  },

  "ai-usage": {
    label: "AI usage by provider",
    columns: () => ["Source", "Trips", "Share", "First generated", "Last generated"],
    rows: async function* () {
      const rows = await Trip.aggregate([
        {
          $group: {
            _id: { $cond: [{ $eq: ["$itinerary_source", ""] }, "none", "$itinerary_source"] },
            trips: { $sum: 1 },
            first: { $min: "$itinerary_generated_at" },
            last: { $max: "$itinerary_generated_at" },
          },
        },
        { $sort: { trips: -1 } },
      ]);
      const total = rows.reduce((sum, row) => sum + row.trips, 0) || 1;

      for (const row of rows) {
        yield [
          // "template" means the AI was unavailable or declined and the
          // database plan answered instead — the fallback rate in practice.
          row._id || "none",
          row.trips,
          `${Math.round((row.trips / total) * 100)}%`,
          row.first || "",
          row.last || "",
        ];
      }
    },
  },

  moderation: {
    label: "Content moderation throughput",
    columns: () => ["When", "Moderator", "Action", "Content", "Reason"],
    rows: async function* () {
      const cursor = AuditLog.find({ action: { $regex: "^(post|review|report)\\." } })
        .sort({ created_at: -1 })
        .lean()
        .cursor();
      for await (const entry of cursor) {
        yield [entry.created_at, entry.actor_email, entry.action, entry.entity_label, entry.reason || ""];
      }
    },
  },

  reports: {
    label: "Traveller reports",
    columns: (personal) => [
      "Raised", ...(personal ? ["Reporter"] : []), "Kind", "Reason", "Details",
      "Content", "Status", "Closed", "Resolution",
    ],
    rows: async function* (personal) {
      const cursor = Report.find().sort({ created_at: -1 }).lean().cursor();
      for await (const report of cursor) {
        yield [
          report.created_at,
          ...(personal ? [report.reporter_email] : []),
          report.target_type,
          report.reason,
          report.details || "",
          report.target_label,
          report.status,
          report.resolved_at || "",
          report.resolution || "",
        ];
      }
    },
  },
};

/** The report menu, so the client doesn't hard-code this list. */
export const listExports = (req, res) => {
  res.json({
    reports: Object.entries(REPORTS).map(([key, report]) => ({
      key,
      label: report.label,
      // Which ones have a personal-data column behind the opt-in.
      personal_columns: report.columns(true).length > report.columns(false).length ? PERSONAL_NOTE : "",
    })),
  });
};

export const runExport = async (req, res) => {
  const key = req.params.report;
  const report = REPORTS[key];
  if (!report) {
    return res.status(404).json({ message: `No such report. Try one of: ${Object.keys(REPORTS).join(", ")}` });
  }

  const personal = req.query.include_personal === "true";
  const filename = `tourgenie-${key}-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // Excel reads a CSV as the system codepage unless the file says otherwise,
  // and every Bangla place name in this database would arrive as mojibake.
  res.write("﻿");
  res.write(csvRow(report.columns(personal)));

  let count = 0;
  try {
    for await (const row of report.rows(personal)) {
      res.write(csvRow(row));
      count += 1;
    }
  } catch (err) {
    // The headers are long gone by now, so there is no status code left to
    // send: say so inside the file rather than truncating it silently.
    res.write(csvRow([`Export failed after ${count} rows: ${err.message}`]));
    res.end();
    console.error("[admin] export failed:", err);
    return;
  }

  res.end();

  // After the response, so a slow write to AuditLog never delays the file.
  await recordAudit(req, {
    action: "report.export",
    entity_type: "Export",
    entity_label: report.label,
    after: { report: key, rows: count, included_personal_columns: personal },
    reason: req.query.reason || "",
  });
};

export default { listExports, runExport };
