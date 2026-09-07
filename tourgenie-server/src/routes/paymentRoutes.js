import { Router } from "express";
import express from "express";
import {
  initPayment,
  handleIpn,
  handleSuccess,
  handleFail,
  handleCancel,
  getPayment,
  listPayments,
  refund,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

// SSLCommerz posts application/x-www-form-urlencoded, and server.js installs
// only express.json(). Without this the callback bodies arrive empty and every
// payment silently fails to settle. Scoped to this router so the rest of the
// API keeps its JSON-only contract.
const gatewayBody = express.urlencoded({ extended: false });

// The callbacks are unauthenticated by necessity — the gateway has no token to
// present — so they are keyed on IP and capped. A flood of forged IPNs costs
// one validation call each otherwise.
const callbackLimiter = rateLimit({
  name: "payment-callback",
  max: 60,
  windowMs: 60 * 1000,
  message: "Too many payment callbacks from this address.",
  key: (req) => String(req.ip),
});

// Opening a session costs a gateway call and writes a row, so it is capped per
// account rather than per address.
const initLimiter = rateLimit({
  name: "payment-init",
  max: 10,
  windowMs: 5 * 60 * 1000,
  message: "Too many payment attempts. Please wait a few minutes and try again.",
});

// — traveller-facing, authenticated —
router.post("/init", protect, initLimiter, initPayment);
router.get("/", protect, listPayments);

// — gateway-facing, public —
// Registered before the /:tranId routes below: those would otherwise capture
// "ipn", "success", "fail" and "cancel" as transaction ids.
router.post("/ipn", callbackLimiter, gatewayBody, handleIpn);
router.post("/success", callbackLimiter, gatewayBody, handleSuccess);
router.post("/fail", callbackLimiter, gatewayBody, handleFail);
router.post("/cancel", callbackLimiter, gatewayBody, handleCancel);
// Some gateway configurations issue the redirect as a GET.
router.get("/success", callbackLimiter, handleSuccess);
router.get("/fail", callbackLimiter, handleFail);
router.get("/cancel", callbackLimiter, handleCancel);

// — traveller-facing, authenticated, parameterised —
router.get("/:tranId", protect, getPayment);
router.post("/:tranId/refund", protect, refund);

export default router;
