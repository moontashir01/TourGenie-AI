# TourGenie AI — Database Reference

MongoDB Atlas, database `tourgenie`. **34 collections**, every feature in the
SRS answered by a database query rather than a third-party API call.

The 12 collections documented in the proposal (§4.1) are unchanged — every
field listed there still exists with the same name and type. The other 22
collections hold data that was previously fetched live (weather, routes,
nearby places, hotels, flights) or hardcoded in the frontend (packing lists,
budget category colours, interest chips, UI strings).

---

## 1. Why the data moved into MongoDB

The proposal's §2.5 lists six external services: OpenWeather, OpenRouteService,
Overpass, Travelpayouts, Cloudinary and an LLM provider. Depending on them at
request time creates four problems for a graded capstone:

| Problem | Consequence |
|---|---|
| Free-tier quotas | StayAPI's free tier is 50 requests *total*. A demo can exhaust it. |
| Network dependency | No internet at the demo venue means no itinerary, no map, no weather. |
| Non-determinism | The same trip gives different answers on different days. Hard to test, hard to demo twice. |
| Latency | NFR-01 asks for queries under 500 ms; external APIs are outside your control. |

Every one of those goes away when the data lives in the database. The
external integrations remain available as an *enrichment* path — e.g. an LLM
refining a plan the template engine already produced — rather than a
dependency the app cannot run without.

---

## 2. Collection map by functional requirement

| FR | Feature | Collections |
|---|---|---|
| FR-01, FR-02 | Registration, login | `users` |
| FR-03 | Trip creation | `trips`, `destinations`, `interesttags` |
| FR-04 | AI itinerary generation | `itinerarytemplates`, `itineraryitems`, `attractions` |
| FR-05 | AI chat assistant | `chatintents`, `chatsessions` |
| FR-06 | Route optimization | `routes` |
| FR-07 | Hotel recommendation | `hotels` |
| FR-08 | Mock ticket booking | `transportoptions`, `bookings`, `flightoptions`, `airports` |
| FR-09 | Budget management | `costbenchmarks`, `expensecategories`, `exchangerates` |
| FR-10 | Expense tracker | `expenses` |
| FR-11 | Weather forecast | `weatherforecasts`, `climatenormals` |
| FR-12 | Tourist attractions | `attractions` |
| FR-13 | Nearby services | `nearbyservices` |
| FR-14 | Document storage | `documents` |
| FR-15 | Smart packing assistant | `packingtemplates`, `packinglists` |
| FR-16 | Carbon footprint | `carbonfactors` (result stored on `trips.carbon`) |
| FR-17 | Multi-language support | `translations` |
| FR-18 | Smart notifications | `notificationtemplates`, `notifications` |
| FR-19 | Reviews & community | `reviews`, `communityposts` |
| FR-20–FR-23 | Admin management & moderation | `users`, `attractions`, `transportoptions`, `auditlogs` |
| FR-24 | Admin analytics | `analyticssnapshots` |
| — | Platform config | `appsettings` |

---

## 3. The 12 proposal collections

Unchanged from §4.1 of the proposal. Additive fields are listed separately
so the submitted ER diagram stays accurate.

### 3.1 `users` — FR-01, FR-02

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `name` | String | Full name |
| `email` | String | Unique, lowercased, used for login |
| `password_hash` | String | bcrypt, `select: false` so it never leaves the DB by accident |
| `role` | String | `traveler` \| `admin` |
| `language` | String | `en`, `bn`, `hi`, `ar`, `zh` |
| `created_at` | Date | Account creation |

*Added:* `is_active`, `phone`, `avatar_url`, `country`, `city`,
`date_of_birth`, `preferences{currency, default_budget_tier, interests,
notify_*, theme}`, `stats{trips_count, bookings_count, reviews_count,
posts_count}`, `last_login_at`, `email_verified`.

**Indexes:** `email` (unique), `{role, is_active}`, `created_at`.

### 3.2 `trips` — FR-03

Proposal fields: `user_id`, `hotel_id`, `origin`, `destination`,
`start_date`, `end_date`, `travelers`, `budget`, `status`.

