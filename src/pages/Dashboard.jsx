import { Link } from "react-router-dom";
import { Plus, Waves, Mountain, Trees, Clock, Users2 } from "lucide-react";
import AppShell from "../components/AppShell";
import { trips } from "../data/mockData";

const coverIcon = { beach: Waves, hills: Mountain, forest: Trees };
const statusStyle = {
  draft: "bg-sand text-ink-900/60",
  planned: "bg-teal-light text-teal-dark",
  active: "bg-sunset-light text-sunset-dark",
  completed: "bg-ink-900/10 text-ink-900/50",
};

export default function Dashboard() {
  const next = trips.find((t) => t.status === "planned") || trips[0];

  return (
    <AppShell title="Dashboard" subtitle="Everything about your trips, in one place.">
      <div className="bg-ink-900 rounded-2xl p-8 mb-10 relative overflow-hidden">
        <svg className="absolute right-0 top-0 h-full w-1/2 opacity-20" viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 120 Q 100 40, 200 90 T 300 60" fill="none" stroke="#EF8354" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" />
        </svg>
        <p className="text-xs font-semibold tracking-wide uppercase text-sunset mb-2 relative z-10">Next departure</p>
        <h2 className="font-display text-2xl text-paper relative z-10 mb-1">{next.origin} → {next.destination}</h2>
        <p className="text-paper/60 text-sm relative z-10 mb-6">
          {next.startDate} – {next.endDate} · {next.travelers} travelers
        </p>
        <Link
          to="/itinerary"
          className="relative z-10 inline-flex items-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
        >
          View itinerary
        </Link>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-xl text-ink-900">My Trips</h3>
        <Link
          to="/plan"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal"
        >
          <Plus className="w-4 h-4" /> New trip
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {trips.map((t) => {
          const Icon = coverIcon[t.cover];
          return (
            <div key={t.id} className="bg-white border border-sand rounded-2xl overflow-hidden hover:border-teal/40 transition-colors">
              <div className="h-28 bg-teal-light flex items-center justify-center">
                <Icon className="w-10 h-10 text-teal-dark" strokeWidth={1.5} />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-display text-lg text-ink-900">{t.destination}</h4>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${statusStyle[t.status]}`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-xs text-ink-900/50 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5" /> {t.startDate} – {t.endDate}
                </p>
                <p className="text-xs text-ink-900/50 flex items-center gap-1.5 mb-4">
                  <Users2 className="w-3.5 h-3.5" /> {t.travelers} travelers · ৳{t.budget.toLocaleString()} budget
                </p>
                <Link
                  to="/itinerary"
                  className="text-sm font-semibold text-teal-dark hover:text-teal"
                >
                  Open trip →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
