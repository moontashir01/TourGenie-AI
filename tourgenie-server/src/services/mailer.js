// Outgoing email. One transport, created lazily and reused.
//
// The demo has no TourGenie mailbox yet, so this sends through a personal
// Gmail account using an App Password (MAIL_USER / MAIL_PASS). With no
// credentials configured the transport is skipped entirely and the message is
// written to the server log instead, so the reset flow stays testable offline.
import nodemailer from "nodemailer";
import { recordProviderCall } from "./providerStatus.js";

let cachedTransport;

export function isMailConfigured() {
  return Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
}

function getTransport() {
  if (cachedTransport !== undefined) return cachedTransport;

  if (!isMailConfigured()) {
    cachedTransport = null;
    return cachedTransport;
  }

  const port = Number(process.env.MAIL_PORT || 465);
  cachedTransport = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port,
    secure: port === 465, // 465 is implicit TLS; 587 upgrades via STARTTLS
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
  return cachedTransport;
}

// Sends one message. Never throws — a mail outage should not turn into a 500
// on a flow the visitor can simply retry; the caller decides what to tell them.
export async function sendMail({ to, subject, text, html, attachments }) {
  const transport = getTransport();

  if (!transport) {
    // Attachments are summarised rather than dumped: the trip confirmation
    // carries a PDF, and a base64 blob in the server log helps nobody.
    const files = attachments?.length
      ? `\n  attachments: ${attachments.map((a) => `${a.filename} (${a.content?.length || 0} bytes)`).join(", ")}`
      : "";
    console.warn(
      `[mailer] MAIL_USER/MAIL_PASS not set — email not sent.\n` +
        `  to: ${to}\n  subject: ${subject}\n  body: ${text}${files}`
    );
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const from = process.env.MAIL_FROM || `TourGenie AI <${process.env.MAIL_USER}>`;
    const info = await transport.sendMail({ from, to, subject, text, html, attachments });
    recordProviderCall("mail", true);
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    console.error("[mailer] send failed:", err.message);
    // A silent mail outage is exactly the kind of thing the health panel
    // exists for: the reset flow keeps working and nobody gets the code.
    recordProviderCall("mail", false, err.message);
    return { delivered: false, reason: "send_failed", error: err.message };
  }
}

// The password-reset code email, in both plain text and a small HTML card.
export function passwordResetEmail({ name, otp, minutes }) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const text =
    `${greeting}\n\n` +
    `Your TourGenie AI password reset code is ${otp}.\n\n` +
    `It expires in ${minutes} minute${minutes === 1 ? "" : "s"}. ` +
    `If you didn't ask to reset your password, you can ignore this email — ` +
    `your current password still works.\n\n— TourGenie AI`;

  const html = `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0E1B24;padding:32px;">
    <div style="max-width:440px;margin:0 auto;background:#152632;border:1px solid #1A4358;border-radius:16px;padding:32px;color:#F4F1EC;">
      <p style="margin:0 0 4px;font-size:20px;font-weight:600;">TourGenie <span style="color:#EF8354;">AI</span></p>
      <p style="margin:0 0 24px;font-size:13px;color:rgba(244,241,236,0.5);">Password reset</p>
      <p style="margin:0 0 16px;font-size:14px;">${greeting}</p>
      <p style="margin:0 0 20px;font-size:14px;">Use this code to reset your password:</p>
      <p style="margin:0 0 20px;font-size:34px;letter-spacing:10px;font-weight:700;color:#EF8354;">${otp}</p>
      <p style="margin:0 0 20px;font-size:13px;color:rgba(244,241,236,0.6);">
        The code expires in ${minutes} minute${minutes === 1 ? "" : "s"}. Request a new one if it runs out.
      </p>
      <p style="margin:0;font-size:12px;color:rgba(244,241,236,0.4);">
        Didn't ask for this? Ignore this email — your current password still works.
      </p>
    </div>
  </div>`;

  return { subject: `${otp} is your TourGenie AI password reset code`, text, html };
}

// FR-03 — the confirmation that goes out when a traveller confirms a trip.
// The detail lives in the attached PDF; this is the covering note, so it
// stays short enough to read on a phone lock screen.
const CONFIRMATION_DATE = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };

function confirmationDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", CONFIRMATION_DATE) : "";
}

function taka(amount) {
  return `৳${Math.round(Number(amount) || 0).toLocaleString("en-US")}`;
}

export function tripConfirmationEmail({ name, trip, budget }) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const title = trip.title || `${trip.origin} → ${trip.destination}`;
  const dates = `${confirmationDate(trip.start_date)} – ${confirmationDate(trip.end_date)}`;
  const people = `${trip.travelers} ${trip.travelers === 1 ? "traveller" : "travellers"}`;
  const spent = budget ? taka(budget.spent) : null;
  const planned = taka(trip.budget);
  const tripsUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/itinerary`;

  const facts = [
    ["Trip", title],
    ["Dates", `${dates} · ${trip.duration_days} days`],
    ["Travellers", people],
    ["Planned budget", planned],
    ...(spent ? [["Planned cost", spent]] : []),
  ];

  const text =
    `${greeting}\n\n` +
    `Your trip is confirmed. The full day-by-day plan is attached as a PDF.\n\n` +
    facts.map(([label, value]) => `${label}: ${value}`).join("\n") +
    `\n\nOpen it any time at ${tripsUrl}\n\n` +
    `Bookings in the plan are demonstration records — no payment was taken and ` +
    `nothing is reserved with any operator or property.\n\n— TourGenie AI`;

  const rows = facts
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:rgba(244,241,236,0.55);">${label}</td>
          <td style="padding:6px 0;font-size:13px;text-align:right;color:#F4F1EC;">${value}</td>
        </tr>`
    )
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0E1B24;padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#152632;border:1px solid #1A4358;border-radius:16px;padding:32px;color:#F4F1EC;">
      <p style="margin:0 0 4px;font-size:20px;font-weight:600;">TourGenie <span style="color:#EF8354;">AI</span></p>
      <p style="margin:0 0 24px;font-size:13px;color:rgba(244,241,236,0.5);">Trip confirmed</p>
      <p style="margin:0 0 16px;font-size:14px;">${greeting}</p>
      <p style="margin:0 0 20px;font-size:14px;">
        Your trip is confirmed. The full day-by-day plan, reservations and budget are attached as a PDF.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">${rows}</table>
      <p style="margin:0 0 20px;">
        <a href="${tripsUrl}" style="display:inline-block;background:#EF8354;color:#0E1B24;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:999px;">Open my itinerary</a>
      </p>
      <p style="margin:0;font-size:12px;color:rgba(244,241,236,0.4);">
        Bookings in the plan are demonstration records — no payment was taken and nothing is reserved
        with any operator or property.
      </p>
    </div>
  </div>`;

  return { subject: `Your trip is confirmed — ${title}`, text, html };
}
