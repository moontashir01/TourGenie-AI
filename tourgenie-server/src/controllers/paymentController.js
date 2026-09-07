// Real payments, through SSLCommerz.
//
// The proposal (SRS §2.6) originally scoped booking as mock-only. That
// decision was reversed deliberately; the mock path is kept alive underneath
// so the app still demonstrates end to end on a machine with no gateway
// credentials.
//
// The security model, in one line: the browser is never believed. A redirect
// carrying "status=VALID&amount=1" is a claim made by whoever controls the
// browser, and the IPN is an unauthenticated POST from the open internet.
// Both are treated as nothing more than a nudge to go and ask SSLCommerz
// directly, over a channel signed with the store password, what actually
// happened — and then to check the answer against the amount we froze before
// the traveller ever left the site.
import crypto from "node:crypto";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import HotelBooking from "../models/HotelBooking.js";
import Trip from "../models/Trip.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  isPaymentConfigured,
  isLive,
  initSession,
  validatePayment,
  refundPayment,
} from "../services/sslcommerz.js";

const MODELS = { transport: Booking, hotel: HotelBooking };

/** What a booking of each kind costs, and who owns it. */
function describeBooking(kind, doc) {
  if (kind === "transport") {
    return {
      amount: doc.total_fare,
      label: `Transport booking ${doc.reference}`,
      category: "transport",
    };
  }
  return {
    amount: doc.total_amount,
    label: `Hotel booking ${doc.reference}`,
    category: "accommodation",
  };
}

// Ours, not the gateway's, and the idempotency key for every callback. The
// random half is what stops a second attempt on the same booking colliding
// with the first — retries are normal, a duplicate key error is not.
function makeTranId(kind) {
  return `TG${kind === "hotel" ? "H" : "T"}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function publicApiBase(req) {
  // The gateway calls these back, so they must be reachable from the internet
  // — on localhost the IPN simply never arrives, which is why the redirect
  // handlers settle too rather than relying on the webhook alone.
  return (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}/api`).replace(/\/+$/, "");
}

function clientBase() {
  return (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");
}

/**
 * POST /api/payments/init — open a checkout session for one booking.
 */
export const initPayment = asyncHandler(async (req, res) => {
  if (!isPaymentConfigured()) {
    return res.status(503).json({
      message:
        "Online payment isn't configured on this server. Bookings still work — they're recorded as demonstration reservations.",
      code: "payment_not_configured",
    });
  }

  const { booking_kind: kind, booking_ref: ref } = req.body;
  if (!MODELS[kind]) return res.status(400).json({ message: "booking_kind must be 'transport' or 'hotel'" });
  if (!ref) return res.status(400).json({ message: "booking_ref is required" });

  const booking = await MODELS[kind].findOne({ reference: ref });
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  // Transport bookings carry user_id optionally, so ownership is confirmed
  // through the trip in both cases — that is the row that is definitely ours.
  // Deliberately the owner and nobody else: a shared editor may plan the
  // trip, but paying for it is not theirs to do. This is the one trip lookup
  // that does not go through tripAccess, and that is the point.
  const trip = await Trip.findOne({ _id: booking.trip_id, user_id: req.user._id }).select("_id title destination");
  if (!trip) return res.status(404).json({ message: "Booking not found" });

  if (booking.status === "cancelled") {
    return res.status(409).json({ message: "That booking has been cancelled." });
  }
  if (booking.payment_status === "paid") {
    return res.status(409).json({ message: "That booking is already paid for.", code: "already_paid" });
  }

  const { amount, label, category } = describeBooking(kind, booking);
  if (!(amount > 0)) return res.status(400).json({ message: "That booking has nothing to pay." });

  const tranId = makeTranId(kind);
  const apiBase = publicApiBase(req);

  // Written before the redirect: this row is the amount of record, and every
  // later callback is checked against it.
  const payment = await Payment.create({
    user_id: req.user._id,
    trip_id: booking.trip_id,
    booking_kind: kind,
    booking_ref: booking.reference,
    booking_id: booking._id,
    amount_bdt: Math.round(amount),
    currency: "BDT",
    tran_id: tranId,
    status: "initiated",
    is_sandbox: !isLive(),
  });

  try {
    const session = await initSession({
      tranId,
      amountBdt: payment.amount_bdt,
      successUrl: `${apiBase}/payments/success`,
      failUrl: `${apiBase}/payments/fail`,
      cancelUrl: `${apiBase}/payments/cancel`,
      ipnUrl: `${apiBase}/payments/ipn`,
      customer: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || "",
        city: trip.destination || "Dhaka",
      },
      product: { name: label, category, bookingRef: booking.reference, bookingKind: kind },
    });

    payment.init_response = session.raw;
    await payment.save();

    // Only now does the booking start waiting on money.
    booking.payment_status = "pending";
    await booking.save();

    return res.status(201).json({
      redirect_url: session.redirectUrl,
      tran_id: tranId,
      amount_bdt: payment.amount_bdt,
      is_sandbox: !isLive(),
    });
  } catch (error) {
    payment.status = "failed";
    payment.failure_reason = error.message;
    await payment.save();
    return res.status(502).json({ message: `Couldn't open a payment session — ${error.message}` });
  }
});

