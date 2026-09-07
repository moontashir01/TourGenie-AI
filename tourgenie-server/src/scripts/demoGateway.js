// npm run demo:gateway
//
// A stand-in for SSLCommerz, for demonstrating payment without a merchant
// account, an internet connection, or a card.
//
// It is deliberately a SEPARATE SERVER speaking the gateway's real protocol,
// not a "skip the payment" branch inside the app. That distinction matters:
//
//   · the API still opens a session, still receives an IPN, still calls the
//     validation endpoint, and still refuses a callback whose amount doesn't
//     match — every check that protects a real payment is exercised;
//   · nothing in the production code path knows this exists. There is no
//     demo-mode flag that could be left switched on.
//
// The only thing that points the app here is SSLCZ_API_BASE. Unset it and the
// app talks to the real sandbox again.
//
// Usage:
//   Terminal 1:  npm run demo:gateway
//   Terminal 2:  SSLCZ_STORE_ID=demo SSLCZ_STORE_PASSWD=demo \
//                SSLCZ_API_BASE=http://127.0.0.1:9900 \
//                PUBLIC_API_URL=http://127.0.0.1:5000/api npm run dev
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.DEMO_GATEWAY_PORT || 9900);

// tran_id → the session as the merchant described it. In memory on purpose:
// a demo that remembers yesterday's transactions is a demo with stale data.
const sessions = new Map();

