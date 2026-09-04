import { useEffect, useState } from "react";
import { Loader2, MapPinned, Landmark, CalendarRange, Bus, UtensilsCrossed, Sparkles } from "lucide-react";
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

  // The bar is paced off the clock rather than off the stage index, so it
  // keeps creeping while a long stage runs instead of sitting still for
  // twenty seconds and then jumping. It is capped short of full: the request
  // is what finishes this, and a bar sitting at 100% while nothing happens is
  // worse than one sitting at 96%.
  const nominalTotal = longTrip ? 110 : 34;
  const percent = Math.min(96, (elapsed / nominalTotal) * 100);

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
          <span className="font-mono text-xs text-ink-900/40 tabular-nums">{mm}:{ss}</span>
        </div>

        {/* Slower than the motion scale's `slow` step on purpose — this bar
            is measuring minutes, and a 400ms jump between readings would
            read as a glitch rather than progress. */}
        <div className="h-1 rounded-full bg-sand/60 overflow-hidden mb-5" role="presentation">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sunset to-gold transition-[width] ease-tg-out"
            style={{ width: `${percent}%`, transitionDuration: "900ms" }}
          />
        </div>

        <ol className="space-y-3 stagger">
          {stages.map((stage, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <li
                key={stage.label}
                className={`flex items-center gap-3 text-sm transition-opacity duration-base ${
                  done ? "text-ink-900/50" : current ? "text-ink-900 font-medium" : "text-ink-900/25"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-base ${
                    done
                      ? "bg-teal text-white"
                      : current
                        ? "bg-sunset/15 text-sunset-dark animate-pulse-ring"
                        : "bg-paper text-ink-900/30"
                  }`}
                >
                  {done ? (
                    // Hand-rolled rather than lucide's <Check>, because the
                    // stroke has to be reachable to draw it on.
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" className="check-path animate-check-draw" />
                    </svg>
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
