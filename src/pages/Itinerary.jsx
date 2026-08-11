import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageCircleMore, Wallet, ChevronDown, Loader2, Plus, X, Sparkles, AlertCircle, Building2 } from "lucide-react";
import AppShell from "../components/AppShell";
import RouteLine from "../components/RouteLine";
import FlightSearch from "../components/FlightSearch";
import { tripsApi, itineraryApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";


// Consider a trip international if origin and destination are different countries
// Uses a simple heuristic based on known Bangladesh cities.
const BD_CITIES = new Set([
  "dhaka","chittagong","chattogram","sylhet","cox's bazar","coxs bazar",
  "cox bazar","rajshahi","khulna","barisal","rangpur","mymensingh","comilla",
  "narayanganj","jessore","jashore","bogra","cumilla"
]);
function isLikelyInternational(origin, dest) {
  if (!origin || !dest) return false;
  const oLower = origin.toLowerCase().trim();
  const dLower = dest.toLowerCase().trim();
  // If destination is not a known BD city it's probably international
  return !BD_CITIES.has(dLower);
}

export default function Itinerary() {
  const { currentTripId } = useCurrentTrip();
  const [trip, setTrip] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openDay, setOpenDay] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    Promise.all([tripsApi.get(currentTripId), itineraryApi.get(currentTripId)])
      .then(([tripRes, itemsRes]) => {
        setTrip(tripRes.trip);
        setItems(itemsRes.items);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentTripId]);

  async function handleGenerateAI() {
    setError("");
    setGenerating(true);
    try {
      const { items: generated } = await itineraryApi.generateAI(currentTripId);
      setItems(generated);
      setOpenDay(generated[0]?.day || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const newItem = {
      day: Number(form.get("day")),
      time: form.get("time"),
      activity: form.get("activity"),
      location: form.get("location"),
      est_cost: Number(form.get("est_cost") || 0),
    };

    setSaving(true);
    try {
      const { items: saved } = await itineraryApi.generate(currentTripId, [...items, newItem]);
      setItems(saved);
      setOpenDay(newItem.day);
      setShowForm(false);
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!currentTripId) {
    return (
      <AppShell title="Itinerary">
        <div className="bg-white border border-dashed border-sand rounded-2xl p-12 text-center">
          <p className="text-ink-900/60 mb-4">No trip selected yet.</p>
          <Link to="/dashboard" className="text-sm font-semibold text-teal-dark hover:text-teal">
            ← Go to your trips
          </Link>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Itinerary">
        <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading itinerary…
        </div>
      </AppShell>
    );
  }

  const days = [...new Set(items.map((i) => i.day))].sort((a, b) => a - b);
  const totalCost = items.reduce((s, i) => s + (i.est_cost || 0), 0);

  return (
    <AppShell
      title={trip ? `${trip.destination} Itinerary` : "Itinerary"}
      subtitle={trip ? `${new Date(trip.start_date).toLocaleDateString()} – ${new Date(trip.end_date).toLocaleDateString()} · ${trip.travelers} travelers` : ""}
    >
      {error && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {/* Flight search panel — shown when transport preference is Flight
              OR when origin and destination are different countries */}
          {trip && (
            trip.transport_preference === "Flight" ||
            isLikelyInternational(trip.origin, trip.destination)
          ) && (
            <FlightSearch trip={trip} />
          )}

          {items.length === 0 && !showForm && (
            <div className="bg-white border border-dashed border-sand rounded-2xl p-10 text-center">
              {generating ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-6 h-6 text-teal animate-spin" />
                  <p className="text-sm text-ink-900/60">Asking Claude to plan your {trip?.destination} trip…</p>
                </div>
              ) : (
                <>
                  <p className="text-ink-900/60 mb-5 text-sm">No itinerary items yet — generate a full plan with AI, or build it by hand.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handleGenerateAI}
                      className="inline-flex items-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-900 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
                    >
                      <Sparkles className="w-4 h-4" /> Generate Itinerary with AI
                    </button>
                    <button
                      onClick={() => setShowForm(true)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal px-2"
                    >
                      <Plus className="w-4 h-4" /> Add activity manually
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {days.map((day) => {
            const dayItems = items.filter((i) => i.day === day).sort((a, b) => a.time.localeCompare(b.time));
            const open = openDay === day;
            return (
              <div key={day} className="bg-white border border-sand rounded-2xl overflow-hidden">
                <button onClick={() => setOpenDay(open ? null : day)} className="w-full flex items-center justify-between px-6 py-4">
                  <p className="font-display text-lg text-ink-900">Day {day}</p>
                  <ChevronDown className={`w-4 h-4 text-ink-900/40 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="px-6 pb-6">
                    <RouteLine className="w-full h-3 mb-4" color="#DCEFEC" />
                    <ul className="space-y-4">
                      {dayItems.map((item) => (
                        <li key={item._id} className="flex gap-4">
                          <div className="w-16 shrink-0 text-xs font-mono text-teal-dark pt-0.5">{item.time}</div>
                          <div className="flex-1 border-l-2 border-teal-light pl-4 pb-1">
                            <p className="text-sm font-semibold text-ink-900">{item.activity}</p>
                            {item.location && (
                              <p className="text-xs text-ink-900/50 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> {item.location}
                              </p>
                            )}
                          </div>
                          <div className="text-xs font-mono text-ink-900/60 pt-0.5 shrink-0">
                            {item.est_cost > 0 ? `৳${item.est_cost.toLocaleString()}` : "Free"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}

          {items.length > 0 && !showForm && (
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal"
              >
                <Plus className="w-4 h-4" /> Add another activity
              </button>
              <button
                onClick={handleGenerateAI}
                disabled={generating}
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900/50 hover:text-sunset-dark disabled:opacity-60"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Regenerating…" : "Regenerate with AI (replaces current plan)"}
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleAddItem} className="bg-white border border-sand rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-base text-ink-900">Add activity</h4>
                <button type="button" onClick={() => setShowForm(false)} className="text-ink-900/40 hover:text-ink-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Day</span>
                  <input name="day" type="number" min="1" defaultValue="1" required className="input" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Time</span>
                  <input name="time" type="time" required className="input" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Activity</span>
                <input name="activity" type="text" placeholder="e.g. Sunset walk on the beach" required className="input" />
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Location</span>
                  <input name="location" type="text" placeholder="e.g. Laboni Point" className="input" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Estimated cost (BDT)</span>
                  <input name="est_cost" type="number" min="0" defaultValue="0" className="input" />
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-teal hover:bg-teal-dark disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
              >
                {saving ? "Saving…" : "Save activity"}
              </button>
            </form>
          )}
        </div>

        <aside className="space-y-5">
          <div className="bg-ink-900 rounded-2xl p-6">
            <p className="text-xs font-semibold tracking-wide uppercase text-sunset mb-4">Trip snapshot</p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-paper/50">Route</dt><dd className="text-paper">{trip?.origin} → {trip?.destination}</dd></div>
              <div className="flex justify-between"><dt className="text-paper/50">Travelers</dt><dd className="text-paper">{trip?.travelers}</dd></div>
              <div className="flex justify-between border-t border-ink-700 pt-3">
                <dt className="text-paper/50">Itinerary cost so far</dt>
                <dd className="text-sunset font-mono font-semibold">৳{totalCost.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-sand rounded-2xl p-6">
            <p className="text-xs font-semibold tracking-wide uppercase text-teal mb-3 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Budget snapshot
            </p>
            <p className="text-2xl font-display text-ink-900 mb-1">৳{totalCost.toLocaleString()}</p>
            <p className="text-xs text-ink-900/50">of ৳{trip?.budget?.toLocaleString()} planned budget</p>
            <div className="w-full h-2 bg-paper rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-teal"
                style={{ width: `${trip?.budget ? Math.min((totalCost / trip.budget) * 100, 100) : 0}%` }}
              />
            </div>
          </div>

          <Link
            to="/hotels"
            className="w-full inline-flex items-center justify-center gap-2 bg-white border border-sand hover:border-teal text-ink-900 font-semibold text-sm px-5 py-3 rounded-full transition-colors"
          >
            <Building2 className="w-4 h-4" /> Browse Hotels
          </Link>

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