const money = (n) => `৳${Number(n).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(Object.fromEntries(new URLSearchParams(raw))));
  });
}

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

// The payment methods a Bangladeshi gateway actually offers, grouped the way
// the real hosted page groups them. Card numbers here are the published test
// values every gateway uses — they are not, and cannot be, real accounts.
// Laid out to match the SSLCommerz EasyCheckout modal: merchant badge
// overhanging a centred card, quick links, three payment tabs, then the pay
// bar. Test credentials are the published sandbox ones — they are not, and
// cannot be, real accounts.
const METHOD_GROUPS = [
  {
    id: "cards",
    label: "CARDS",
    methods: [
      { code: "visa", label: "VISA", test: "4111 1111 1111 1111" },
      { code: "master", label: "Mastercard", test: "5555 5555 5555 4444" },
      { code: "amex", label: "AMEX", test: "3782 822463 10005" },
    ],
  },
  {
    id: "mobile",
    label: "MOBILE BANKING",
    methods: [
      { code: "bkash", label: "bKash", tint: "#e2136e", test: "01700000000" },
      { code: "nagad", label: "Nagad", tint: "#ec1c24", test: "01800000000" },
      { code: "rocket", label: "Rocket", tint: "#8c3494", test: "01900000000" },
      { code: "upay", label: "Upay", tint: "#00a651", test: "01600000000" },
    ],
  },
  {
    id: "netbanking",
    label: "NET BANKING",
    methods: [
      { code: "citytouch", label: "City Touch", tint: "#e4002b", test: "demo / demo" },
      { code: "bankasia", label: "Bank Asia", tint: "#00693c", test: "demo / demo" },
      { code: "ibbl", label: "IBBL", tint: "#00733e", test: "demo / demo" },
      { code: "mtbl", label: "MTB", tint: "#c8102e", test: "demo / demo" },
    ],
  },
];

/** The hosted checkout the traveller is redirected to. */
function checkoutPage(session) {
  const payLabel = `PAY ${Math.round(session.amount).toLocaleString()} BDT`;

  const tiles = (group) =>
    group.methods
      .map(
        (m) => `<button type="button" class="tile" data-code="${m.code}" data-kind="${group.id}"
                  data-test="${esc(m.test)}" data-label="${esc(m.label)}">
                  <i style="background:${m.tint || "#8195aa"}"></i>${esc(m.label)}
                </button>`
      )
      .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo Checkout — TourGenie AI</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:#d5d8dc;display:flex;align-items:flex-start;
       justify-content:center;padding:100px 16px 40px;
       font-family:"Segoe UI",Roboto,system-ui,-apple-system,sans-serif;color:#2f3b45}
  .modal{position:relative;width:100%;max-width:462px;background:#fff;border-radius:5px;
         box-shadow:0 6px 26px rgba(0,0,0,.17)}
  .badge{position:absolute;top:-68px;left:50%;transform:translateX(-50%);width:134px;height:134px;
         border-radius:50%;background:#1a9ad6;border:6px solid #fff;display:flex;flex-direction:column;
         align-items:center;justify-content:center;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.13)}
  .badge b{font-size:27px;font-weight:800;letter-spacing:1.5px;line-height:1}
  .badge s{text-decoration:none;font-size:9.5px;letter-spacing:.16em;margin-top:3px;opacity:.92}
  .tools{position:absolute;top:12px;right:13px;display:flex;gap:11px;align-items:center;color:#8a97a3}
  .tools span{cursor:default;font-size:17px;line-height:1}
  .head{padding:74px 20px 0;text-align:center}
  .merchant{font-size:21px;font-weight:600;color:#2f3b45}
  .links{display:flex;justify-content:center;gap:26px;padding:15px 0 17px}
  .link{display:flex;flex-direction:column;align-items:center;gap:5px;color:#3d8ecc;font-size:11.5px;position:relative}
  .link i{width:31px;height:31px;border-radius:50%;border:1.6px solid #ccd4db;display:flex;
          align-items:center;justify-content:center;font-size:14px;font-style:normal;color:#7b8894}
  .link u{position:absolute;top:-4px;right:2px;background:#2e7fc0;color:#fff;border-radius:50%;
          width:16px;height:16px;font-size:9.5px;display:flex;align-items:center;justify-content:center;
          text-decoration:none;font-weight:700}
  .tabs{display:flex;background:#1c9ad6}
  .tab{flex:1;border:0;background:#1c9ad6;color:#fff;font-family:inherit;font-size:12.5px;
       font-weight:600;letter-spacing:.03em;padding:14px 6px;cursor:pointer}
  .tab.on{background:#0d6ea8}
  .panel{display:none;padding:17px 20px 6px}
  .panel.on{display:block}
  .brands{display:flex;align-items:center;gap:9px;margin-bottom:14px}
  .visa{font:italic 800 17px/1 Arial;color:#1a1f71;letter-spacing:-.5px}
  .mc{position:relative;width:34px;height:21px}
  .mc i{position:absolute;top:0;width:21px;height:21px;border-radius:50%}
  .mc i:first-child{left:0;background:#eb001b}
  .mc i:last-child{right:0;background:#f79e1b;mix-blend-mode:multiply}
  .amex{background:#006fcf;color:#fff;font:800 8.5px/1 Arial;padding:6px 5px;border-radius:2px;letter-spacing:.02em}
  .other{color:#3d8ecc;font-size:13.5px;margin-left:2px}
  .fld{margin-bottom:11px}
  .row2{display:flex;gap:11px}
  .row2 .fld{flex:1}
  input{width:100%;border:1px solid #ccd4db;border-radius:3px;padding:13px 12px;font-size:14px;
        font-family:inherit;color:#2f3b45}
  input::placeholder{color:#9aa6b1}
  input:focus{outline:0;border-color:#3d8ecc}
  .cvc{position:relative}
  .cvc:after{content:"▤";position:absolute;right:11px;top:11px;color:#b6c0c9;font-size:15px}
  .save{border:1px solid #ccd4db;border-radius:3px;padding:11px 12px;margin:4px 0 14px}
  .save label{display:flex;align-items:center;gap:9px;font-size:13.5px;color:#4a5661;cursor:pointer}
  .save p{margin:8px 0 0;font-size:12.5px;color:#6c7883;line-height:1.5}
  .save a{color:#3d8ecc;text-decoration:none}
  .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:9px;margin-bottom:13px}
  .tile{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #ccd4db;border-radius:3px;
        padding:12px 10px;font-size:13px;font-weight:600;color:#3f4c58;cursor:pointer;font-family:inherit;text-align:left}
  .tile:hover{border-color:#9aa6b1}
  .tile.on{border-color:#0d6ea8;background:#eef7fc;color:#0d6ea8}
  .tile i{width:8px;height:20px;border-radius:2px;flex:none}
  .hidden{display:none}
  .note{font-size:11.5px;color:#0d6ea8;background:#eef7fc;border:1px solid #bcddf0;border-radius:3px;
        padding:8px 10px;margin-bottom:13px;line-height:1.5}
  .pay{width:100%;border:0;border-top:1px solid #d7dde2;background:#c3ced7;color:#5b6874;
       font-family:inherit;font-size:16.5px;font-weight:600;letter-spacing:.04em;padding:19px;
       border-radius:0 0 5px 5px;cursor:not-allowed;display:flex;align-items:center;justify-content:center;gap:9px}
  .pay.ready{background:#0d6ea8;color:#fff;cursor:pointer}
  .pay.ready:hover{background:#0a5c8c}
  .sim{display:flex;gap:9px;padding:11px 20px 16px}
  .sim button{flex:1;background:#f2f5f7;border:1px solid #d7dde2;border-radius:3px;padding:9px;
              font-size:12px;color:#6c7883;cursor:pointer;font-family:inherit}
  .sim button:hover{background:#e8edf1}
  .foot{text-align:center;font-size:10.5px;color:#8a97a3;padding:0 20px 16px;line-height:1.6}
</style></head>
<body>
<form class="modal" method="POST" action="/pay/${encodeURIComponent(session.tranId)}">
  <div class="badge"><b>DEMO</b><s>SANDBOX</s></div>
  <div class="tools"><span title="Language">🌐</span><span title="Close">✕</span></div>

  <div class="head">
    <div class="merchant">TourGenie AI</div>
  </div>

  <div class="links">
    <span class="link"><i>☎</i>Support</span>
    <span class="link"><i>?</i>FAQ</span>
    <span class="link"><i>🎁</i><u>3</u>Offers</span>
    <span class="link"><i>⇥</i>Login</span>
  </div>

  <div class="tabs">
    ${METHOD_GROUPS.map((g, i) => `<button type="button" class="tab${i === 0 ? " on" : ""}" data-tab="${g.id}">${g.label}</button>`).join("")}
  </div>

  <input type="hidden" name="method" id="method" value="">

  <!-- cards -->
  <div class="panel on" id="p-cards">
    <div class="brands">
      <span class="visa">VISA</span>
      <span class="mc"><i></i><i></i></span>
      <span class="amex">AMEX</span>
      <span class="other">Other Cards</span>
    </div>
    <div class="fld"><input id="c_num" placeholder="Enter Card Number" autocomplete="off"></div>
    <div class="row2">
      <div class="fld"><input id="c_exp" placeholder="MM/YY" autocomplete="off"></div>
      <div class="fld cvc"><input id="c_cvc" placeholder="CVC/CVV" autocomplete="off"></div>
    </div>
    <div class="fld"><input id="c_name" placeholder="Card Holder Name" autocomplete="off"></div>
    <div class="save">
      <label><input type="checkbox" style="width:auto">Save card &amp; remember me</label>
      <p>By checking this box you agree to the <a href="#" onclick="return false">Terms of Service</a></p>
    </div>
    <div class="note" id="cardNote">Sandbox test card — nothing entered here reaches a bank and no real card is charged.</div>
  </div>

  <!-- mobile banking -->
  <div class="panel" id="p-mobile">
    <div class="tiles">${tiles(METHOD_GROUPS[1])}</div>
    <div id="mfsForm" class="hidden">
      <div class="fld"><input id="m_acct" placeholder="Account Number" autocomplete="off"></div>
      <div class="fld"><input id="m_pin" placeholder="PIN" autocomplete="off"></div>
      <div class="note">Sandbox test account — no real wallet is debited.</div>
    </div>
  </div>

  <!-- net banking -->
  <div class="panel" id="p-netbanking">
    <div class="tiles">${tiles(METHOD_GROUPS[2])}</div>
    <div id="nbNote" class="note hidden">Sandbox bank login — no real account is accessed.</div>
  </div>

  <button class="pay" id="pay" type="submit" name="outcome" value="success" disabled>
    <span>☞</span>${payLabel}
  </button>

  <div class="sim">
    <button type="submit" name="outcome" value="fail" formnovalidate>Simulate failure</button>
    <button type="submit" name="outcome" value="cancel" formnovalidate>Cancel</button>
  </div>

  <div class="foot">
    Demonstration gateway for TourGenie AI · transaction ${esc(session.tranId)}<br>
    Simulated environment — no real transaction is processed.
  </div>
</form>

<script>
  var pay = document.getElementById("pay");
  var methodField = document.getElementById("method");

  function enable(code) {
    methodField.value = code;
    pay.classList.add("ready");
    pay.disabled = false;
  }

  // Tabs
  var tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (o) { o.classList.remove("on"); });
      t.classList.add("on");
      document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("on"); });
      document.getElementById("p-" + t.dataset.tab).classList.add("on");
      // Switching tabs clears the choice, the way the real page does.
      methodField.value = "";
      pay.classList.remove("ready");
      pay.disabled = true;
      document.querySelectorAll(".tile").forEach(function (x) { x.classList.remove("on"); });
      if (t.dataset.tab === "cards" && document.getElementById("c_num").value.trim()) enable("card");
    });
  });

  // Typing a card number is enough to arm the button.
  var num = document.getElementById("c_num");
  num.addEventListener("input", function () {
    if (num.value.trim().length >= 12) enable("card");
    else { pay.classList.remove("ready"); pay.disabled = true; methodField.value = ""; }
  });
  // Prefill on focus so a demo doesn't need a card typed from memory.
  num.addEventListener("focus", function () {
    if (!num.value) {
      num.value = "4111 1111 1111 1111";
      document.getElementById("c_exp").value = "12/30";
      document.getElementById("c_cvc").value = "123";
      document.getElementById("c_name").value = "DEMO CARDHOLDER";
      enable("visa");
    }
  });

  // Tiles
  document.querySelectorAll(".tile").forEach(function (b) {
    b.addEventListener("click", function () {
      var panel = b.closest(".panel");
      panel.querySelectorAll(".tile").forEach(function (o) { o.classList.remove("on"); });
      b.classList.add("on");
      if (b.dataset.kind === "mobile") {
        document.getElementById("mfsForm").classList.remove("hidden");
        document.getElementById("m_acct").value = b.dataset.test;
        document.getElementById("m_pin").value = "1234";
      } else {
        document.getElementById("nbNote").classList.remove("hidden");
      }
      enable(b.dataset.code);
    });
  });
</script>
</body></html>`;
}

