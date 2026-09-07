# TourGenie AI — Feature & Fix Brief (v2)

A implementation prompt for 13 items: 6 bug fixes, 6 new features, and 1 cost
recalibration. Written against the codebase as it stands on 2026-09-08.

**How to use this:** hand an agent one section at a time, not the whole file.
Each section is self-contained — problem, likely root cause, files to touch,
approach, and acceptance criteria. Sections are ordered by dependency in
§Suggested order, not by the numbering below (which follows the original list).

> The original list numbered two different items `12`. They are renumbered
> here as **12 (share trip)** and **13 (print budget)**.

---

## 0. Architecture you must work within

Two apps in one git repo at `/Users/quazimdsadman/Projects`:

| | |
|---|---|
| `tourgenie-ai` | React 19 · Vite · Tailwind · react-router-dom 7 · Recharts · dnd-kit · Leaflet |
| `tourgenie-server` | Node · Express 5 · Mongoose · JWT · nodemailer |

**Backend conventions**
- ESM throughout (`"type": "module"`). No CommonJS.
- `controllers/` hold request handlers, `routes/` only wire them up, `services/`
  wrap anything external or algorithmic, `models/` are Mongoose schemas.
- Every handler is wrapped in `asyncHandler` (`src/utils/asyncHandler.js`).
- Auth via `protect` / `adminOnly` (`src/middleware/auth.js`). Sensitive admin
  actions additionally use `reauth` (`src/middleware/reauth.js`).
- Rate limiting exists at `src/middleware/rateLimit.js` — reuse it, don't invent
  another.
- Route ordering matters: static segments must be registered **before**
  parameterised ones (see `itineraryRoutes.js`, where `/reorder` precedes
  `/:itemId`).
- Mass assignment is a known past bug — controllers allowlist updatable fields
  (see `EDITABLE_ITEM_FIELDS` in `itineraryController.js`). Follow that pattern.

**Frontend conventions**
- One fetch wrapper in `src/lib/api.js` exporting grouped objects (`tripsApi`,
  `hotelApi`, …). Add new endpoints there; never call `fetch` from a component.
- Contexts: `Auth`, `Trip`, `Currency`, `Language`, `Theme`, `Toast`, `Chat`.
  `TripContext` owns `currentTripId` — trip-scoped pages read it rather than
  taking a URL param.
- UI primitives live in `src/components/ui/` (`Button`, `Card`, `Badge`,
  `Stat`, `Toast`, `States`, …). Use them; don't hand-roll new button styles.
- Design tokens in `tailwind.config.js`: `ink`, `paper`, `teal`, `sunset`,
  `gold`, `sand`; fonts `font-display` (Fraunces), `font-body` (Inter),
  `font-mono` (IBM Plex Mono).
- Comments in this codebase explain **why**, not what. Match that.

**Money rule (important, and repeatedly broken)**
Everything is stored and computed in **BDT**. `CurrencyContext.convert()` is
display-only and never written back. `est_cost` on an itinerary item is the
cost for the **whole party**, not per person.

**The one budget source of truth** is
`src/services/budgetEstimator.js` — the Plan-a-Trip preview, trip creation, the
Budget page and the chat estimator all route through it so they cannot disagree.
Any new surface that shows money must call it too rather than recomputing.

---

## 1. Email trip confirmation with PDF itinerary

**Want:** on trip confirmation, email the traveller a confirmation with their
full plan attached as a PDF.

**What already exists:** `src/services/mailer.js` — a working nodemailer
transport over Gmail SMTP (`MAIL_USER` / `MAIL_PASS`), with `sendMail()` that
never throws and falls back to logging when unconfigured. `passwordResetEmail()`
shows the expected `{subject, text, html}` builder shape.

**What's missing:** no PDF generation anywhere, and no "trip confirmed" trigger.

**Approach**
- Decide the trigger. There is no explicit "confirm trip" action today — trip
  `status` moves `draft → planned` when an itinerary is generated
  (`itineraryController.persistItinerary` sets it). Either treat that transition
  as confirmation, or add an explicit `POST /api/trips/:id/confirm`. **Prefer the
  explicit endpoint** so a regeneration doesn't re-send the email.
