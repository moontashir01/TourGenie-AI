import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import Button from "./ui/Button";
import { paymentApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

// FR-08 — hands a booking off to SSLCommerz.
//
// Deliberately thin: it asks the API to open a session and then leaves the
// site. Whether the money arrived is decided server-side against the gateway's
// validation API, so there is nothing to interpret here and no success state
// to fake — the traveller comes back to /booking?payment=… and the page reads
// the booking's real status.
export default function PayButton({ bookingKind, bookingRef, amount, disabled, size = "sm", fullWidth = false }) {
  const toast = useToast();
  const [starting, setStarting] = useState(false);

  async function pay() {
    setStarting(true);
    try {
      const { redirect_url, is_sandbox } = await paymentApi.init(bookingKind, bookingRef);
      if (is_sandbox) {
        // Worth saying out loud — a sandbox card charge looks identical to a
        // real one right up until someone checks their statement.
        toast.info("Sandbox payment", "This is SSLCommerz's test gateway. No real money moves.");
      }
      window.location.href = redirect_url;
    } catch (err) {
      if (err.code === "payment_not_configured" || err.status === 503) {
        toast.info(
          "Online payment is off",
          "This server has no payment gateway configured, so bookings stay demonstration records."
        );
      } else if (err.status === 409) {
        toast.info("Nothing to pay", err.message);
      } else {
        toast.error("Couldn't start the payment", err.message);
      }
      setStarting(false);
    }
    // No setStarting(false) on success — the browser is navigating away, and
    // resetting it would flash the idle label over a page that is leaving.
  }

  return (
    <div className={fullWidth ? "flex flex-col items-center gap-1 w-full" : "inline-flex flex-col items-end gap-1"}>
      <Button
        onClick={pay}
        loading={starting}
        disabled={disabled}
        variant="teal"
        size={size}
        icon={CreditCard}
        fullWidth={fullWidth}
      >
        {starting ? "Opening gateway…" : `Pay ৳${Math.round(amount || 0).toLocaleString()}`}
      </Button>
      <span className="inline-flex items-center gap-1 text-[10px] text-ink-900/40">
        <ShieldCheck className="w-3 h-3" /> Secured by SSLCommerz
      </span>
    </div>
  );
}
