// Payment settlement, against a stand-in SSLCommerz.
//
// The gateway is impersonated by a real HTTP server on localhost rather than
// mocked at the module boundary, so sslcommerz.js runs its actual form
// encoding, status parsing and JSON handling. What is under test is the rule
// that matters: a callback is only ever a prompt to go and ask the gateway,
// and the answer is checked against the amount frozen before the traveller
// left.
//
// Runs against its own database (…/tourgenie_paytest), created and dropped
// per run, so it can never touch real trips or bookings.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import "dotenv/config";

// The stand-in decides what each val_id is worth.
const ledger = new Map();
let gateway;
let gatewayUrl;

function startGateway() {
  return new Promise((resolve) => {
    gateway = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");

      if (url.pathname.endsWith("/gwprocess/v4/api.php")) {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const fields = Object.fromEntries(new URLSearchParams(body));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "SUCCESS",
              sessionkey: "sess_test",
              GatewayPageURL: `http://localhost/pay/${fields.tran_id}`,
              received_amount: fields.total_amount,
            })
          );
        });
        return;
      }

      if (url.pathname.endsWith("/validationserverAPI.php")) {
        const entry = ledger.get(url.searchParams.get("val_id"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(entry || { status: "INVALID_TRANSACTION" }));
        return;
      }

      res.writeHead(404).end("{}");
    });
    gateway.listen(0, "127.0.0.1", () => {
      gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;
      resolve();
    });
  });
}

let Payment, Booking, settlePayment;
const TRIP_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

before(async () => {
  await startGateway();
  process.env.SSLCZ_STORE_ID = "teststore";
  process.env.SSLCZ_STORE_PASSWD = "testpass";
  process.env.SSLCZ_IS_LIVE = "false";
  process.env.SSLCZ_API_BASE = gatewayUrl;

  const base = process.env.MONGODB_URI;
  assert.ok(base, "MONGODB_URI must be set to run these tests");
  // Swap the database name so the real one is never opened.
  await mongoose.connect(base.replace(/\/([^/?]+)(\?|$)/, "/tourgenie_paytest$2"));
  assert.equal(mongoose.connection.name, "tourgenie_paytest");

  ({ default: Payment } = await import("../src/models/Payment.js"));
  ({ default: Booking } = await import("../src/models/Booking.js"));
  ({ __test__: { settlePayment } } = await import("../src/controllers/paymentController.js"));
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  gateway?.close();
});

/** A booking priced at `amount`, and an initiated payment for it. */
async function seedPayable(amount, tranId) {
  const booking = await Booking.create({
    trip_id: TRIP_ID,
    transport_id: new mongoose.Types.ObjectId(),
    passengers: ["Test Traveller"],
    total_fare: amount,
    reference: `TG-${tranId.slice(-6)}`,
    status: "pending",
    payment_status: "pending",
  });
  const payment = await Payment.create({
    user_id: USER_ID,
    trip_id: TRIP_ID,
    booking_kind: "transport",
    booking_ref: booking.reference,
    booking_id: booking._id,
    amount_bdt: amount,
    tran_id: tranId,
    status: "initiated",
  });
  return { booking, payment };
}

test("a validated payment confirms the booking and clears the mock flag", async () => {
  const { booking } = await seedPayable(4500, "TRAN-HAPPY");
  ledger.set("VAL-HAPPY", {
    status: "VALID",
    tran_id: "TRAN-HAPPY",
    amount: "4500.00",
    currency: "BDT",
    bank_tran_id: "BANK-1",
    card_type: "VISA",
  });

  const result = await settlePayment({ tranId: "TRAN-HAPPY", valId: "VAL-HAPPY", payload: {} });
  assert.equal(result.ok, true);

  const after = await Booking.findById(booking._id);
  assert.equal(after.payment_status, "paid");
  assert.equal(after.status, "confirmed");
  assert.equal(after.is_mock, false, "a real payment must clear is_mock");
});

