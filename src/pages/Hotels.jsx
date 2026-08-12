import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Wifi, Loader2, CheckCircle2, ArrowUpDown, AlertCircle } from "lucide-react";
import AppShell from "../components/AppShell";
import { tripsApi, hotelApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";

const sortOptions = [
  { value: "", label: "Best match" },
  { value: "price", label: "Lowest price" },
  { value: "rating", label: "Highest rated" },
];

export default function Hotels() {
  const { currentTripId } = useCurrentTrip();
  const [trip, setTrip] = useState(null);
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
      .then(({ trip }) => {
        setTrip(trip);
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

  function changeSort(value) {
    setSort(value);
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

  async function handleSelect(hotelId) {
    setSelectingId(hotelId);
    setError("");
    try {
      await hotelApi.select(hotelId, currentTripId);
      setSelectedHotelId(hotelId);
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

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink-900/50">{hotels.length} hotel{hotels.length !== 1 ? "s" : ""} found</p>
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
            No seeded hotels for {trip?.destination} yet — add some via the admin console or the seed script.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotels.map((h) => {
            const isSelected = selectedHotelId === h._id;
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
