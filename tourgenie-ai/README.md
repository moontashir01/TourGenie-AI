# TourGenie AI — Frontend Prototype

Basic pages for the TourGenie AI travel-planning platform (CSE482L project),
built with React (Vite) + Tailwind CSS + React Router, matching the
MERN-stack proposal.

## Pages included
- Landing (/) — hero, features, how-it-works, community teaser
- Login (/login) & Register (/register)
- Dashboard / My Trips (/dashboard)
- Plan New Trip (/plan)
- AI Itinerary View (/itinerary)
- Budget & Expense Tracker (/budget)
- AI Chat Assistant (/chat)
- Reviews & Community (/community)
- Travel Documents & Packing (/documents)
- Admin Dashboard (/admin)

All data is mocked in src/data/mockData.js — there is no backend yet.
Wire these pages up to your Express/MongoDB API and the Claude API as you
build out the rest of the MERN stack described in the proposal.

## Run it

    npm install
    npm run dev

Then open the printed local URL (usually http://localhost:5173).

## Build for production

    npm run build

## Design system
Colors, type (Fraunces / Inter / IBM Plex Mono), and the dotted
"route-line" motif are defined in tailwind.config.js and
src/components/RouteLine.jsx — reuse these for any new pages so the
whole app stays visually consistent.
