import { useEffect, useState } from "react";
import { Star, Wifi, Loader2, CheckCircle2, ArrowUpDown, AlertCircle, MapPin } from "lucide-react";
import AppShell from "../components/AppShell";
import { NoTripState } from "../components/ui/States";
import { CardSkeleton } from "../components/Skeleton";
import Money from "../components/Money";
import HotelBookingModal from "../components/HotelBookingModal";
import { tripsApi, hotelApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import PlaceImage from "../components/ui/PlaceImage";

const sortOptions = [
  { value: "", label: "Best match" },
  { value: "price", label: "Lowest price" },
  { value: "rating", label: "Highest rated" },
];

export default function Hotels() {
  const { currentTripId } = useCurrentTrip();
  const [trip, setTrip] = useState(null);
  const [cities, setCities] = useState([]); // multi-city trips only
  // Every city in the country, behind the "show all" escape hatch: the picks
  // are the sensible default, not a cage — a traveller may want a hotel in a
  // city they didn't pre-select.
  const [allCities, setAllCities] = useState([]);
  const [cityScope, setCityScope] = useState(null);
  const [showAllCities, setShowAllCities] = useState(false);
  const [activeCity, setActiveCity] = useState(null);
  const [hotelSelections, setHotelSelections] = useState([]); // [{ city, hotel_id }]
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("");
  const [selectingId, setSelectingId] = useState(null);
  const [selectedHotelId, setSelectedHotelId] = useState(null);
  const localCurrency = trip?.destination_id?.currency;
  const [bookingHotel, setBookingHotel] = useState(null);
  const [bookedHotelIds, setBookedHotelIds] = useState([]);

  // The stay the prices are for. Without these the API can only quote a rate
  // for no particular night, which is not a price anyone can act on — and a
  // stay total with no nights attached is what used to get stored as if it
  // were a nightly rate.
  //
  // On a multi-city trip these are the whole trip's dates rather than the
  // nights spent in this one city: the per-night rate that comes back is
  // still the right figure to show and to budget with, only the stay total
  // would describe a longer stay than this city gets.
  function stayParams(forTrip) {
    if (!forTrip?.start_date || !forTrip?.end_date) return {};
    return {
      check_in: String(forTrip.start_date).slice(0, 10),
      check_out: String(forTrip.end_date).slice(0, 10),
      guests: forTrip.travelers || 2,
    };
  }

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

          // The cities the traveller picked, resolved on the server by the
          // same rule the itinerary planner narrows its pool with — this page
          // used to list every city in the country regardless.
          const scope = await tripsApi.cities(currentTripId);
          const cityList = scope.cities || [];
          setCities(cityList);
          setAllCities(scope.all_cities || cityList);
          setCityScope(scope);
          const initialCity = cityList.includes(trip.entry_city) ? trip.entry_city : cityList[0];
          setActiveCity(initialCity);
          return initialCity
            ? hotelApi.list({ city: initialCity, ...stayParams(trip), ...(sort ? { sort } : {}) })
            : null;
        }

        setSelectedHotelId(trip.hotel_id?._id || trip.hotel_id || null);
        return hotelApi.list({
          // The city name goes along with the id: the id filters the seeded
          // catalogue, the name is what a live lookup can actually search on.
          ...(trip.destination_id?._id ? { destination_id: trip.destination_id._id } : {}),
          city: trip.destination_id?.name || trip.destination,
          ...stayParams(trip),
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
      .list({ city, ...stayParams(trip), ...(sortValue ? { sort: sortValue } : {}) })
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
        ...(trip.destination_id?._id ? { destination_id: trip.destination_id._id } : {}),
        city: trip.destination_id?.name || trip.destination,
        ...stayParams(trip),
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
        <NoTripState what="Hotels" />
      </AppShell>
    );
  }

  // The picks are the default view; "show all" widens it to the country.
  const visibleCities = showAllCities ? allCities : cities;
  const canShowAllCities = Boolean(cityScope?.filtered && allCities.length > cities.length);

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

      {trip?.multi_city && visibleCities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {visibleCities.map((city) => {
            const picked = hotelSelections.some((s) => s.city.toLowerCase() === city.toLowerCase());
            return (
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
                {picked && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            );
          })}
          {canShowAllCities && (
            <button
              onClick={() => setShowAllCities((prev) => !prev)}
              className="text-sm font-semibold text-ink-500 hover:text-teal-dark px-2 py-2"
            >
              {showAllCities
                ? "Show only my cities"
                : `Show all cities in ${cityScope?.country || "this country"}`}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink-500">{hotels.length} hotel{hotels.length !== 1 ? "s" : ""} found{trip?.multi_city && activeCity ? ` in ${activeCity}` : ""}</p>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-ink-500" />
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
            className="text-sm bg-surface border border-sand rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : hotels.length === 0 ? (
        <div className="bg-surface border border-dashed border-sand rounded-2xl p-12 text-center">
          <p className="text-ink-600 text-sm">
            No seeded hotels for {trip?.multi_city ? activeCity : trip?.destination} yet — add some via the admin console or the seed script.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotels.map((h) => {
            const isSelected = activeSelectedHotelId === h._id;
            return (
              <div key={h._id} className="group card card-hover overflow-hidden flex flex-col">
                <PlaceImage src={h.image_url} alt={h.name} icon={Wifi} ratio="21/9" />
                <div className="p-5 flex flex-col flex-1">
                  <h4 className="font-display text-lg text-ink-900 mb-1">{h.name}</h4>
                  <div className="flex items-center gap-1 text-gold mb-2">
                    <Star className="w-3.5 h-3.5 fill-gold" />
                    <span className="text-sm font-semibold text-ink-900/70">{h.rating.toFixed(1)}</span>
                  </div>
                  <p className="font-mono text-lg text-ink-900 mb-3">
                    <Money bdt={h.price_per_night} local={localCurrency} localClassName="text-sm" />
                    <span className="text-sm text-ink-500 font-sans"> /night</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {h.facilities.map((f) => (
                      <span key={f} className="text-2xs bg-paper text-ink-600 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-col gap-1.5">
                    <button
                      onClick={() => setBookingHotel(h)}
                      className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-full bg-sunset hover:bg-sunset-dark text-ink-fixed transition-colors"
                    >
                      {bookedHotelIds.includes(h._id) ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Booked — book again
                        </>
                      ) : (
                        "Book (demo)"
                      )}
                    </button>
                    <button
                      onClick={() => handleSelect(h._id)}
                      disabled={selectingId === h._id || isSelected}
                      className={`w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-colors ${
                        isSelected
                          ? "bg-teal-light text-teal-dark cursor-default"
                          : "bg-surface border border-sand hover:border-teal text-ink-900/70 disabled:opacity-60"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Selected for this trip
                        </>
                      ) : selectingId === h._id ? (
                        "Selecting…"
                      ) : (
                        "Set as my stay"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {bookingHotel && (

        <HotelBookingModal

          hotel={bookingHotel}

          trip={trip}

          localCurrency={localCurrency}

          onClose={() => setBookingHotel(null)}

          onBooked={(b) => setBookedHotelIds((prev) => [...new Set([...prev, b.hotel_id?._id || b.hotel_id])])}

        />

      )}

    </AppShell>
  );
}
