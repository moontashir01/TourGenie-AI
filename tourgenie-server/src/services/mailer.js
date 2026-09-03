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
export async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();

  if (!transport) {
    console.warn(
      `[mailer] MAIL_USER/MAIL_PASS not set — email not sent.\n` +
        `  to: ${to}\n  subject: ${subject}\n  body: ${text}`
    );
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const from = process.env.MAIL_FROM || `TourGenie AI <${process.env.MAIL_USER}>`;
    const info = await transport.sendMail({ from, to, subject, text, html });
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
