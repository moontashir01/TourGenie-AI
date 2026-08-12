import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageCircleMore, Wallet, ChevronDown, Loader2, Plus, X, Sparkles, AlertCircle, Building2 } from "lucide-react";
import AppShell from "../components/AppShell";
import RouteLine from "../components/RouteLine";
import FlightSearch from "../components/FlightSearch";
import { tripsApi, itineraryApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";


function isInternationalTrip(trip) {
  const originCountry = trip?.origin_destination_id?.country_code;
  const destinationCountry = trip?.multi_city ? trip.country_code : trip?.destination_id?.country_code;
  return Boolean(originCountry && destinationCountry && originCountry !== destinationCountry);
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
  const itineraryCost = items.reduce((s, i) => s + (i.est_cost || 0), 0);
  const flightCost = trip?.selected_flight?.price || 0;
  let hotelCost = 0;
  if (trip?.multi_city && trip.hotel_selections?.length) {
    // Each day's last activity (items are ordered by day, time, so later
    // entries win) marks the city slept in that night.
    const cityByDay = {};
    for (const i of items) {
      if (i.city) cityByDay[i.day] = i.city;
    }
    const nightsByCity = {};
    for (const city of Object.values(cityByDay)) {
      nightsByCity[city] = (nightsByCity[city] || 0) + 1;
    }
    hotelCost = trip.hotel_selections.reduce((s, sel) => {
      const hotel = sel.hotel_id;
      if (!hotel?.price_per_night) return s;
      const nights = nightsByCity[sel.city] || 1;
      return s + hotel.price_per_night * nights;
    }, 0);
  } else if (trip?.hotel_id) {
    hotelCost = (trip.hotel_id.price_per_night || 0) * (trip.duration_days || 1);
  }
  const totalCost = itineraryCost + flightCost + hotelCost;

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
            isInternationalTrip(trip)
          ) && (
            <FlightSearch
              trip={trip.multi_city ? { ...trip, destination: trip.entry_city } : trip}
              onFlightSelected={(flight) => setTrip((prev) => ({ ...prev, selected_flight: flight }))}
            />
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
            const dayCities = trip?.multi_city
              ? [...new Set(dayItems.map((i) => i.city).filter(Boolean))]
              : [];
            return (
              <div key={day} className="bg-white border border-sand rounded-2xl overflow-hidden">
                <button onClick={() => setOpenDay(open ? null : day)} className="w-full flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <p className="font-display text-lg text-ink-900">Day {day}</p>
                    {dayCities.length > 0 && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light/40 text-teal-dark">
                        {dayCities.join(" → ")}
                      </span>
                    )}
                  </div>
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
                            {item.available_transport_options?.length > 0 && (
                              <div className="mt-3 bg-sand/30 rounded-xl p-3 border border-sand">
                                <p className="text-xs font-semibold text-ink-900/70 mb-2 uppercase tracking-wide">Select Transport</p>
                                <div className="space-y-2">
                                  {item.available_transport_options.map((opt, idx) => {
                                    const isSelected = item.selected_transport_option?.total_fare_bdt === opt.total_fare_bdt && item.selected_transport_option?.fare === opt.fare && (item.selected_transport_option?.flight_number === opt.flight_number || item.selected_transport_option?.code === opt.code);
                                    return (
                                      <button
                                        key={idx}
                                        onClick={async () => {
                                          try {
                                            const { item: updated } = await itineraryApi.selectTransport(currentTripId, item._id, { selected_option: opt });
                                            setItems((prev) => prev.map((i) => (i._id === item._id ? updated : i)));
                                          } catch (err) {
                                            setError(err.message);
                                          }
                                        }}
                                        className={`w-full text-left text-xs p-2.5 rounded-lg border flex justify-between items-center transition-all duration-200 ${
                                          isSelected
                                            ? "bg-teal-light/20 border-teal shadow-sm text-teal-dark font-medium"
                                            : "bg-white border-sand hover:border-teal/40 text-ink-900 hover:shadow-sm"
                                        }`}
                                      >
                                        <span>
                                          <span className="font-semibold">{opt.airline || opt.operator}</span>
                                          <span className="opacity-70 ml-1.5">{opt.flight_number || opt.mode} • {opt.depart_time}</span>
                                        </span>
                                        <span className="font-mono font-medium">৳{(opt.estimated_cost || 0).toLocaleString()}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
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
              <div className="flex justify-between"><dt className="text-paper/50">Activities</dt><dd className="text-paper">৳{itineraryCost.toLocaleString()}</dd></div>
              {flightCost > 0 && (
                <div className="flex justify-between"><dt className="text-paper/50">Flight</dt><dd className="text-paper">৳{flightCost.toLocaleString()}</dd></div>
              )}
              {hotelCost > 0 && (
                <div className="flex justify-between"><dt className="text-paper/50">Hotel</dt><dd className="text-paper">৳{hotelCost.toLocaleString()}</dd></div>
              )}
              <div className="flex justify-between border-t border-ink-700 pt-3">
                <dt className="text-paper/50">Trip cost so far</dt>
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