*Added:* `title`, `origin_destination_id`, `destination_id`, `duration_days`
(derived by a pre-validate hook), `budget_tier`, `currency`,
`budget_breakdown[]` (FR-09 result), `estimated_total`, `route_id`
(FR-06), `transport_option_id`, `carbon{total_kg, per_person_kg, mode,
distance_km, rating}` (FR-16 result), `interests[]`, `*_preference`,
`cover`, `itinerary_generated_at`, `itinerary_source`.

**Indexes:** `{user_id, created_at}`, `{user_id, status}`, `destination`,
`start_date`, `{status, start_date}`.

### 3.3 `itineraryitems` — FR-04

Proposal fields: `trip_id`, `attraction_id`, `day`, `time`, `activity`,
`est_cost`.

*Added:* `location`, `date`, `end_time`, `duration_min`, `category`,
`day_theme`, `lat_lng`, `weather_dependent`, `is_locked`, `is_completed`,
`sort_order`, `source`.

**Indexes:** `{trip_id, day, time}`, `attraction_id`.

### 3.4 `bookings` — FR-08

Proposal fields: `trip_id`, `transport_id`, `passengers[]`, `seats[]`,
`total_fare`, `status`.

*Added:* `user_id`, `reference` (e.g. `TG-8F3K2A`), `passenger_details[]`,
`journey{}` (frozen schedule snapshot, so an admin edit doesn't rewrite an
issued ticket), `travel_date`, `fare_per_passenger`, `is_mock` (always
true), `payment_status`.

### 3.5 `expenses` — FR-10

Proposal fields: `trip_id`, `category`, `description`, `amount`, `date`.

*Added:* `user_id`, `currency`, `amount_bdt`, `payment_method`,
`split_between`, `receipt_url`, `is_estimated`, `itinerary_item_id`.

### 3.6 `attractions` — FR-12

Proposal fields: `name`, `city`, `category`, `entry_fee`, `lat_lng`,
`open_hours`.

*Added:* `slug`, `destination_id`, `location` (GeoJSON),
`avg_visit_duration_min`, `best_time_of_day`, `is_indoor`,
`weather_dependent`, `closed_days[]`, `foreigner_entry_fee`,
`child_entry_fee`, `rating`, `review_count`, `popularity`, `description`,
`tags[]`.

**Indexes:** `location` (2dsphere), `{city, category}`,
`{destination_id, is_active}`, text on `{name, description, tags}`, `rating`.

### 3.7 `hotels` — FR-07

Proposal fields: `name`, `city`, `price_per_night`, `rating`,
`facilities[]`, `lat_lng`.

*Added:* `slug`, `destination_id`, `location` (GeoJSON), `room_types[]`
(so a 4-person trip prices against a real rate card), `price_range`,
`budget_tier`, `distance_to_landmark{landmark, km}`, `star_rating`,
`review_score`, `checkin_time`, `cancellation_policy`, `source`.

**Indexes:** `location` (2dsphere), `{city, price_per_night}`,
`{city, rating}`, `{destination_id, budget_tier}`, text.

### 3.8 `transportoptions` — FR-08, FR-22

Proposal fields: `operator`, `mode`, `from_city`, `to_city`, `depart_time`,
`arrive_time`, `fare`.

*Added:* `code`, `service_class`, `coach_type`, `duration_min`,
`arrives_next_day`, `boarding_point`, `dropping_point`, `via[]`,
`days_of_week[]`, `total_seats`, `seats_available`, `seat_layout`,
`seat_prefix`, `has_ac`, `amenities[]`, `rating`.

### 3.9 `documents` — FR-14

Proposal fields: `user_id`, `type`, `file_url`, `expiry_date`.

*Added:* `trip_id`, `title`, `file_name`, `mime_type`, `size_bytes`,
`thumbnail_url`, `cloudinary_public_id`, `document_number`, `issued_by`,
`issue_date`.

**Indexes:** `{user_id, type}`, `trip_id`, `expiry_date` (drives the
expiry-notification sweep).

### 3.10 `notifications` — FR-18

Proposal fields: `user_id`, `type`, `message`, `is_read`, `created_at`.

*Added:* `template_code`, `trip_id`, `title`, `severity`, `icon`,
`action_url`, `read_at`, `deliver_at`.