- Add `src/services/tripPdf.js`. `pdfkit` is the lightest fit for this stack
  (no headless browser, works on Render's free tier). Avoid Puppeteer — the
  memory ceiling on free hosting will not take it.
- Build the document from the same data `TripPrint.jsx` renders: trip header,
  day-by-day items, bookings, budget breakdown. Reuse the corrected totals from
  §13 rather than re-deriving.
- Add `tripConfirmationEmail()` to `mailer.js` alongside the reset builder, and
  extend `sendMail()` to accept `attachments`.
- Send asynchronously — never block the HTTP response on SMTP. Log failures;
  the trip is confirmed whether or not the mail lands.
- Add a `confirmation_email_sent_at` field on `Trip` so a retry or a second
  confirm doesn't spam.

**Acceptance**
- Confirming a trip returns immediately; the email arrives with a PDF attached.
- With `MAIL_USER` unset, confirming still succeeds and logs instead of sending.
- Confirming twice sends once.

---

## 2. Duplicate flights in the itinerary

**Symptom:** the same flight appears twice in a travel item's options.

**Root cause (identified):** in `src/services/travelpayoutsFlights.js`,
`normalize()` builds the offer id as:

```js
id: `tp:${origin}${destination}:${departure || "any"}:${flightNumber}:${perSeat}`
```

The **price is part of the identity**, so one physical flight returned at two
fares becomes two distinct options. Compounding it, the upstream response is
walked with `Object.values(data).flatMap(...)` (~line 104) — Travelpayouts
returns a nested map that can repeat a flight across keys.

**Approach**
- Deduplicate on the flight's real identity: `airline + flight_number +
  departure date-time`. Price must not be part of the key.
- When duplicates collide, keep the **cheapest** and discard the rest.
- Do it inside `searchFlights()` before returning, so both callers benefit —
  `flightController` (the flight panel) and `augmentTravelItems()` in
  `itineraryController.js`.
- Guard the no-flight-number case: some offers carry only an airline code. Fall
  back to `airline + departure` and keep the cheapest.

**Acceptance**
- A leg that previously listed the same flight twice now lists it once, at the
  lower fare.
- Legs with genuinely different flights are unaffected.
- Add a small unit check with a fixture containing a deliberate duplicate.

---

## 3. SSLCommerz payment gateway

**Want:** real payments through SSLCommerz across every paid flow.

**Reality check, state this to the user before building:** the project
proposal (SRS §2.6) explicitly scopes booking as *mock-only, no payment
gateway*. Both `Booking` and `HotelBooking` carry `is_mock: true`. This item
reverses a documented scope decision — worth confirming that's intended, and
the SRS should be updated to match.

**Approach**
- Sandbox first. SSLCommerz issues sandbox `store_id` / `store_passwd`; put them
  in `.env` (`SSLCZ_STORE_ID`, `SSLCZ_STORE_PASSWD`, `SSLCZ_IS_LIVE=false`) and
  document them in `.env.example`.
- New `src/services/sslcommerz.js` — session init, validation, refund. Keep all
  HTTP to the gateway in this one file, matching how `stayApiHotels.js` and
  `travelpayoutsFlights.js` are isolated.
- New `Payment` model: `user_id`, `trip_id`, `booking_ref`, `booking_kind`
  (`transport` | `hotel`), `amount_bdt`, `currency`, `status`
  (`initiated|success|failed|cancelled|refunded`), `tran_id`, `val_id`,
  gateway payload, timestamps. Unique index on `tran_id`.
- New `paymentController` + `paymentRoutes`:
  - `POST /api/payments/init` (auth) → returns the gateway redirect URL
  - `POST /api/payments/ipn` — **public webhook, no `protect`**
  - `POST /api/payments/success|fail|cancel` — gateway redirects
- **Never trust the redirect.** Mark a booking paid only after server-side
  validation against SSLCommerz's validation API, keyed on `val_id`, and only
  when the returned amount matches the stored amount. The redirect is a UX
  signal, not proof.
- Make the IPN idempotent — gateways retry. A repeated `tran_id` must not
  double-confirm.
- Rate-limit the IPN endpoint using the existing `rateLimit` middleware.
- Flip `is_mock` to `false` only on a validated payment; keep the mock path
  working so the demo still runs without gateway credentials.

**Acceptance**
- A sandbox payment moves a booking to confirmed/paid.
- A tampered redirect (amount changed in the query string) does **not** confirm.
- A replayed IPN does not double-confirm.
- With no SSLCommerz credentials configured, the app still runs in mock mode.

---

## 4. Hotel missing from generated itinerary (check-in only, no price)

**Symptom:** after selecting a hotel and generating the itinerary, only a
check-in row appears — no hotel name, no price, no check-out.

**Context:** `Trip` carries both `hotel_id` (single-city) and
`hotel_selections: [{ city, hotel_id }]` (multi-city). `ItineraryItem.category`
already has `checkin` and `checkout` enum values, so the data model supports
this — the AI planner just isn't reliably emitting both, and the rows carry no
hotel identity or cost.

**Approach**
- Don't rely on the model to produce these. **Synthesise check-in and check-out
  rows deterministically** after generation, in `itineraryController`, from
  `trip.hotel_id` / `trip.hotel_selections` — the same way transport options are
  attached by `augmentTravelItems()`.
- Check-in on the arrival day, check-out on the departure day (and on each city
  change for multi-city).
- Put the hotel name in `activity`/`location`, and the **nightly rate × nights ×
  rooms** on the check-out row's `est_cost`, with the nightly rate shown in
  `notes`. Charging the stay once, on check-out, is what the user asked for and
  avoids double-counting against `hotel_id` in the budget.
- Rooms are `ceil(travelers / 2)` — `roomsFor()` already exists in
  `budgetEstimator.js`; import it, don't re-derive.
- Cross-check `expenseController.getVirtualExpenses` — if it already imputes a
  hotel cost, make sure this doesn't double it.

**Acceptance**
- A trip with a selected hotel shows a named check-in row and a named check-out
  row carrying the total stay cost.
- Multi-city trips get a pair per city.
- The Budget page total does not change by adding these rows twice.

---

## 5. "Budget covers flight in and out" → transportation, and broken for international

Two defects in one control.

**5a — wording.** The Plan-a-Trip toggle says *flight*, but the flag governs
intercity transport generally (bus, train, launch, flight). `Trip` stores it as
`budget_includes_flights` (Trip.js:49). Relabel the UI to *"This budget covers
getting there and back"*. Renaming the DB field is optional; if you do rename it
to `budget_includes_transport`, migrate existing documents and update every
reader (`budgetEstimator`, `expenseController`, `Budget.jsx`, `TripPrint.jsx`) —
otherwise just leave the field name and fix the label.

**5b — only works for domestic.** Investigate `budgetEstimator.buildBudgetBreakdown`
and `expenseController`: the intercity leg is added as
`transportFare * travelers * 2`, where `transportFare` comes from
`journeyFinder.findJourney()`. For international trips there is no seeded road
route, so `findJourney` returns nothing and the fare falls to the
Travelpayouts-selected flight (`trip.selected_flight`) — which the toggle does
not consult. Make the flag apply symmetrically: whatever the "getting there"
cost is (ground fare *or* selected flight), the toggle decides whether it counts
toward the budget.

**Acceptance**
- Label reads "transportation", not "flight".
- Toggling it off on an international trip visibly removes the airfare from the
  budget total, exactly as it does for a domestic bus fare.

---

## 6. User-supplied trip name

**Partially exists:** `Trip.title` (Trip.js:64) already holds an auto-generated
string like *"4 days in Cox's Bazar"*. It is never user-editable.

**Approach**
- Add an optional "Trip name" field to the Plan-a-Trip form
  (`src/pages/PlanTrip.jsx`), placed near the destination.
- On create, use the supplied name; fall back to the existing auto-generated
  title when blank — never leave it empty.
- Add `title` to the allowlist in `tripController`'s update handler so it can be
  renamed later.
- Surface it wherever a trip is identified: `Dashboard.jsx` cards, the
  `CurrentTripCard` in `AppShell.jsx`, `CommandPalette` trip entries, page
  headers, and the §1 confirmation email.

**Acceptance**
- Naming a trip "Honeymoon" shows "Honeymoon" on the dashboard, sidebar and
  command palette.
- Leaving it blank still produces a sensible auto title.

---

## 7. Editable budget from the Itinerary page

**Want:** change the trip budget without leaving the itinerary.

**Approach**
- The "Budget snapshot" panel in `src/pages/Itinerary.jsx` becomes editable —
  an inline edit (pencil → number input → save), not a route change.
- `PATCH /api/trips/:id` already exists; confirm `budget` is in its allowlist.
- Respect the currency layer: the user may be entering a non-BDT figure. Follow
  what `PlanTrip.jsx` does with `budget_currency` / `budget_input` and convert
  via `src/utils/currency.js` before storing BDT.
- Re-run `estimateTripBudget` on save so `verdictFor()` (below/tight/comfortable/
  generous) and `budget_breakdown` stay consistent.
- Refresh `TripContext.refreshCurrentTrip()` after saving so the sidebar and
  every other trip-scoped page pick the new figure up.
- Use the existing `Toast` context to confirm the save.

**Acceptance**
- Editing the budget updates the snapshot, the over/under banner, and the Budget
  page without a reload.
- Entering a budget below `minimum_total` shows the same warning the Plan form
  gives, rather than silently accepting it.

---

## 8. Pre-itinerary estimate now reads too low ⚠️ calibration, not a bug

**Read this before touching anything.** On 2026-09-07 the cost baseline was
deliberately cut, at the user's instruction, in this order:

1. `avg_daily_cost` reduced ~30% for **all 25 destinations** — in
   `src/seed/data/destinations.js`, `src/seed/data/countries/thailand.js`, and
   in the live `destinations` collection. Cox's Bazar ৳4,200 → ৳2,900;
   Phuket ৳9,500 → ৳6,700.
2. `CATEGORY_SHARE.attractions` in `src/seed/data/reference.js` cut from
   0.11–0.16 to 0.05–0.08, redistributed to accommodation and food.
3. All 75 `costbenchmarks` rows regenerated from the new model.

Two genuine bug fixes landed in the same pass and should **not** be reverted:
- hotels are now priced per room (`roomsFor()`, `ceil(travelers/2)`) instead of
  once per booking — a family of four was paying for one room;
- local transport is now shared per vehicle (`vehiclesFor()`, 3 per vehicle)
  instead of charged per head.

**So the fix here is re-tuning step 1–3, not rewriting the estimator.**

Backups of the pre-cut seed files: `/tmp/destinations.bak.js`,
`/tmp/thailand.bak.js` (may not survive a reboot — the numbers are recoverable
from git history regardless).

**Approach**
- Agree a target with the user in ৳ per person per day, excluding intercity
  fare. Current mid-range Cox's Bazar lands at ~৳2,300 pp/day; pre-cut it was
  ~৳3,600. A midpoint near ~৳2,800–3,000 is the likely intent.
- Apply by adjusting `avg_daily_cost`, then regenerate `costbenchmarks`. The
  script written for the last pass is at
  `tourgenie-server/tmp/recalibrate.mjs` — it updates the live collection from
  the seed files and rebuilds benchmarks without running the destructive full
  seeder. **Never run `npm run seed` to fix this**; it wipes trips and bookings.
- Keep the seed files and the live DB in step, or the next re-seed silently
  reverts the tuning.

**Acceptance**
- A 3-day / 2-person mid-range Cox's Bazar trip lands within the agreed band.
- `minimum_total < estimated_total` still holds for every destination and tier
  (there is a checker at `tourgenie-server/tmp/floors.mjs`).
- Seed files and live `destinations` agree.

---

## 9. International trip shows all cities, not the selected ones

**Root cause (identified):** `Trip.preferred_cities` (Trip.js:77) is written by
`PlanTrip.jsx:364` and then **never read by any page**. Confirmed by grep — the
only three references in the whole frontend are all in `PlanTrip.jsx`.

Server-side, `hotelController.list` and `attractionController.list` filter only
on the `destination_id` / `city` query params they're given. They have no notion
of a trip.

**Approach**
- Filter by the open trip's `preferred_cities` on `Hotels.jsx` and
  `AttractionPicker.jsx`. Two options:
  - *Client-side:* read `currentTrip.preferred_cities` from `TripContext` and
    pass a city filter per request. Simplest, no API change.
  - *Server-side:* accept `trip_id` on both list endpoints and resolve the city
    set on the server. More robust, and the itinerary generator already does
    exactly this in `loadAttractionContext()` — worth mirroring.
- Prefer the server-side version for consistency with the planner, which already
  narrows its candidate pool to `preferred_cities`.
- Always offer an explicit "show all cities in {country}" escape hatch — a
  traveller may want a hotel in a city they didn't pre-select.
- Single-city trips must be unaffected (`preferred_cities` is empty for them —
  an empty array must mean *no filter*, not *no results*).

**Acceptance**
- A Thailand trip with Phuket + Chiang Mai selected shows only those cities'
  hotels and attractions by default.
- The "show all" toggle restores the full country list.
- Domestic single-destination trips behave exactly as before.

---

## 10. Show the selected cities on the Itinerary page

**Want:** see which cities the trip covers without going to Hotels/Attractions.

**Context:** `Itinerary.jsx` already derives `dayCities` per day from item
`city` fields and renders them as a chip on each day header for multi-city
trips. What's missing is a trip-level summary.

**Approach**
- Add a cities strip near the trip snapshot: the ordered `preferred_cities`
  (or the distinct cities across items), with nights-per-city.
- Nights per city can be derived the way `Itinerary.jsx` already does it for
  hotel cost — each day's last activity marks the city slept in, and the final
  day isn't a night anywhere. Extract that into a small helper rather than
  duplicating the logic a third time.
- Make each city chip a filter/jump to that city's first day.
- Pairs naturally with §4 — once check-in/check-out rows carry hotel names, the
  strip can show the hotel per city too.

**Acceptance**
- A multi-city trip shows "Bangkok · 3 nights → Phuket · 2 nights" above the
  days.
- Single-city trips don't render a redundant one-item strip.

---

## 11. Back button

**Want:** navigate to the previous page.

**Context:** the app is a `BrowserRouter` SPA. Trip-scoped pages are reached
from the sidebar and carry no URL params, so browser Back sometimes lands
somewhere unhelpful. There are already 8 `useNavigate()` call sites.

**Approach**
- Add a reusable `<BackButton />` to `src/components/ui/`, using
  `navigate(-1)`.
- Render it in `AppShell`'s header area, but **conditionally** — hide it on the
  primary landing surfaces (Dashboard, Landing) where there's nothing to go back
  to. Check `window.history.state?.idx > 0` rather than assuming.
- Provide a `fallbackTo` prop (default `/dashboard`) for deep-links opened in a
  fresh tab, where `navigate(-1)` would leave the app entirely.
- On mobile the header is already tight (`AppShell` mobile top bar) — place it
  left of the title, not as an extra row.

**Acceptance**
- Back returns to the previous in-app page.
- Opening a deep link in a new tab and pressing Back goes to the fallback, not
  out of the site.

---

## 12. Share a trip with another user by email

**Want:** one traveller shares a trip; a second registered user sees it in their
account.

**Nothing exists for this.** `Trip.user_id` is a single owner and every trip
query filters on it (`assertOwnsTrip` in `itineraryController.js`,
`tripController`, `expenseController`, …). This is the largest item on the list
— it changes the ownership model that roughly a dozen handlers assume.

**Approach**
- Add `TripShare`: `trip_id`, `owner_id`, `shared_with_user_id`,
  `invited_email`, `role` (`viewer` | `editor`), `status`
  (`pending|accepted|revoked`), `token`, `created_at`. Unique index on
  `{trip_id, invited_email}`.
- Introduce a single helper — `assertCanAccessTrip(tripId, userId, level)` —
  and replace every `assertOwnsTrip` call with it. **Do this as its own commit
  before adding the UI**, so the blast radius is reviewable. Destructive actions
  (delete trip, confirm payment) stay owner-only regardless of role.
- `GET /api/trips` must union owned + accepted-shared trips, and mark which is
  which so the dashboard can badge them.
- Invite by email via the existing `mailer.js`. If the address has no account,
  store the invite as pending and attach it on registration — don't silently
  drop it.
- Editor role and the AI chat interact badly: a chat edit deletes and recreates
  every itinerary row. Either restrict editors from chat-driven edits initially,
  or accept last-write-wins and say so in the UI.

**Acceptance**
- Owner shares by email; recipient sees the trip listed and badged as shared.
- A viewer cannot mutate the itinerary; an editor can.
- Revoking removes access immediately.
- No endpoint leaks a trip to a user with neither ownership nor an accepted
  share — verify by direct API call, not just UI.

---

## 13. Print view budget is wrong

**Root cause (identified):** `src/pages/TripPrint.jsx:114` computes

```js
const itineraryTotal = items.reduce((sum, i) => sum + (i.est_cost || 0), 0);
```

That is activities only. It omits hotel cost and selected-flight cost, and it
skips the `isBookedFlightLeg` rule that `Itinerary.jsx` applies — where a
round-trip fare already covers the day-1 and final-day travel rows, so charging
them again double-counts. The print total therefore disagrees with both the
Itinerary snapshot and the Budget page.

**Approach**
- Stop recomputing in the print view. Read the authoritative figures from
  `GET /api/trips/:tripId/budget` (`expenseController`), which the Budget page
  already uses.
- If a standalone number is still needed, extract the `isBookedFlightLeg` +
  hotel-nights logic out of `Itinerary.jsx` into a shared module both pages
  import. Right now that logic is duplicated and drifting — this is the third
  place it would be written.
- Show the same breakdown rows the Budget page shows, so a printed plan and the
  on-screen budget are line-for-line identical.
- §1's PDF must use this same corrected total.

**Acceptance**
- Print total equals the Budget page total for the same trip, including a trip
  with a selected round-trip flight and a selected hotel.
- Printing a trip with no itinerary doesn't render `৳NaN`.

---

## Suggested order

Dependency-driven, not list order:

1. **§13 print budget** and **§2 flight dedup** — small, isolated, and §13
   produces the shared total that §1 needs.
2. **§8 estimate recalibration** — pure data tuning; do it while the numbers are
   fresh.
3. **§5 transport toggle**, **§6 trip name**, **§11 back button** — small,
   independent.
4. **§9 city filtering**, then **§10 city strip** — §10 reads better once §9's
   city data is trustworthy.
5. **§4 hotel check-in/out rows** — depends on §13's costing being settled.
6. **§7 editable budget** — touches the estimator; do it after §8.
7. **§1 confirmation email + PDF** — needs §13 and §4 to produce a correct
   document.
8. **§12 trip sharing** — largest; do the `assertCanAccessTrip` refactor as its
   own reviewable step.
9. **§3 SSLCommerz** — last, and only after confirming the SRS scope change.

## Ground rules

- Don't run `npm run seed` against the working database — it calls
  `deleteMany({})` across collections and will destroy trips, bookings and
  users. Use targeted scripts (`tmp/recalibrate.mjs` is a working example).
- After editing `.env`, restart the backend — `node --watch` does not reload it.
- Anything showing money goes through `budgetEstimator`. Don't add a fourth
  place that computes a trip total.
- New env vars must be added to `.env.example` as well as `.env`.
- Match the existing comment style: explain the reasoning or the bug being
  prevented, not the syntax.

## Open questions to settle before starting

1. **§3** reverses the SRS's explicit "no payment gateway" scope. Confirmed?
2. **§8** what ৳/person/day should mid-range domestic land at?
3. **§12** can a shared *editor* use the AI chat, given it rewrites the whole
   itinerary?
4. **§1** what counts as "confirming" a trip — the existing
   `draft → planned` transition, or a new explicit action?