/** Auto-submitting form — how a real gateway hands the browser back. */
function handoffPage(action, fields) {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return `<!doctype html><html><body style="font-family:system-ui;text-align:center;padding:60px;color:#5b6b7d">
<p>Returning you to TourGenie AI…</p>
<form id="f" method="POST" action="${esc(action)}">${inputs}</form>
<script>document.getElementById("f").submit();</script></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ── session init ───────────────────────────────────────────────────
  if (req.method === "POST" && path.endsWith("/gwprocess/v4/api.php")) {
    const f = await readBody(req);
    const tranId = f.tran_id || crypto.randomUUID();

    sessions.set(tranId, {
      tranId,
      // The amount the MERCHANT declared. Validation later reports this back,
      // which is what makes a tampered callback detectable.
      amount: Number(f.total_amount),
      currency: f.currency || "BDT",
      productName: f.product_name || "TourGenie booking",
      successUrl: f.success_url,
      failUrl: f.fail_url,
      cancelUrl: f.cancel_url,
      ipnUrl: f.ipn_url,
      valueA: f.value_a || "",
      valueB: f.value_b || "",
      status: "PENDING",
      valId: `DEMOVAL-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
      bankTranId: `DEMOBANK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    });

    console.log(`  session opened  ${tranId}  ${money(f.total_amount)}`);
    return send(res, 200, "application/json", JSON.stringify({
      status: "SUCCESS",
      sessionkey: crypto.randomBytes(8).toString("hex"),
      GatewayPageURL: `http://127.0.0.1:${PORT}/pay/${encodeURIComponent(tranId)}`,
    }));
  }

  // ── hosted checkout ────────────────────────────────────────────────
  if (req.method === "GET" && path.startsWith("/pay/")) {
    const session = sessions.get(decodeURIComponent(path.slice(5)));
    if (!session) return send(res, 404, "text/html", "<p>Unknown or expired transaction.</p>");
    return send(res, 200, "text/html", checkoutPage(session));
  }

  // ── the traveller decides ──────────────────────────────────────────
  if (req.method === "POST" && path.startsWith("/pay/")) {
    const session = sessions.get(decodeURIComponent(path.slice(5)));
    if (!session) return send(res, 404, "text/html", "<p>Unknown or expired transaction.</p>");

    const { outcome, method } = await readBody(req);

    if (outcome === "cancel") {
      session.status = "CANCELLED";
      console.log(`  cancelled       ${session.tranId}`);
      return send(res, 200, "text/html", handoffPage(session.cancelUrl, {
        tran_id: session.tranId, status: "CANCELLED", value_a: session.valueA,
      }));
    }

    if (outcome === "fail") {
      session.status = "FAILED";
      console.log(`  failed          ${session.tranId}`);
      return send(res, 200, "text/html", handoffPage(session.failUrl, {
        tran_id: session.tranId, status: "FAILED", error: "Declined by issuing bank (simulated)",
        value_a: session.valueA,
      }));
    }

    session.status = "VALID";
    session.cardType = method || "visa";
    console.log(`  paid            ${session.tranId}  via ${session.cardType}`);

    // Server-to-server first, exactly like the real gateway: the IPN is
    // independent of whether the browser ever makes it back.
    if (session.ipnUrl) {
      fetch(session.ipnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          tran_id: session.tranId, val_id: session.valId, status: "VALID",
          amount: session.amount.toFixed(2), currency: session.currency,
          bank_tran_id: session.bankTranId, card_type: session.cardType,
          value_a: session.valueA, value_b: session.valueB,
        }).toString(),
      })
        .then((r) => console.log(`  ipn delivered   ${session.tranId} -> ${r.status}`))
        .catch((e) => console.log(`  ipn failed      ${session.tranId} -> ${e.message}`));
    }

    return send(res, 200, "text/html", handoffPage(session.successUrl, {
      tran_id: session.tranId, val_id: session.valId, status: "VALID",
      amount: session.amount.toFixed(2), currency: session.currency,
      bank_tran_id: session.bankTranId, card_type: session.cardType,
      value_a: session.valueA, value_b: session.valueB,
    }));
  }

  // ── validation ─────────────────────────────────────────────────────
  // Reports the amount the MERCHANT declared at init, never one supplied by a
  // caller. That is the whole point of the endpoint, and why a forged
  // callback claiming a different figure is caught.
  if (path.endsWith("/validationserverAPI.php")) {
    const valId = url.searchParams.get("val_id");
    const session = [...sessions.values()].find((s) => s.valId === valId);

    if (!session || session.status !== "VALID") {
      return send(res, 200, "application/json", JSON.stringify({ status: "INVALID_TRANSACTION" }));
    }
    return send(res, 200, "application/json", JSON.stringify({
      status: "VALID",
      tran_id: session.tranId,
      val_id: session.valId,
      amount: session.amount.toFixed(2),
      store_amount: (session.amount * 0.9775).toFixed(2), // minus a plausible fee
      currency: session.currency,
      bank_tran_id: session.bankTranId,
      card_type: session.cardType || "VISA",
      tran_date: new Date().toISOString(),
    }));
  }

  // ── refund ─────────────────────────────────────────────────────────
  if (path.endsWith("/merchantTransIDvalidationAPI.php")) {
    const bankTranId = url.searchParams.get("bank_tran_id");
    const session = [...sessions.values()].find((s) => s.bankTranId === bankTranId);
    if (!session) return send(res, 200, "application/json", JSON.stringify({ APIConnect: "INVALID_REQUEST" }));

    session.status = "REFUNDED";
    console.log(`  refunded        ${session.tranId}`);
    return send(res, 200, "application/json", JSON.stringify({
      APIConnect: "DONE", status: "success",
      refund_ref_id: `DEMOREF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      trans_id: session.tranId,
    }));
  }

  // ── operator's view ────────────────────────────────────────────────
  if (path === "/" || path === "/transactions") {
    const rows = [...sessions.values()]
      .map((s) => `<tr><td>${esc(s.tranId)}</td><td>${money(s.amount)}</td><td>${esc(s.status)}</td><td>${esc(s.valueA)}</td></tr>`)
      .join("");
    return send(res, 200, "text/html", `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo gateway</title>
<body style="font-family:system-ui;padding:24px;background:#eef2f6;color:#0f2942">
<h2>Demo payment gateway <span style="font-size:12px;color:#b45309">SIMULATION</span></h2>
<p style="color:#5b6b7d;font-size:13px">Listening on port ${PORT}. ${sessions.size} transaction(s) this run.</p>
<div style="overflow-x:auto"><table cellpadding="8" style="border-collapse:collapse;background:#fff;border-radius:8px;font-size:13px;white-space:nowrap">
<tr style="text-align:left;color:#7a8798"><th>Transaction</th><th>Amount</th><th>Status</th><th>Booking</th></tr>
${rows || '<tr><td colspan="4" style="color:#98a5b4">Nothing yet.</td></tr>'}
</table></div></body>`);
  }

  send(res, 404, "application/json", JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Demo SSLCommerz gateway — SIMULATION, no real money\n`);
  console.log(`  listening   http://127.0.0.1:${PORT}`);
  console.log(`  dashboard   http://127.0.0.1:${PORT}/transactions\n`);
  console.log(`  Point the API at it:`);
  console.log(`    SSLCZ_STORE_ID=demo SSLCZ_STORE_PASSWD=demo \\`);
  console.log(`    SSLCZ_API_BASE=http://127.0.0.1:${PORT} \\`);
  console.log(`    PUBLIC_API_URL=http://127.0.0.1:5000/api npm run dev\n`);
});
