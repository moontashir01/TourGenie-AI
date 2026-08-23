import { useEffect, useState } from "react";
import { Check, Loader2, MapPinned, Landmark, CalendarRange, Bus, UtensilsCrossed, Sparkles } from "lucide-react";
import { DayCardSkeleton } from "./Skeleton";

// The app's slowest moment (15s for a weekend, a couple of minutes for a
// month-long multi-city trip) narrated as stages instead of one spinner.
// Timings are paced against typical generations; the last stage holds until
// the request actually resolves and the parent unmounts this component.
export default function GenerationProgress({ trip }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const days = trip?.duration_days || 1;
  const mustVisit = trip?.must_visit_attraction_ids?.length || 0;
  const longTrip = days >= 8;

  const stages = [
    {
      icon: MapPinned,
      label: `Reading your trip brief — ${days} day${days > 1 ? "s" : ""} in ${trip?.destination || "your destination"}`,
      at: 0,
    },
    {
      icon: Landmark,
      label: mustVisit
        ? `Locking in your ${mustVisit} must-see pick${mustVisit > 1 ? "s" : ""}`
        : "Matching attractions from the catalogue",
      at: 2,
    },
    { icon: CalendarRange, label: "Drafting the day-by-day plan", at: 6 },
    { icon: Bus, label: "Attaching real flights & transport options", at: longTrip ? 35 : 14 },
    { icon: UtensilsCrossed, label: "Pricing meals at local rates", at: longTrip ? 55 : 22 },
  ];
  // Which stage is "current": the last one whose start time has passed. It
  // never advances past the final stage — that one spins until we unmount.
  const currentIndex = stages.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);

  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="card shadow-lift p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg text-ink-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-sunset to-sunset-dark flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            Planning your {trip?.destination || ""} trip
          </h3>
          <span className="font-mono text-xs text-ink-900/40">{mm}:{ss}</span>
        </div>

        <ol className="space-y-3">
          {stages.map((stage, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <li
                key={stage.label}
                className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
                  done ? "text-ink-900/50" : current ? "text-ink-900 font-medium" : "text-ink-900/25"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    done ? "bg-teal text-white" : current ? "bg-sunset/15 text-sunset-dark" : "bg-paper text-ink-900/30"
                  }`}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : current ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <stage.icon className="w-3.5 h-3.5" />
                  )}
                </span>
                {stage.label}
              </li>
            );
          })}
        </ol>

        {longTrip && (
          <p className="text-xs text-ink-900/40 mt-5 pt-4 border-t border-sand">
            Long trips are planned in chunks so every one of your {days} days gets real detail — this can take a
            couple of minutes. Worth the wait.
          </p>
        )}
      </div>

      <DayCardSkeleton />
      <DayCardSkeleton />
      <DayCardSkeleton />
    </div>
  );
}