/**
 * The single place a payment is settled, shared by the IPN and the browser
 * redirect. Safe to call repeatedly with the same transaction: the first call
 * that flips the row out of a settleable state wins, every later one reports
 * `already_settled` and changes nothing.
 */
async function settlePayment({ tranId, valId, payload }) {
  if (!tranId) return { ok: false, reason: "missing_tran_id" };

  const payment = await Payment.findOne({ tran_id: tranId });
  if (!payment) return { ok: false, reason: "unknown_transaction" };

  if (payment.status === "success") return { ok: true, already: true, payment };
  if (payment.status === "refunded") return { ok: false, reason: "already_refunded", payment };

  if (!valId) {
    payment.callback_payload = payload || payment.callback_payload;
    payment.status = "failed";
    payment.failure_reason = "Callback carried no val_id";
    await payment.save();
    return { ok: false, reason: "missing_val_id", payment };
  }

  const check = await validatePayment(valId);

  // Each of these is a way a forged or stale callback gets rejected.
  const problems = [];
  if (!check.ok) problems.push(`gateway status ${check.status}`);
  if (check.tranId && check.tranId !== payment.tran_id) problems.push("transaction id mismatch");
  if (!Number.isFinite(check.amount)) problems.push("gateway reported no amount");
  // Compared against what we stored before the traveller left the site, which
  // is what makes an edited amount in the redirect worthless.
  else if (Math.round(check.amount) !== payment.amount_bdt) {
    problems.push(`amount mismatch: gateway ${check.amount} vs booking ${payment.amount_bdt}`);
  }
  if (check.currency && check.currency !== payment.currency) problems.push("currency mismatch");

  if (problems.length) {
    payment.status = "failed";
    payment.failure_reason = problems.join("; ");
    payment.val_id = valId;
    payment.callback_payload = payload || payment.callback_payload;
    payment.validation_response = check.raw;
    await payment.save();
    return { ok: false, reason: "validation_failed", detail: payment.failure_reason, payment };
  }

  // Atomic claim. Two callbacks arriving together (the IPN and the redirect
  // race routinely) both reach here; only the one that finds the row still
  // unsettled gets to mark the booking paid.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ["initiated", "failed"] } },
    {
      $set: {
        status: "success",
        val_id: valId,
        bank_tran_id: check.bankTranId,
        card_type: check.cardType,
        validation_response: check.raw,
        callback_payload: payload || null,
        failure_reason: "",
        validated_at: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!claimed) {
    const current = await Payment.findById(payment._id);
    return { ok: true, already: true, payment: current };
  }

  const Model = MODELS[claimed.booking_kind];
  await Model.updateOne(
    { _id: claimed.booking_id },
    {
      $set: {
        payment_status: "paid",
        status: "confirmed",
        // Only a validated payment earns this. Everything else in the app
        // stays a demonstration reservation.
        is_mock: false,
      },
    }
  );

  return { ok: true, payment: claimed };
}

/**
 * POST /api/payments/ipn — server-to-server notification. Public by
 * necessity: SSLCommerz has no credential to present. It proves nothing on
 * its own, which is why settlePayment re-validates before believing it.
 */
export const handleIpn = asyncHandler(async (req, res) => {
  const body = { ...req.body, ...req.query };
  const result = await settlePayment({
    tranId: body.tran_id,
    valId: body.val_id,
    payload: body,
  });

  // Always 200. A non-2xx makes the gateway retry, and the only failures here
  // are permanent ones (forged, unknown, or already-settled) that a retry
  // cannot improve.
  res.json({ received: true, settled: Boolean(result.ok), reason: result.reason || null });
});

/** Where to send the browser once the gateway hands it back. */
function returnUrl(outcome, ref, detail) {
  const qs = new URLSearchParams({ payment: outcome, ...(ref && { ref }), ...(detail && { detail }) });
  return `${clientBase()}/booking?${qs.toString()}`;
}

/**
 * POST /api/payments/success — the gateway redirecting the traveller back.
 *
 * This settles as well as the IPN, because on localhost (and any host the
 * gateway can't reach) the IPN never arrives at all. Both paths run the same
 * validation, and the idempotency in settlePayment is what makes running both
 * harmless.
 */
export const handleSuccess = asyncHandler(async (req, res) => {
  const body = { ...req.body, ...req.query };
  const result = await settlePayment({ tranId: body.tran_id, valId: body.val_id, payload: body });
  const ref = result.payment?.booking_ref || body.value_a || "";

  if (result.ok) return res.redirect(303, returnUrl("success", ref));
  return res.redirect(303, returnUrl("failed", ref, result.detail || result.reason));
});

export const handleFail = asyncHandler(async (req, res) => {
  const body = { ...req.body, ...req.query };
  const payment = body.tran_id ? await Payment.findOne({ tran_id: body.tran_id }) : null;
  if (payment && payment.status === "initiated") {
    payment.status = "failed";
    payment.failure_reason = body.error || "Payment failed at the gateway";
    payment.callback_payload = body;
    await payment.save();
    await MODELS[payment.booking_kind].updateOne(
      { _id: payment.booking_id, payment_status: "pending" },
      { $set: { payment_status: "failed" } }
    );
  }
  res.redirect(303, returnUrl("failed", payment?.booking_ref || body.value_a || ""));
});

export const handleCancel = asyncHandler(async (req, res) => {
  const body = { ...req.body, ...req.query };
  const payment = body.tran_id ? await Payment.findOne({ tran_id: body.tran_id }) : null;
  if (payment && payment.status === "initiated") {
    payment.status = "cancelled";
    payment.callback_payload = body;
    await payment.save();
    // Back to "no charge attempted" so the traveller can simply try again.
    await MODELS[payment.booking_kind].updateOne(
      { _id: payment.booking_id, payment_status: "pending" },
      { $set: { payment_status: "not_required" } }
    );
  }
  res.redirect(303, returnUrl("cancelled", payment?.booking_ref || body.value_a || ""));
});

/**
 * GET /api/payments/:tranId — what happened, for the page the traveller lands
 * back on. Scoped to the owner so a transaction id can't be enumerated.
 */
export const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ tran_id: req.params.tranId, user_id: req.user._id }).select(
    "-init_response -validation_response -callback_payload"
  );
  if (!payment) return res.status(404).json({ message: "Payment not found" });
  res.json({ payment });
});

