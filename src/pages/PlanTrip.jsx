import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import AppShell from "../components/AppShell";

const interests = ["Beaches", "Hills & nature", "History", "Food", "Nightlife", "Shopping", "Adventure", "Family-friendly"];

export default function PlanTrip() {
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    navigate("/itinerary");
  }

  return (
    <AppShell title="Plan a new trip" subtitle="Fill in the basics — the AI does the rest.">
      <div className="grid lg:grid-cols-3 gap-8">
        <form className="lg:col-span-2 bg-white border border-sand rounded-2xl p-6 md:p-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Origin">
              <input type="text" defaultValue="Dhaka" className="input" />
            </Field>
            <Field label="Destination">
              <input type="text" placeholder="e.g. Cox's Bazar" className="input" />
            </Field>
            <Field label="Start date">
              <input type="date" className="input" />
            </Field>
            <Field label="End date">
              <input type="date" className="input" />
            </Field>
            <Field label="Number of travelers">
              <input type="number" min="1" defaultValue="2" className="input" />
            </Field>
            <Field label="Budget (BDT)">
              <input type="number" min="0" step="500" placeholder="e.g. 20000" className="input" />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            <Field label="Transport preference">
              <select className="input">
                <option>No preference</option>
                <option>Bus</option>
                <option>Train</option>
                <option>Launch</option>
              </select>
            </Field>
            <Field label="Hotel preference">
              <select className="input">
                <option>Balanced</option>
                <option>Budget</option>
                <option>Comfort</option>
                <option>Luxury</option>
              </select>
            </Field>
            <Field label="Food preference">
              <select className="input">
                <option>No preference</option>
                <option>Vegetarian</option>
                <option>Halal only</option>
                <option>Seafood-focused</option>
              </select>
            </Field>
          </div>

          <div>
            <span className="text-xs font-medium text-ink-900/60 mb-2 block">Interests</span>
            <div className="flex flex-wrap gap-2">
              {interests.map((i) => (
                <label key={i} className="cursor-pointer">
                  <input type="checkbox" className="peer hidden" />
                  <span className="text-sm px-3 py-1.5 rounded-full border border-sand text-ink-900/70 peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors inline-block">
                    {i}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm px-6 py-3 rounded-full transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate Itinerary with AI
          </button>
        </form>

        <aside className="bg-ink-900 rounded-2xl p-6 h-fit sticky top-24">
          <Sparkles className="w-6 h-6 text-sunset mb-4" strokeWidth={1.5} />
          <h3 className="font-display text-lg text-paper mb-3">How the AI plans your trip</h3>
          <ol className="space-y-3 text-sm text-paper/60">
            <li><span className="text-sunset font-semibold">1.</span> Your parameters are matched against the curated attractions database for your destination.</li>
            <li><span className="text-sunset font-semibold">2.</span> Claude builds a day-by-day plan balancing your budget, interests, and trip length.</li>
            <li><span className="text-sunset font-semibold">3.</span> Routes, hotels, and estimated costs are attached automatically.</li>
            <li><span className="text-sunset font-semibold">4.</span> You can refine anything afterward via the AI chat assistant.</li>
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