**Indexes:** `{user_id, is_read, created_at}`, `trip_id`, and a partial
unique index on `{user_id, trip_id, template_code}` so a scheduler running
twice in one day cannot create duplicates.

### 3.11 `communityposts` — FR-19

Proposal fields: `user_id`, `place`, `content`, `photo_url`, `likes`,
`created_at`.

*Added:* `is_hidden`, `destination_id`, `trip_id`, `rating`, `photo_urls[]`,
`tags[]`, `liked_by[]` (makes the like toggle idempotent),
`replies[]`, `reply_count`, `moderation_status`, `moderated_by`,
`is_pinned`.

### 3.12 `reviews` — FR-19

Proposal fields: `user_id`, `attraction_id`, `rating`, `comment`,
`photo_url`, `created_at`.

*Added:* `is_hidden`, `trip_id`, `title`, `photo_urls[]`, `visited_on`,
`helpful_count`, `helpful_by[]`, `moderation_status`.

**Indexes:** `{user_id, attraction_id}` (unique — one review per user per
attraction), `{attraction_id, is_hidden, created_at}`.

A post-save hook recomputes `attractions.rating` and
`attractions.review_count`, so the attraction list never needs an
aggregation.

---

## 4. New collections

### 4.1 `destinations` — the catalogue everything hangs off

27 rows: 20 Bangladeshi destinations, 7 international.

Key fields: `slug` (stable key used by every seed file), `name`, `aliases[]`,
`country`, `country_code`, `division`, `type` (`city` \| `beach` \| `hill` \|
`forest` \| `island` \| `heritage` \| `nature` \| `metro`),
`is_international`, `summary`, `description`, `highlights[]`, `lat_lng`,
`location` (GeoJSON), `timezone`, `currency`, `tags[]`, `best_months[]`,
`avg_daily_cost`, `recommended_days`, `popularity`, `nearest_airport`.

**Indexes:** `slug` (unique), `location` (2dsphere), text on
`{name, aliases, summary, tags}`, `{country_code, is_active, popularity}`.

### 4.2 `weatherforecasts` + `climatenormals` — FR-11

`climatenormals` holds 12 monthly rows per destination (324 total):
`temp_min_c`, `temp_max_c`, `humidity_pct`, `rain_mm`, `rain_days`,
`dominant_condition`, `season`, `travel_advice`, `is_good_for_travel`.

`weatherforecasts` holds one row per destination per day for a rolling
180-day window (4,860 rows), generated from the normals:
`temp_min_c`/`max`/`avg`, `feels_like_c`, `condition` (10 values),
`humidity_pct`, `cloud_pct`, `wind_kph`, `wind_dir`, `rain_chance_pct`,
`rain_mm`, `uv_index`, `visibility_km`, `sunrise`, `sunset`, `alerts[]`,
`packing_hints[]`.

Two properties worth noting:

- **Deterministic.** The day-to-day variation comes from a PRNG seeded on
  `destination.slug + date`, so the same date always returns the same
  forecast. Reseeding does not churn the data, and a demo gives the same
  answer twice.
- **Sunrise/sunset are computed**, not invented — NOAA's simplified solar
  equations from the destination's latitude and day of year.

Beyond the 180-day window, the API falls back to the monthly normals.

**Indexes:** `{destination_id, date}` (unique), `{city, date}`, `date`.

### 4.3 `routes` — FR-06

25 precomputed routes. Each row is one origin→destination pair for one
travel mode and one variant (`fastest` \| `shortest` \| `scenic` \|
`cheapest`), so "fastest route selected" in wireframe §3.7 is a real choice
between real rows.

Fields: `from{name, kind, ref_id, lat_lng, location}`, `to{...}`, `mode`,
`variant`, `is_default`, `distance_km`, `duration_min`,
`geometry` (GeoJSON LineString — the polyline the map draws),
`legs[{sequence, instruction, road, distance_km, duration_min, via}]`,
`est_fare_bdt`, `toll_bdt`, `fuel_cost_bdt`, `carbon_kg`.

Because the route carries distance and fare, FR-09 (budget) and FR-16
(carbon) read from the same row the map was drawn from.

### 4.4 `nearbyservices` — FR-13