/** GET /api/payments — this traveller's payment history. */
export const listPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user_id: req.user._id })
    .select("-init_response -validation_response -callback_payload")
    .sort({ created_at: -1 })
    .limit(50);
  res.json({ payments });
});

/**
 * POST /api/payments/:tranId/refund — reverse a settled payment.
 *
 * Owner-initiated, and only for a booking that has been cancelled, so this
 * cannot be used to claw money back on a reservation still standing.
 */
export const refund = asyncHandler(async (req, res) => {
  if (!isPaymentConfigured()) return res.status(503).json({ message: "SSLCommerz is not configured" });

  const payment = await Payment.findOne({ tran_id: req.params.tranId, user_id: req.user._id });
  if (!payment) return res.status(404).json({ message: "Payment not found" });
  if (payment.status === "refunded") return res.status(409).json({ message: "Already refunded." });
  if (payment.status !== "success") return res.status(409).json({ message: "Only a settled payment can be refunded." });

  const booking = await MODELS[payment.booking_kind].findById(payment.booking_id);
  if (!booking || booking.status !== "cancelled") {
    return res.status(409).json({ message: "Cancel the booking first, then request the refund." });
  }

  const result = await refundPayment({
    bankTranId: payment.bank_tran_id,
    amountBdt: payment.amount_bdt,
    remarks: `TourGenie booking ${payment.booking_ref} cancelled`,
  });

  if (!result.ok) {
    return res.status(502).json({ message: `The gateway refused the refund (${result.status}).` });
  }

  payment.status = "refunded";
  payment.refunded_at = new Date();
  payment.refund_ref = result.refundRef;
  payment.refund_amount = payment.amount_bdt;
  await payment.save();
  await MODELS[payment.booking_kind].updateOne(
    { _id: payment.booking_id },
    { $set: { payment_status: "refunded" } }
  );

  res.json({ message: "Refund requested.", refund_ref: result.refundRef });
});

// Exported for the tests, which exercise settlement without a live gateway.
export const __test__ = { settlePayment };

export default { initPayment, handleIpn, handleSuccess, handleFail, handleCancel, getPayment, listPayments, refund };
