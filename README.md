# TourGenie AI

An AI-assisted travel planner for Bangladesh and nearby destinations. Describe
where you want to go, how long for and what you want to spend, and TourGenie
builds a day-by-day itinerary with real attractions, transport between them,
hotel options, a weather outlook and a running budget — then keeps the whole
trip in one place while you take it.

Built as a MERN-stack project for CSE482L.

| | |
|---|---|
| **Frontend** | React 19 (Vite), Tailwind CSS, React Router, Leaflet |
| **Backend** | Node.js, Express 5, MongoDB (Mongoose) |
| **Auth** | JWT + bcrypt, with emailed one-time codes for password reset |
| **AI** | Groq / Claude / OpenAI, tried in order — all optional |

---

## What it does

| Feature | Where |
|---|---|
| Register, log in, reset a forgotten password by emailed code | `/login`, `/register`, `/forgot-password` |
| Plan a trip — destination, dates, party size, budget, interests | `/plan` |
| Live cost estimate while you fill the form, before the trip exists | `/plan` |
| AI itinerary, day by day, with an editable schedule | `/itinerary` |
| Pick your own attractions and have the plan route around them | `/attractions` |
| Browse and compare destinations, with best-time-to-visit climate data | `/destinations` |
| Journey planning — buses, trains, launches and flights between cities | `/booking` |
| Map view with route polylines and per-day pins | `/map` |
| Hotels with real rates for the trip's own stay, and booking | `/hotels` |
| Budget tracker — planned vs. actual, per category | `/budget` |
| Weather outlook per day, with rainy-day swaps for outdoor plans | `/itinerary` |
| Packing list generated from the destination, season and trip length | `/documents` |
| Travel documents, chat assistant, community posts and reviews | `/documents`, `/chat`, `/community` |
| Printable trip sheet | `/itinerary/print` |
| Admin dashboard — users, content, moderation, analytics | `/admin` |
| Multi-currency display and five UI languages | everywhere |

### Everything is database-backed

The proposal names six external integrations (OpenWeather, OpenRouteService,
Overpass, Travelpayouts, Cloudinary, an LLM). Depending on them at request
time means free-tier quotas, a network dependency during a demo, and answers
that change between runs.

So all of that data lives in MongoDB instead — **34 collections, ~6,600
documents**: weather forecasts, climate normals, routes, nearby places,
hotels and rate cards, flight schedules, cost benchmarks, packing rules,
chat intents and UI translations. External providers stay available as an
*enrichment* path — an LLM refining a plan the template engine already
produced, or a live fare API improving on a seeded schedule — never as a
hard dependency. **The app runs with no third-party API keys at all.**

---

## Repository layout

```
TourGenie-AI/
├── tourgenie-ai/       React frontend (Vite)
└── tourgenie-server/   Express API + MongoDB models, seeds and services
```

Each has its own README with more detail:
[frontend](tourgenie-ai/README.md) · [backend](tourgenie-server/README.md) ·
[database schema](tourgenie-server/docs/DATABASE.md)

---

## Quick start

You need Node.js 20+ and a MongoDB connection string (a free Atlas M0 cluster
is plenty — the backend README walks through creating one).

### 1. Backend

```bash
cd tourgenie-server
cp .env.example .env      # then set MONGODB_URI and JWT_SECRET
npm install
npm run seed:fresh        # loads all 34 collections
npm run dev               # http://localhost:5000
```

Check it came up: <http://localhost:5000/api/health>

### 2. Frontend

```bash
cd tourgenie-ai
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev               # http://localhost:5173
```

### 3. Log in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@tourgenie.ai` | `Admin123!` |
| Traveller | `moontashir@tourgenie.ai` | `Traveler123!` |
| Traveller | `sadman@tourgenie.ai` | `Traveler123!` |

Seed credentials for a coursework database — change them before this is
exposed anywhere public.

---

## Configuration

