import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle } from "lucide-react";
import AppShell from "../components/AppShell";
import { tripsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";

const interests = ["Beaches", "Hills & nature", "History", "Food", "Nightlife", "Shopping", "Adventure", "Family-friendly"];

export default function PlanTrip() {
  const navigate = useNavigate();
  const { setCurrentTripId } = useCurrentTrip();
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleInterest(i) {
    setSelectedInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.target);

    const payload = {
      origin: form.get("origin"),
      destination: form.get("destination"),
      start_date: form.get("start_date"),
      end_date: form.get("end_date"),
      travelers: Number(form.get("travelers")),
      budget: Number(form.get("budget")),
      transport_preference: form.get("transport_preference"),
      hotel_preference: form.get("hotel_preference"),
      food_preference: form.get("food_preference"),
      interests: selectedInterests,
    };

    if (!payload.destination || !payload.start_date || !payload.end_date || !payload.budget) {
      setError("Please fill in destination, dates, and budget.");
      return;
    }

    setSubmitting(true);
    try {
      const { trip } = await tripsApi.create(payload);
      setCurrentTripId(trip._id);
      navigate("/itinerary");
    } catch (err) {
      setError(err.message || "Couldn't create the trip");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Plan a new trip" subtitle="Fill in the basics — the AI does the rest.">
      <div className="grid lg:grid-cols-3 gap-8">
        <form className="lg:col-span-2 bg-white border border-sand rounded-2xl p-6 md:p-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Origin">
              <input name="origin" type="text" defaultValue="Dhaka" className="input" />
            </Field>
            <Field label="Destination">
              <input name="destination" type="text" placeholder="e.g. Cox's Bazar" className="input" required />
            </Field>
            <Field label="Start date">
              <input name="start_date" type="date" className="input" required />
            </Field>
            <Field label="End date">
              <input name="end_date" type="date" className="input" required />
            </Field>
            <Field label="Number of travelers">
              <input name="travelers" type="number" min="1" defaultValue="2" className="input" />
            </Field>
            <Field label="Budget (BDT)">
              <input name="budget" type="number" min="0" step="500" placeholder="e.g. 20000" className="input" required />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            <Field label="Transport preference">
              <select name="transport_preference" className="input" defaultValue="No preference">
                <option>No preference</option>
                <option>Bus</option>
                <option>Train</option>
                <option>Launch</option>
              </select>
            </Field>
            <Field label="Hotel preference">
              <select name="hotel_preference" className="input" defaultValue="Balanced">
                <option>Balanced</option>
                <option>Budget</option>
                <option>Comfort</option>
                <option>Luxury</option>
              </select>
            </Field>
            <Field label="Food preference">
              <select name="food_preference" className="input" defaultValue="No preference">
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
                  <input
                    type="checkbox"
                    className="peer hidden"
                    checked={selectedInterests.includes(i)}
                    onChange={() => toggleInterest(i)}
                  />
                  <span className="text-sm px-3 py-1.5 rounded-full border border-sand text-ink-900/70 peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors inline-block">
                    {i}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-900 font-semibold text-sm px-6 py-3 rounded-full transition-colors"
          >
            <Sparkles className="w-4 h-4" /> {submitting ? "Creating trip…" : "Create Trip"}
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
          <p className="text-xs text-paper/40 mt-4 border-t border-ink-700 pt-4">
            Creating a trip here saves it to your dashboard — you'll generate the actual itinerary with AI on the next screen.
          </p>
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
