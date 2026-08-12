import { Compass } from "lucide-react";

export default function Footer() {
  return (
    <footer id="about" className="bg-ink-900 text-paper/70 border-t border-ink-700">
      <div className="max-w-6xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-paper mb-3">
            <Compass className="w-5 h-5 text-sunset" strokeWidth={1.75} />
            <span className="font-display text-base">TourGenie AI</span>
          </div>
          <p className="text-sm leading-relaxed max-w-xs">
            One AI-powered workspace to plan, budget, and manage a trip from
            leaving home to coming back.
          </p>
        </div>
        <div>
          <h4 className="text-paper text-sm font-semibold mb-3">Plan</h4>
          <ul className="space-y-2 text-sm">
            <li>Itinerary generation</li>
            <li>Route optimization</li>
            <li>Hotel recommendations</li>
            <li>Budget tracking</li>
          </ul>
        </div>
        <div>
          <h4 className="text-paper text-sm font-semibold mb-3">Platform</h4>
          <ul className="space-y-2 text-sm">
            <li>Community & reviews</li>
            <li>Travel documents</li>
            <li>Smart packing lists</li>
            <li>Multi-language support</li>
          </ul>
        </div>
        <div>
          <h4 className="text-paper text-sm font-semibold mb-3">Team Hydrogen</h4>
          <p className="text-sm">North South University<br />CSE482L — Summer 2026</p>
        </div>
      </div>
      <div className="border-t border-ink-700 py-5 text-center text-xs text-paper/50">
        A university capstone project. Bookings shown are demo-only — no real payments are processed.
      </div>
    </footer>
  );
}