272 rows across 13 categories. The `2dsphere` index on `location` is what
replaces Overpass: a `$geoNear` aggregation returns the same "restaurants
within 2 km, sorted by distance" answer, with the distance already computed.

56 rows are real, named places (hospitals, restaurants, ATMs, tourist police).
216 are descriptive coverage rows — `"Sajek Valley Pharmacy"`,
`"Kuakata ATM Booth"` — generated at fixed offsets around each destination
centre so every category returns something everywhere. They carry
`source: "generated"` so they are distinguishable from the named data.

### 4.5 `costbenchmarks` — FR-09

81 rows: 3 tiers (`budget`, `mid`, `luxury`) × 27 destinations.

`per_person_per_day{accommodation, food, local_transport, attractions,
shopping, misc}`, plus `meal_costs{}`, `local_transport_rates{cng_per_km,
rickshaw_short_trip, local_bus, ride_share_per_km, reserved_car_per_day}`
and `hotel_price_range{}`.

Derived from each destination's `avg_daily_cost` split by category shares
that vary with destination type — a hill trip spends proportionally more on
local transport, an island trip more on accommodation and food.

### 4.6 `itinerarytemplates` — FR-04

17 curated plans covering 52 planned days. Structure:

```
{
  code, destination_id, city, title, summary,
  duration_days, pace, budget_tier, interests[], suitable_for[],
  days: [{ day, theme, items: [{
    time, activity, location, attraction_slug,
    est_cost, duration_min, category,
    is_optional, weather_dependent
  }]}],
  est_total_cost_per_person, popularity
}
```

Generation scores every template for the destination against the trip's
duration, budget tier and interests, picks the highest, then stretches or
trims it to the actual day count. Trimming keeps the first and last day —
they carry the travel legs — and drops from the middle.

`attraction_slug` (not an ObjectId) keeps templates portable across
reseeds; the seeder resolves it and warns on any slug that doesn't exist.

### 4.7 `packingtemplates` + `packinglists` — FR-15

23 templates, 106 items. Five are `always_include` baselines (documents,
toiletries, electronics, medical kit, everyday clothing); the other 18 match
on `conditions{min_temp_c, max_temp_c, weather_conditions[],
packing_hints[], destination_types[], interests[], min_days, max_days,
international_only}`.

The generator loads the trip's `weatherforecasts` rows, collects their
`packing_hints`, matches templates against them, and merges the results into
a `packinglists` document. `qty_rule` (`fixed` / `per_day` / `per_2_days` /
`per_traveler`) resolves to real quantities from the trip's duration and
traveller count.

`packinglists.based_on` records what the list was generated from, so the UI
can explain *why* rain gear appeared.

### 4.8 `chatintents` + `chatsessions` — FR-05

17 intents, of which 4 are the quick-action chips from wireframe §3.11.
Each intent carries `patterns[]` (regex sources), `keywords[]`,
`response_template` (with `{{destination}}`, `{{days}}`, `{{budget}}`,
`{{saved}}`, `{{total_cost}}` placeholders), `followup_suggestions[]` and an
`action{type, params}` describing the itinerary operation to run.

This is what lets the chat assistant work with no AI provider configured.
When a key *is* present, the LLM path becomes an upgrade rather than a
requirement — `chatsessions.messages[].source` records which answered.

### 4.9 `carbonfactors` — FR-16

14 modes with grams CO₂e per passenger-kilometre. The spread is the point:
train at 35 g/pkm against a domestic flight at 255 g/pkm — a short flight
burns most of its fuel on takeoff and landing, so per-km emissions are the
worst of any mode. Each row lists `greener_alternatives[]`, which is what
the "greener options" suggestion reads.

Calculation: `distance_km × grams_per_passenger_km ÷ 1000`, doubled for the
return leg, result stored on `trips.carbon`.

### 4.10 `notificationtemplates` — FR-18

17 rules across 8 trigger events (`trip_start_approaching`,
`daily_weather_check`, `budget_threshold`, `document_expiring`,
`booking_confirmed`, `itinerary_generated`, `trip_end_approaching`,
`trip_completed`). Non-real-time by design, matching the SRS.

### 4.11 `translations` — FR-17