Everything below is optional. Without a key, the matching feature falls back
to seeded data and the UI labels it as such.

| Variable | What it unlocks |
|---|---|
| `MONGODB_URI`, `JWT_SECRET` | **Required.** Database and token signing |
| `GROQ_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | AI itinerary generation and the chat assistant; tried in that order |
| `TRAVELPAYOUTS_API_KEY` / `IGNAV_API_KEY` | Real flight fares instead of seeded schedules |
| `OPENWEATHER_API_KEY` | Live forecasts instead of the seeded 180-day window |
| `OPENROUTESERVICE_API_KEY` | Live route geometry |
| `MAIL_USER`, `MAIL_PASS` | Sends password-reset codes by email (see below) |

### Password reset email

Reset codes go out over Gmail SMTP. `MAIL_PASS` must be a Google
[App Password](https://myaccount.google.com/apppasswords), not the account
password — Gmail's SMTP rejects the latter. Two-Step Verification has to be on
for the account before App Passwords can be created.

Leave `MAIL_USER` and `MAIL_PASS` blank and nothing is sent: the server logs
the email and the API returns the code in its response, so the flow stays
testable offline in development. That fallback is disabled when
`NODE_ENV=production`.

The code is six digits, valid for **two minutes**, and only its bcrypt hash is
stored. A new one can be requested every 30 seconds, five times per 15 minutes
per address, and each code survives five wrong guesses. Whether an account
exists for a given email is never revealed.

---

## API surface

| Area | Routes |
|---|---|
| Auth | `/api/auth/register`, `/login`, `/me`, `/forgot-password`, `/verify-otp`, `/reset-password` |
| Trips | `/api/trips` (CRUD), `/api/trips/estimate` |
| Itinerary | `/api/trips/:tripId/itinerary`, `.../generate`, `.../:itemId/transport` |
| Destinations | `/api/destinations`, `/:idOrSlug`, `/:idOrSlug/climate`, `/compare` |
| Journey & routes | `/api/trips/:tripId/route`, `/api/routes`, `/api/routes/options` |
| Transport & flights | `/api/transport`, `/api/flights` |
| Hotels | `/api/hotels`, `/:id/availability`, `/:id/select`, `/api/hotel-bookings` |
| Bookings | `/api/bookings` |
| Budget & expenses | `/api/trips/:tripId/budget`, `/expenses` |
| Weather | `/api/trips/:tripId/weather`, `/weather-swap` |
| Packing | `/api/trips/:tripId/packing-list` |
| Attractions & nearby | `/api/attractions`, `/api/nearby` |
| Chat | `/api/chat/session`, `/messages`, `/quick-actions` |
| Community & reviews | `/api/community-posts`, `/api/reviews` |
| Notifications | `/api/notifications` |
| Reference | `/api/reference/currencies`, `/expense-categories`, `/languages`, `/translations/:lang` |
| Admin | `/api/admin/*` |

Protected routes expect `Authorization: Bearer <token>` from the login
response. Admin routes additionally require `role: "admin"`.

---

## Scripts

**Backend** (`tourgenie-server`)

| Command | What it does |
|---|---|
| `npm run dev` | API with file watching |
| `npm run seed` | Refresh reference data, keep real user accounts |
| `npm run seed:fresh` | Drop all 34 collections, then reseed |
| `npm run seed:reference` | Reference data only — no demo users or trips |
| `npm run db:verify` | One query per feature; prints pass/fail and a collection census |

**Frontend** (`tourgenie-ai`)

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | oxlint |

---

## Design system

Colours, type (Fraunces / Inter / IBM Plex Mono) and the dotted "route-line"
motif live in `tourgenie-ai/tailwind.config.js` and
`src/components/RouteLine.jsx`. Reuse them for new pages so the app stays
visually consistent.

---

## Course project

CSE482L, North South University. Not a production service — the seeded
accounts, demo content and the personal mailbox used for reset codes are all
placeholders for a real deployment.
