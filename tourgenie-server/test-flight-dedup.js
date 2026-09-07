// Checks that searchFlights() returns one row per physical flight.
//
// Run with `node test-flight-dedup.js`. Like the other test-* scripts at this
// root it is not part of a suite, but unlike them it needs neither a database
// nor a Travelpayouts token: global fetch is stubbed with fixtures, so the
// whole path — the object-map response shape, normalize(), the dedupe — runs
// offline.
//
// The bug it guards: the offer id used to carry the price, so one flight
// cached at two fares came back as two options and a leg listed the same
// departure twice.
import assert from "node:assert/strict";
import { searchFlights } from "./src/services/travelpayoutsFlights.js";

process.env.TRAVELPAYOUTS_API_KEY = "fixture-token";

const AIRLINES = [
  { code: "EK", name: "Emirates", is_lowcost: false },
  { code: "BG", name: "Biman Bangladesh", is_lowcost: false },
  { code: "QR", name: "Qatar Airways", is_lowcost: false },
];

let priceFixture = null;

globalThis.fetch = async (url) => {
  const href = String(url);
  if (href.includes("airlines.json")) {
    return { ok: true, status: 200, json: async () => AIRLINES };
  }
  if (href.includes("prices_for_dates")) {
    return { ok: true, status: 200, json: async () => priceFixture };
  }
  throw new Error(`unexpected fetch: ${href}`);
};

function offer(fields) {
  return { transfers: 0, duration: 340, duration_to: 340, ...fields };
}

const failures = [];
function check(label, run) {
  try {
    run();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures.push(label);
    console.log(`  FAIL ${label}\n       ${err.message}`);
  }
}

// ── one-way, nested object-map response ──────────────────────────────
// EK585 appears three times: twice under one key at two fares, and once more
// under a second key, which is how the upstream map repeats a row. QR has no
// flight number at all, so it keys on airline + departure.
priceFixture = {
  success: true,
  currency: "bdt",
  data: {
    DXB: {
      0: offer({ airline: "EK", flight_number: 585, departure_at: "2026-10-12T04:30:00+06:00", price: 52000 }),
      1: offer({ airline: "EK", flight_number: 585, departure_at: "2026-10-12T04:30:00+06:00", price: 47500 }),
      2: offer({ airline: "EK", flight_number: 583, departure_at: "2026-10-12T19:15:00+06:00", price: 49900 }),
      3: offer({ airline: "BG", flight_number: 47, departure_at: "2026-10-12T09:00:00+06:00", price: 41200 }),
      4: offer({ airline: "QR", flight_number: null, departure_at: "2026-10-12T02:10:00+06:00", price: 61000 }),
      5: offer({ airline: "QR", flight_number: null, departure_at: "2026-10-12T02:10:00+06:00", price: 58000 }),
    },
    DXB_ALT: {
      0: offer({ airline: "EK", flight_number: 585, departure_at: "2026-10-12T04:30:00+06:00", price: 52000 }),
    },
  },
};

const oneWay = await searchFlights({
  origin: "DAC",
  destination: "DXB",
  date: "2026-10-12",
  travelers: 1,
  limit: 10,
});

console.log("one-way leg (6 raw offers for 4 flights):");
for (const f of oneWay) console.log(`    ${f.flightNumber.padEnd(6)} ${f.departure}  ${f.price}`);

check("four distinct flights survive", () => assert.equal(oneWay.length, 4));
check("EK585 appears exactly once", () =>
  assert.equal(oneWay.filter((f) => f.flightNumber === "EK585").length, 1)
);
check("the duplicate is kept at the lower fare", () =>
  assert.equal(oneWay.find((f) => f.flightNumber === "EK585").price, 47500)
);
check("an offer with no flight number still dedupes on airline + departure", () => {
  const qr = oneWay.filter((f) => f.flightNumber === "QR");
  assert.equal(qr.length, 1);
  assert.equal(qr[0].price, 58000);
});
check("genuinely different flights are untouched", () => {
  assert.ok(oneWay.some((f) => f.flightNumber === "EK583"));
  assert.ok(oneWay.some((f) => f.flightNumber === "BG47"));
});
check("price is no longer part of the offer id", () =>
  assert.ok(!oneWay.some((f) => String(f.id).includes(String(f.pricePerSeat))))
);
check("results stay sorted cheapest first", () =>
  assert.deepEqual(
    oneWay.map((f) => f.price),
    [...oneWay.map((f) => f.price)].sort((a, b) => a - b)
  )
);

// ── round trip, array response ───────────────────────────────────────
// Same outbound flight, two different return dates: two real choices, not a
// duplicate. The pair sharing a return date is the duplicate.
priceFixture = {
  success: true,
  currency: "bdt",
  data: [
    offer({
      airline: "EK",
      flight_number: 585,
      departure_at: "2026-10-12T04:30:00+06:00",
      return_at: "2026-10-19T21:00:00+04:00",
      price: 96000,
      duration_back: 300,
    }),
    offer({
      airline: "EK",
      flight_number: 585,
      departure_at: "2026-10-12T04:30:00+06:00",
      return_at: "2026-10-19T21:00:00+04:00",
      price: 91500,
      duration_back: 300,
    }),
    offer({
      airline: "EK",
      flight_number: 585,
      departure_at: "2026-10-12T04:30:00+06:00",
      return_at: "2026-10-20T21:00:00+04:00",
      price: 99000,
      duration_back: 300,
    }),
  ],
};

const roundTrip = await searchFlights({
  origin: "DAC",
  destination: "DXB",
  date: "2026-10-12",
  returnDate: "2026-10-19",
  travelers: 2,
  limit: 10,
});

console.log("\nround trip (3 raw offers for 2 itineraries):");
for (const f of roundTrip) console.log(`    ${f.flightNumber} back ${f.returnAt}  ${f.price}`);

check("two return dates stay two options", () => assert.equal(roundTrip.length, 2));
check("the repeated return date keeps the cheaper fare", () => {
  const same = roundTrip.find((f) => f.returnAt === "2026-10-19T21:00:00+04:00");
  assert.equal(same.price, 91500 * 2); // priced for the whole party
});

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
