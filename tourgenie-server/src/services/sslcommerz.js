// SSLCommerz — the only file that talks to the payment gateway.
//
// Isolated the same way stayApiHotels.js and travelpayoutsFlights.js are: the
// controller decides what a payment means, this decides how to ask SSLCommerz
// about it. Nothing above this layer should know the gateway's field names.
//
// Three calls are used:
//   initSession()    — create a hosted checkout, get a redirect URL
//   validatePayment()— the ONLY proof a payment happened (see the note below)
//   refundPayment()  — reverse a settled transaction
//
// Everything is form-encoded, not JSON: the gateway's v4 API predates that
// convention and rejects an application/json body.
import { trackProvider } from "./providerStatus.js";

const SANDBOX = {
  init: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
  validate: "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php",
  refund: "https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php",
};

const LIVE = {
  init: "https://securepay.sslcommerz.com/gwprocess/v4/api.php",
  validate: "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php",
  refund: "https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php",
};

const TIMEOUT_MS = 20000;

export function isLive() {
  return String(process.env.SSLCZ_IS_LIVE || "").toLowerCase() === "true";
}

function endpoints() {
  // SSLCZ_API_BASE points the three calls at a different host. It exists so
  // the test suite can stand up a local stand-in and exercise this file's real
  // HTTP handling — form encoding, status parsing, timeouts — rather than
  // mocking the module out and testing nothing. Unset in normal use.
  const override = process.env.SSLCZ_API_BASE;
  if (override) {
    const base = override.replace(/\/+$/, "");
    return {
      init: `${base}/gwprocess/v4/api.php`,
      validate: `${base}/validator/api/validationserverAPI.php`,
      refund: `${base}/validator/api/merchantTransIDvalidationAPI.php`,
    };
  }
  return isLive() ? LIVE : SANDBOX;
}

/**
 * With no store credentials the whole payment feature stays switched off and
 * the app runs exactly as it did before — bookings are still created, just
 * without a charge. Every entry point checks this first.
 */
export function isPaymentConfigured() {
  return Boolean(process.env.SSLCZ_STORE_ID && process.env.SSLCZ_STORE_PASSWD);
}

function credentials() {
  return {
    store_id: process.env.SSLCZ_STORE_ID,
    store_passwd: process.env.SSLCZ_STORE_PASSWD,
  };
}

async function postForm(url, fields) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`SSLCommerz returned ${res.status}: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`SSLCommerz returned a non-JSON body: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const qs = new URLSearchParams({ ...params, format: "json" }).toString();
    const res = await fetch(`${url}?${qs}`, { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`SSLCommerz returned ${res.status}: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`SSLCommerz returned a non-JSON body: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Opens a hosted checkout session and returns where to send the traveller.
 *
 * `tran_id` is ours, not the gateway's, and it is what ties the callback back
 * to a Payment row.
 */
export async function initSession({
  tranId,
  amountBdt,
  successUrl,
  failUrl,
  cancelUrl,
  ipnUrl,
  customer,
  product,
}) {
  if (!isPaymentConfigured()) throw new Error("SSLCommerz is not configured");

  const fields = {
    ...credentials(),
    total_amount: Number(amountBdt).toFixed(2),
    currency: "BDT",
    tran_id: tranId,
    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,
    ipn_url: ipnUrl,

    cus_name: customer.name || "TourGenie traveller",
    cus_email: customer.email || "",
    cus_phone: customer.phone || "01700000000",
    cus_add1: customer.address || "Dhaka",
    cus_city: customer.city || "Dhaka",
    cus_country: "Bangladesh",

    product_name: product.name,
    product_category: product.category,
    // "general" tells the gateway this is not a physical shipment, which is
    // what lets shipping_method stay NO and skips the address step.
    product_profile: "general",
    shipping_method: "NO",
    num_of_item: 1,

    // Echoed back untouched on every callback. Carrying the booking reference
    // here means a callback is self-describing even before the DB lookup.
    value_a: product.bookingRef || "",
    value_b: product.bookingKind || "",
  };

  return trackProvider("sslcommerz", async () => {
    const body = await postForm(endpoints().init, fields);
    if (body?.status !== "SUCCESS" || !body?.GatewayPageURL) {
      const reason = body?.failedreason || body?.status || "unknown error";
      throw new Error(`SSLCommerz refused the session: ${reason}`);
    }
    return { redirectUrl: body.GatewayPageURL, sessionKey: body.sessionkey || "", raw: body };
  });
}

/**
 * The only thing that proves a payment happened.
 *
 * The browser is redirected back by the gateway with a POST whose fields the
 * traveller could have edited; the IPN is server-to-server but still arrives
 * unauthenticated. Neither is evidence. This asks SSLCommerz directly, over a
 * channel authenticated with the store password, what a val_id is worth — and
 * the caller then checks the amount it reports against the amount we stored.
 *
 * VALID  — settled now.
 * VALIDATED — settled earlier and being re-reported (a retry). Both count.
 */
export async function validatePayment(valId) {
  if (!isPaymentConfigured()) throw new Error("SSLCommerz is not configured");
  if (!valId) throw new Error("val_id is required to validate a payment");

  return trackProvider("sslcommerz", async () => {
    const body = await getJson(endpoints().validate, { val_id: valId, ...credentials() });
    return {
      // A gateway that answers "this val_id is not valid" is a successful
      // call with a negative answer, not a provider outage — so this resolves
      // rather than throwing, and the caller decides what to do about it.
      ok: body?.status === "VALID" || body?.status === "VALIDATED",
      status: body?.status || "UNKNOWN",
      tranId: body?.tran_id || "",
      // The gateway sends these as strings.
      amount: Number(body?.amount ?? NaN),
      storeAmount: Number(body?.store_amount ?? NaN),
      currency: String(body?.currency || "").toUpperCase(),
      bankTranId: body?.bank_tran_id || "",
      cardType: body?.card_type || "",
      raw: body,
    };
  });
}

/** Reverses a settled transaction. Keys on bank_tran_id, not val_id. */
export async function refundPayment({ bankTranId, amountBdt, remarks }) {
  if (!isPaymentConfigured()) throw new Error("SSLCommerz is not configured");
  if (!bankTranId) throw new Error("bank_tran_id is required to refund");

  const body = await getJson(endpoints().refund, {
    ...credentials(),
    bank_tran_id: bankTranId,
    refund_amount: Number(amountBdt).toFixed(2),
    refund_remarks: remarks || "TourGenie AI booking cancellation",
  });

  const status = String(body?.APIConnect || body?.status || "").toUpperCase();
  return {
    ok: status === "DONE" || String(body?.status || "").toLowerCase() === "success",
    refundRef: body?.refund_ref_id || "",
    status,
    raw: body,
  };
}

export default { isPaymentConfigured, isLive, initSession, validatePayment, refundPayment };
