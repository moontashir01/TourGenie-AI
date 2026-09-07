import { useEffect, useMemo, useState } from "react";
import Button from "../components/ui/Button";
import { Link } from "react-router-dom";
import { MapPin, Star, Clock, CheckCircle2, Loader2, AlertCircle, Landmark } from "lucide-react";
import AppShell from "../components/AppShell";
import { NoTripState } from "../components/ui/States";
import { tripsApi, attractionApi, destinationsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import PlaceImage from "../components/ui/PlaceImage";

export default function AttractionPicker() {
  const { currentTripId } = useCurrentTrip();
  const [trip, setTrip] = useState(null);
  const [cities, setCities] = useState([]);
  const [activeCity, setActiveCity] = useState(null);
  const [attractions, setAttractions] = useState([]);
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    setError("");
    tripsApi
      .get(currentTripId)
      .then(async ({ trip }) => {
        setTrip(trip);
        setSelected(new Set((trip.must_visit_attraction_ids || []).map((a) => a._id || a)));

        let cityList = [];
        if (trip.multi_city) {
          const { destinations } = await destinationsApi.list({ country_code: trip.country_code });
          cityList = destinations.map((d) => d.name);
        } else {
          cityList = [trip.destination];
        }
        setCities(cityList);
        setActiveCity(cityList[0]);
        return cityList[0] ? attractionApi.list({ city: cityList[0] }) : null;
      })
      .then((res) => res && setAttractions(res.attractions))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentTripId]);

  function changeCity(city) {
    setActiveCity(city);
    setCategory("");
    setLoading(true);
    attractionApi
      .list({ city })
      .then(({ attractions }) => setAttractions(attractions))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function toggle(id) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await tripsApi.update(currentTripId, { must_visit_attraction_ids: [...selected] });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const categories = useMemo(
    () => [...new Set(attractions.map((a) => a.category))].sort(),
    [attractions]
  );
  const visible = category ? attractions.filter((a) => a.category === category) : attractions;

  if (!currentTripId) {
    return (
      <AppShell title="Pick Your Attractions">
        <NoTripState what="Attractions" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Pick Your Attractions"
      subtitle={trip ? `Choose the must-sees for ${trip.destination} — the AI itinerary will build around every pick` : ""}
    >
      {error && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {cities.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => changeCity(city)}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-full border transition-colors ${
                activeCity === city
                  ? "bg-teal text-paper-fixed border-teal"
                  : "bg-surface text-ink-900/70 border-sand hover:border-teal/40"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" /> {city}
            </button>
          ))}
        </div>
      )}

      {categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setCategory("")}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              !category ? "bg-ink-900 text-paper border-ink-900" : "bg-surface text-ink-600 border-sand hover:border-ink-900/30"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border capitalize transition-colors ${
                category === c ? "bg-ink-900 text-paper border-ink-900" : "bg-surface text-ink-600 border-sand hover:border-ink-900/30"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-ink-500 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading attractions…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-surface border border-dashed border-sand rounded-2xl p-12 text-center">
          <p className="text-ink-600 text-sm">No seeded attractions for {activeCity} yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-24">
          {visible.map((a) => {
            const isSelected = selected.has(a._id);
            return (
              <button
                key={a._id}
                onClick={() => toggle(a._id)}
                className={`group text-left card overflow-hidden flex flex-col ${
                  isSelected
                    ? "border-teal shadow-soft ring-1 ring-teal -translate-y-0.5"
                    : "card-hover"
                }`}
              >
                <PlaceImage
                  src={a.image_url}
                  alt={a.name}
                  icon={Landmark}
                  ratio="21/9"
                  corner={
                    isSelected && (
                      <span className="w-6 h-6 rounded-full bg-teal text-paper-fixed flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )
                  }
                />
                <div className="p-4 flex flex-col flex-1">
                  <p className="text-3xs font-semibold uppercase tracking-wide text-teal-dark mb-1">{a.category}</p>
                  <h4 className="font-display text-base text-ink-900 mb-1.5 leading-snug">{a.name}</h4>
                  <div className="flex items-center gap-3 text-sm text-ink-500 mb-2">
                    {a.rating > 0 && (
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-gold text-gold" /> {a.rating.toFixed(1)}</span>
                    )}
                    {a.avg_visit_duration_min && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.avg_visit_duration_min}m</span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-ink-900 mt-auto">
                    {a.is_free || a.entry_fee === 0 ? "Free" : `৳${a.entry_fee.toLocaleString()}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-surface border-t border-sand px-6 md:px-10 py-4 flex items-center justify-between">
        <p className="text-sm text-ink-600">
          {selected.size} attraction{selected.size !== 1 ? "s" : ""} picked
          {saved && <span className="text-teal-dark font-medium ml-2">· Saved</span>}
        </p>
        <div className="flex items-center gap-3">
          <Link to="/itinerary" className="text-sm font-semibold text-ink-600 hover:text-ink-900">
            Skip to itinerary
          </Link>
          <Button variant="teal" icon={CheckCircle2} loading={saving} onClick={handleSave}>
            Save picks
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
