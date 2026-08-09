import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Clock, MessageCircleMore, CloudSun, Wallet, ChevronDown } from "lucide-react";
import AppShell from "../components/AppShell";
import RouteLine from "../components/RouteLine";
import { itinerary } from "../data/mockData";

export default function Itinerary() {
  const [openDay, setOpenDay] = useState(1);
  const totalCost = itinerary.flatMap((d) => d.items).reduce((s, i) => s + i.cost, 0);

  return (
    <AppShell title="Cox's Bazar Itinerary" subtitle="Aug 15 – Aug 18 · 2 travelers · AI-generated plan">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {itinerary.map((day) => {
            const open = openDay === day.day;
            return (
              <div key={day.day} className="bg-white border border-sand rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenDay(open ? null : day.day)}
                  className="w-full flex items-center justify-between px-6 py-4"
                >
                  <div className="text-left">
                    <p className="font-display text-lg text-ink-900">Day {day.day}</p>
                    <p className="text-xs text-ink-900/50">{day.date}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-ink-900/40 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="px-6 pb-6">
                    <RouteLine className="w-full h-3 mb-4" color="#DCEFEC" />
                    <ul className="space-y-4">
                      {day.items.map((item, idx) => (
                        <li key={idx} className="flex gap-4">
                          <div className="w-16 shrink-0 text-xs font-mono text-teal-dark pt-0.5">{item.time}</div>
                          <div className="flex-1 border-l-2 border-teal-light pl-4 pb-1">
                            <p className="text-sm font-semibold text-ink-900">{item.activity}</p>
                            <p className="text-xs text-ink-900/50 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" /> {item.location}
                            </p>
                          </div>
                          <div className="text-xs font-mono text-ink-900/60 pt-0.5 shrink-0">
                            {item.cost > 0 ? `৳${item.cost.toLocaleString()}` : "Free"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <aside className="space-y-5">
          <div className="bg-ink-900 rounded-2xl p-6">
            <p className="text-xs font-semibold tracking-wide uppercase text-sunset mb-4">Trip snapshot</p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-paper/50">Route</dt><dd className="text-paper">Dhaka → Cox's Bazar</dd></div>
              <div className="flex justify-between"><dt className="text-paper/50">Duration</dt><dd className="text-paper">3 days, 2 nights</dd></div>
              <div className="flex justify-between"><dt className="text-paper/50">Travelers</dt><dd className="text-paper">2</dd></div>
              <div className="flex justify-between border-t border-ink-700 pt-3">
                <dt className="text-paper/50">Estimated cost</dt>
                <dd className="text-sunset font-mono font-semibold">৳{totalCost.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-sand rounded-2xl p-6">
            <p className="text-xs font-semibold tracking-wide uppercase text-teal mb-3 flex items-center gap-1.5">
              <CloudSun className="w-3.5 h-3.5" /> Weather forecast
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {["Sat 33°", "Sun 31°", "Mon 30°"].map((d) => (
                <div key={d} className="bg-paper rounded-lg py-2 text-ink-900/70">{d}</div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-sand rounded-2xl p-6">
            <p className="text-xs font-semibold tracking-wide uppercase text-teal mb-3 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Budget snapshot
            </p>
            <p className="text-2xl font-display text-ink-900 mb-1">৳{totalCost.toLocaleString()}</p>
            <p className="text-xs text-ink-900/50">of ৳20,000 planned budget</p>
            <div className="w-full h-2 bg-paper rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-teal" style={{ width: `${Math.min((totalCost / 20000) * 100, 100)}%` }} />
            </div>
          </div>

          <Link
            to="/chat"
            className="w-full inline-flex items-center justify-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm px-5 py-3 rounded-full transition-colors"
          >
            <MessageCircleMore className="w-4 h-4" /> Ask AI to Adjust
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
