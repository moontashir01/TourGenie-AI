import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Wifi, Loader2, CheckCircle2, ArrowUpDown, AlertCircle, MapPin } from "lucide-react";
import AppShell from "../components/AppShell";
import { tripsApi, hotelApi, itineraryApi, destinationsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";

const sortOptions = [
  { value: "", label: "Best match" },
  { value: "price", label: "Lowest price" },
  { value: "rating", label: "Highest rated" },
];

export default function Hotels() {
  const { currentTripId } = useCurrentTrip();
  const [trip, setTrip] = useState(null);
  const [cities, setCities] = useState([]); // multi-city trips only
  const [activeCity, setActiveCity] = useState(null);
  const [hotelSelections, setHotelSelections] = useState([]); // [{ city, hotel_id }]
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("");
  const [selectingId, setSelectingId] = useState(null);
  const [selectedHotelId, setSelectedHotelId] = useState(null);

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

        if (trip.multi_city) {
          const selections = (trip.hotel_selections || []).map((s) => ({
            city: s.city,
            hotel_id: s.hotel_id?._id || s.hotel_id,
          }));
          setHotelSelections(selections);

          // Prefer the cities the AI actually routed through; fall back to
          // every city in the country if the itinerary hasn't been generated yet.
          let cityList = [];
          try {
            const { items } = await itineraryApi.get(currentTripId);
            cityList = [...new Set((items || []).map((i) => i.city).filter(Boolean))];
          } catch {
            cityList = [];
          }
          if (cityList.length === 0) {
            const { destinations } = await destinationsApi.list({ country_code: trip.country_code });
            cityList = destinations.map((d) => d.name);
          }
          setCities(cityList);
          const initialCity = cityList.includes(trip.entry_city) ? trip.entry_city : cityList[0];
          setActiveCity(initialCity);
          return initialCity
            ? hotelApi.list({ city: initialCity, ...(sort ? { sort } : {}) })
            : null;
        }

        setSelectedHotelId(trip.hotel_id?._id || trip.hotel_id || null);
        return hotelApi.list({
          ...(trip.destination_id?._id
            ? { destination_id: trip.destination_id._id }
            : { city: trip.destination }),
          ...(sort ? { sort } : {}),
        });
      })
      .then((res) => res && setHotels(res.hotels))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentTripId]);

  function fetchHotelsFor(city, sortValue) {
    setLoading(true);
    hotelApi
      .list({ city, ...(sortValue ? { sort: sortValue } : {}) })
      .then(({ hotels }) => setHotels(hotels))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function changeSort(value) {
    setSort(value);
    if (trip?.multi_city) {
      fetchHotelsFor(activeCity, value);
      return;
    }
    setLoading(true);
    hotelApi
      .list({
        ...(trip.destination_id?._id
          ? { destination_id: trip.destination_id._id }
          : { city: trip.destination }),
        ...(value ? { sort: value } : {}),
      })
      .then(({ hotels }) => setHotels(hotels))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function changeCity(city) {
    setActiveCity(city);
    fetchHotelsFor(city, sort);
  }

  async function handleSelect(hotelId) {
    setSelectingId(hotelId);
    setError("");
    try {
      if (trip.multi_city) {
        await hotelApi.select(hotelId, currentTripId, activeCity);
        setHotelSelections((prev) => [
          ...prev.filter((s) => s.city.toLowerCase() !== activeCity.toLowerCase()),
          { city: activeCity, hotel_id: hotelId },
        ]);
      } else {
        await hotelApi.select(hotelId, currentTripId);
        setSelectedHotelId(hotelId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSelectingId(null);
    }
  }

  if (!currentTripId) {
    return (
      <AppShell title="Hotel Recommendations">
        <div className="bg-white border border-dashed border-sand rounded-2xl p-12 text-center">
          <p className="text-ink-900/60 mb-4">No trip selected yet.</p>
          <Link to="/dashboard" className="text-sm font-semibold text-teal-dark hover:text-teal">← Go to your trips</Link>
        </div>
      </AppShell>
    );
  }

  const activeSelectedHotelId = trip?.multi_city
    ? hotelSelections.find((s) => s.city.toLowerCase() === activeCity?.toLowerCase())?.hotel_id || null
    : selectedHotelId;

  return (
    <AppShell
      title="Hotel Recommendations"
      subtitle={trip ? `Ranked accommodation options for ${trip.destination}` : ""}
    >
      {error && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {trip?.multi_city && cities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {cities.map((city) => {
            const picked = hotelSelections.some((s) => s.city.toLowerCase() === city.toLowerCase());
            return (
              <button
                key={city}
                onClick={() => changeCity(city)}
                className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-full border transition-colors ${
                  activeCity === city
                    ? "bg-teal text-white border-teal"
                    : "bg-white text-ink-900/70 border-sand hover:border-teal/40"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> {city}
                {picked && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink-900/50">{hotels.length} hotel{hotels.length !== 1 ? "s" : ""} found{trip?.multi_city && activeCity ? ` in ${activeCity}` : ""}</p>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-ink-900/40" />
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
            className="text-sm bg-white border border-sand rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading hotels…
        </div>
      ) : hotels.length === 0 ? (
        <div className="bg-white border border-dashed border-sand rounded-2xl p-12 text-center">
          <p className="text-ink-900/60 text-sm">
            No seeded hotels for {trip?.multi_city ? activeCity : trip?.destination} yet — add some via the admin console or the seed script.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotels.map((h) => {
            const isSelected = activeSelectedHotelId === h._id;
            return (
              <div key={h._id} className="bg-white border border-sand rounded-2xl overflow-hidden hover:border-teal/40 transition-colors flex flex-col">
                <div className="h-28 bg-teal-light flex items-center justify-center">
                  <Wifi className="w-8 h-8 text-teal-dark" strokeWidth={1.5} />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h4 className="font-display text-lg text-ink-900 mb-1">{h.name}</h4>
                  <div className="flex items-center gap-1 text-gold mb-2">
                    <Star className="w-3.5 h-3.5 fill-gold" />
                    <span className="text-xs font-semibold text-ink-900/70">{h.rating.toFixed(1)}</span>
                  </div>
                  <p className="font-mono text-lg text-ink-900 mb-3">৳{h.price_per_night.toLocaleString()}<span className="text-xs text-ink-900/40 font-sans"> /night</span></p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {h.facilities.map((f) => (
                      <span key={f} className="text-[11px] bg-paper text-ink-900/60 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleSelect(h._id)}
                    disabled={selectingId === h._id || isSelected}
                    className={`mt-auto w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-full transition-colors ${
                      isSelected
                        ? "bg-teal-light text-teal-dark cursor-default"
                        : "bg-sunset hover:bg-sunset-dark text-ink-900 disabled:opacity-60"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Selected
                      </>
                    ) : selectingId === h._id ? (
                      "Selecting…"
                    ) : (
                      "Select Hotel"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