test("a tampered amount is refused and the booking stays unpaid", async () => {
  const { booking } = await seedPayable(9000, "TRAN-TAMPER");
  // The gateway's truth: 1 taka. The callback will claim 9000.
  ledger.set("VAL-TAMPER", {
    status: "VALID",
    tran_id: "TRAN-TAMPER",
    amount: "1.00",
    currency: "BDT",
    bank_tran_id: "BANK-2",
  });

  const result = await settlePayment({
    tranId: "TRAN-TAMPER",
    valId: "VAL-TAMPER",
    payload: { amount: "9000.00", status: "VALID" }, // the forged claim
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "validation_failed");
  assert.match(result.detail, /amount mismatch/);

  const after = await Booking.findById(booking._id);
  assert.notEqual(after.payment_status, "paid");
  assert.equal(after.is_mock, true, "an unvalidated payment must not clear is_mock");
});

test("a val_id the gateway does not recognise is refused", async () => {
  const { booking } = await seedPayable(1200, "TRAN-FORGED");
  const result = await settlePayment({ tranId: "TRAN-FORGED", valId: "VAL-NOT-REAL", payload: {} });

  assert.equal(result.ok, false);
  const after = await Booking.findById(booking._id);
  assert.notEqual(after.payment_status, "paid");
});

test("a replayed IPN does not settle twice", async () => {
  const { booking, payment } = await seedPayable(2500, "TRAN-REPLAY");
  ledger.set("VAL-REPLAY", {
    status: "VALID",
    tran_id: "TRAN-REPLAY",
    amount: "2500.00",
    currency: "BDT",
    bank_tran_id: "BANK-3",
  });

  const first = await settlePayment({ tranId: "TRAN-REPLAY", valId: "VAL-REPLAY", payload: {} });
  assert.equal(first.ok, true);
  assert.notEqual(first.already, true);

  const settledAt = (await Payment.findById(payment._id)).validated_at;

  for (const _ of [1, 2, 3]) {
    const again = await settlePayment({ tranId: "TRAN-REPLAY", valId: "VAL-REPLAY", payload: {} });
    assert.equal(again.ok, true);
    assert.equal(again.already, true, "a replay must report as already settled");
  }

  const rows = await Payment.find({ tran_id: "TRAN-REPLAY" });
  assert.equal(rows.length, 1, "a replay must not create a second payment row");
  assert.deepEqual(
    (await Payment.findById(payment._id)).validated_at,
    settledAt,
    "a replay must not move the settlement timestamp"
  );
  assert.equal((await Booking.findById(booking._id)).payment_status, "paid");
});

test("concurrent callbacks (IPN racing the redirect) settle exactly once", async () => {
  const { payment } = await seedPayable(3300, "TRAN-RACE");
  ledger.set("VAL-RACE", {
    status: "VALID",
    tran_id: "TRAN-RACE",
    amount: "3300.00",
    currency: "BDT",
    bank_tran_id: "BANK-4",
  });

  const results = await Promise.all(
    [1, 2, 3, 4].map(() => settlePayment({ tranId: "TRAN-RACE", valId: "VAL-RACE", payload: {} }))
  );
  assert.ok(results.every((r) => r.ok));
  const fresh = results.filter((r) => !r.already);
  assert.equal(fresh.length, 1, "exactly one caller should win the settlement");
  assert.equal((await Payment.findById(payment._id)).status, "success");
});

test("an unknown transaction id is rejected", async () => {
  const result = await settlePayment({ tranId: "TRAN-NOPE", valId: "VAL-HAPPY", payload: {} });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unknown_transaction");
});

test("a callback with no val_id fails the payment rather than settling it", async () => {
  const { booking } = await seedPayable(800, "TRAN-NOVAL");
  const result = await settlePayment({ tranId: "TRAN-NOVAL", valId: "", payload: {} });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_val_id");
  assert.notEqual((await Booking.findById(booking._id)).payment_status, "paid");
});

test("with no store credentials the feature reports itself unconfigured", async () => {
  const { isPaymentConfigured } = await import("../src/services/sslcommerz.js");
  const id = process.env.SSLCZ_STORE_ID;
  const pass = process.env.SSLCZ_STORE_PASSWD;
  try {
    delete process.env.SSLCZ_STORE_ID;
    delete process.env.SSLCZ_STORE_PASSWD;
    assert.equal(isPaymentConfigured(), false);
  } finally {
    process.env.SSLCZ_STORE_ID = id;
    process.env.SSLCZ_STORE_PASSWD = pass;
  }
  assert.equal(isPaymentConfigured(), true);
});
