# TourGenie AI — Backend (Express + MongoDB)

REST API for the TourGenie AI platform, matching the SRS and database schema
from the proposal (FR-01 through FR-24). Pairs with the `tourgenie-ai` React
frontend.

## Stack
Node.js, Express, MongoDB (Mongoose), JWT + bcrypt for auth.

## Architecture: every feature is database-backed

The proposal describes six external integrations (OpenWeather,
OpenRouteService, Overpass, Travelpayouts, Cloudinary, an LLM). Depending on
them at request time means free-tier quotas, a network dependency at demo
time, and answers that change between runs.

All of that data now lives in MongoDB — **34 collections, 6,605 documents**.
Weather, routes, nearby places, hotels, flights, cost estimates, packing
rules, chat responses and UI translations are all served from the database.
External providers remain available as an *enrichment* path (an LLM refining
a plan the template engine already produced), never as a dependency.

See [`docs/DATABASE.md`](docs/DATABASE.md) for the full schema reference —
all 34 collections, their fields, indexes, and which FR each one serves.

## 1. Get a free MongoDB Atlas database
1. Go to mongodb.com/cloud/atlas/register and create a free account.
2. Create a free "M0" cluster (any region close to you).
3. Under Database Access, add a database user with a username/password.
4. Under Network Access, add your current IP (or 0.0.0.0/0 for easy local dev).
5. Click "Connect" on your cluster → "Drivers" → copy the connection string.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Paste your connection string into `MONGODB_URI` (add `/tourgenie` before the
`?` so it uses a database named `tourgenie`). Set `JWT_SECRET` to any long
random string. Everything else is optional — the app runs with no third-party
keys configured at all.

## 3. Install, seed and run

```bash
npm install
npm run seed:fresh   # loads all 34 collections
npm run db:verify    # confirms every FR can be answered from the database
npm run dev          # starts the API on http://localhost:5000
```

Health check: http://localhost:5000/api/health

## Seed scripts

| Command | What it does |
|---|---|
| `npm run seed` | Refresh reference data, keep real user accounts |
| `npm run seed:fresh` | Drop all 34 collections, then reseed |
| `npm run seed:reference` | Reference data only — no demo users or trips |
| `npm run seed:weather` | Regenerate a 365-day forecast window |
| `npm run db:verify` | One query per FR; prints pass/fail and a collection census |

`seed` is idempotent. Reference collections are replaced wholesale; user
content is left alone unless `--fresh` is passed. Unknown slugs are reported
as warnings rather than failing the run.

Seed data lives in `src/seed/data/` (one file per domain) and
`src/seed/generators/` (weather, analytics, itinerary expansion).

## Seeded accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@tourgenie.ai` | `Admin123!` |
| Traveller | `moontashir@tourgenie.ai` | `Traveler123!` |
| Traveller | `sadman@tourgenie.ai` | `Traveler123!` |

Demonstration credentials for a coursework database — change them before
this is exposed anywhere public.

## What's in the database

| | |
|---|---|
| Destinations | 27 (20 Bangladeshi, 7 international) |
| Attractions | 87, with GeoJSON points and entry fees |
| Hotels | 36, with per-room rate cards |
| Transport options | 39 bus / train / launch services |
| Flight schedules | 26 across 20 airports |
| Routes | 25 with polylines and turn-by-turn legs |
| Nearby services | 272 across 13 categories, 2dsphere indexed |
| Weather forecasts | 4,860 — 180 days ahead per destination |
| Climate normals | 324 — 12 months per destination |
| Cost benchmarks | 81 — 3 tiers per destination |
| Itinerary templates | 17 covering 52 planned days |
| Packing rules | 23 templates, 106 items |
| Chat intents | 17, including the 4 quick-action chips |
| Translations | 5 languages × 202 keys |

## API overview

| Area | Routes | Covers |
|---|---|---|
| Auth | `POST /api/auth/register`, `/login`, `GET /api/auth/me` | FR-01, FR-02 |
| Trips | `/api/trips` (CRUD) | FR-03 |
| Itinerary | `/api/trips/:tripId/itinerary` | FR-04 |
| Bookings | `/api/bookings` | FR-08 |
| Budget & Expenses | `/api/trips/:tripId/budget`, `/expenses` | FR-09, FR-10 |
| Attractions | `/api/attractions` | FR-12 |
| Hotels | `/api/hotels` | FR-07 |
| Transport | `/api/transport` | FR-08 |
| Flights | `/api/flights` | FR-08 |
| Documents | `/api/documents` | FR-14 |
| Notifications | `/api/notifications` | FR-18 |
| Community posts | `/api/community-posts` | FR-19 |
| Reviews | `/api/reviews` | FR-19 |
| Admin | `/api/admin/*` | FR-20–FR-24 |

Protected routes expect `Authorization: Bearer <token>` from the login
response. Admin routes additionally require `role: "admin"`.

## Status: data layer vs. API layer

The **data layer is complete**. Every FR can be answered by a MongoDB query —
`npm run db:verify` proves this with 32 checks, one per feature.

The **API layer is partially rewired**. Still outstanding:

- `hotelController` calls StayAPI before falling back to the database; it
  should read `hotels` directly (the collection now has richer data than the
  API returned).
- `flightController` calls a live fare API; `flightoptions` + `airports`
  replace it.
- `itineraryController` requires an LLM key; it should select an
  `itinerarytemplate` first and treat the LLM as optional refinement.
- FR-05 (chat), FR-06 (routes), FR-11 (weather), FR-13 (nearby services),
  FR-15 (packing) and FR-16 (carbon) have data and no controller yet.

## Connecting the frontend

In `tourgenie-ai`, set `VITE_API_URL=http://localhost:5000/api` and replace
the imports from `src/data/mockData.js` with calls to `src/lib/api.js`. The
mock data's shapes match what these endpoints return, so the swap is mostly
mechanical.
