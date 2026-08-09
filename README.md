# TourGenie AI — Frontend

React (Vite) + Tailwind CSS + React Router frontend for TourGenie AI,
now wired to the tourgenie-server backend for real auth, trips,
itineraries, budgets, and community posts.

## Run it

    npm install
    cp .env.example .env
    npm run dev

By default it expects the backend running at http://localhost:5000/api
(edit VITE_API_URL in .env if yours differs). Start tourgenie-server
first, or pages that need data will show a connection error.

## What's real vs. still mocked
- Auth (login/register/logout), Trips, Itinerary items, Budget &
  Expenses, and Community posts all call the real API in src/lib/api.js.
- The AI Chat Assistant page and the Documents/packing list are still
  static demo content — wire those up next if you want them live.
- Itinerary items are added manually for now (one at a time via the
  "Add activity" form) since the Claude-powered auto-generation isn't
  connected yet — see tourgenie-server's README for where that plugs in.

## Design system
Colors, type (Fraunces / Inter / IBM Plex Mono), and the dotted
"route-line" motif are defined in tailwind.config.js and
src/components/RouteLine.jsx — reuse these for any new pages so the
whole app stays visually consistent.