5 documents, one per language, each holding 202 keys across 19 namespaces.
English is the source of truth; the other four carry the identical key set,
so a missing key falls back to English rather than rendering blank.

Arabic carries `direction: "rtl"`, which the layout should read.

### 4.12 `analyticssnapshots` — FR-24

181 daily + 7 monthly rows. Every figure is a genuine aggregation over the
platform's own records grouped by `created_at` — if three trips were created
in a month, the chart shows three. Rolling them up once a day means the
admin charts read a few dozen small documents instead of running count
aggregations across every collection on each page load (NFR-01).

`trips_by_status` and `top_destinations` are point-in-time rather than
reconstructed per day, because trip status history isn't recorded.

### 4.13 Reference tables

| Collection | Rows | Purpose |
|---|---|---|
| `expensecategories` | 6 | Budget/expense categories, chart colours, default budget shares (sum to 1.00) |
| `interesttags` | 16 | The interest chips on the Plan Trip form; the same codes match itinerary and packing templates |
| `airports` | 20 | IATA reference — replaces a hardcoded city→code map |
| `flightoptions` | 26 | Recurring flight schedules (`days_of_week`), expanded onto real dates at search time |
| `exchangerates` | 14 | Indicative FX against BDT, for international trips |
| `appsettings` | 18 | Feature flags, limits, AI provider order. `is_public: false` keeps some server-side |
| `auditlogs` | 0 | Admin action trail — populated at runtime by FR-20–FR-23 routes |

---

## 5. Indexing

139 indexes across 34 collections.

**Geospatial (2dsphere)** — `destinations`, `attractions`, `hotels`,
`nearbyservices`, `airports`, `routes.from.location`. Every place-like
document carries both `lat_lng {lat, lng}` (the shape the proposal
documents) and `location` (GeoJSON `[lng, lat]`). A pre-validate hook keeps
the second in step with the first, so application code only ever sets
`lat_lng`.

**Text search** — `destinations`, `attractions`, `hotels`, `nearbyservices`,
`airports`. Powers the guest-facing destination search without a search
service.

**Compound** — the hot query paths: `{trip_id, day, time}` for itinerary
reads, `{user_id, is_read, created_at}` for the notification bell,
`{destination_id, date}` for a forecast range, `{city, price_per_night}` for
hotel sorting.

**Unique** — `users.email`, `destinations.slug`,
`{reviews.user_id, attraction_id}`, `{weatherforecasts.destination_id, date}`,
`{costbenchmarks.destination_id, tier}`, and a partial unique index on
notifications for scheduler idempotency.

---

## 6. Running the scripts

```bash
npm run seed              # refresh reference data, keep real user accounts
npm run seed:fresh        # drop all 34 collections, then reseed
npm run seed:reference    # reference data only, no demo users or trips
npm run seed:weather      # regenerate a 365-day forecast window
npm run db:verify         # one query per FR, prints pass/fail + collection census
```

`seed` is idempotent — reference collections are replaced wholesale, user
content is left alone unless `--fresh` is passed. Unknown slugs are reported
as warnings rather than failing the run, so a typo in a template surfaces
immediately.

**Seeded accounts**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@tourgenie.ai` | `Admin123!` |
| Traveller | `moontashir@tourgenie.ai` | `Traveler123!` |
| Traveller | `sadman@tourgenie.ai` | `Traveler123!` |

These are demonstration credentials in a coursework database. Change them
before the project is exposed anywhere public.

---

## 7. Current state

| | |
|---|---|
| Collections | 34 |
| Documents | 6,605 |
| Indexes | 139 |
| Storage + indexes | 11.1 MB of the 512 MB free tier (2.2%) |
| Verification | 32 / 32 checks passing |

Free-tier headroom is comfortable. The largest collection is
`weatherforecasts` at 4,860 rows; extending the window to a full year takes
it to roughly 9,800 — still well inside the limit.

---

## 8. Scope note

The database layer is complete and loaded. The API layer is not yet fully
rewired: several controllers still call external services
(`stayApiHotels.js`, `ignavFlights.js`, `aiPlanner.js`), and weather,
routing, nearby services, packing and carbon have no controller yet even
though their data now exists. Wiring those routes to these collections is
the next step.
