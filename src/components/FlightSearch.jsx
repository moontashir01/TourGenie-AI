import { useState, useEffect } from "react";
import { Plane, Clock, ArrowRight, Loader2, AlertCircle, RefreshCw, Users, ChevronsRight } from "lucide-react";
import { flightApi } from "../lib/api";

// Shown on the Itinerary page when transport_preference is "Flight"
// or when the destination looks international.
// Fetches real fares from Amadeus → your backend → this component.
export default function FlightSearch({ trip }) {
  const [flights, setFlights] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Auto-search when the component mounts if we have enough info
  useEffect(() => {
    if (trip?.origin && trip?.destination && trip?.start_date) {
      doSearch();
    }
  }, [trip?._id]);

  async function doSearch() {
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const result = await flightApi.search({
        origin: trip.origin,
        destination: trip.destination,
        date: trip.start_date?.slice(0, 10),
        travelers: trip.travelers,
      });
      setFlights(result.flights || []);
      setMeta(result.meta);
    } catch (err) {
      setError(typeof err.message === 'string' ? err.message : typeof err === 'string' ? err : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-sand rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="w-5 h-5 text-teal" strokeWidth={1.75} />
          <h3 className="font-display text-lg text-ink-900">Available Flights</h3>
        </div>
        {searched && !loading && (
          <button
            onClick={doSearch}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900/50 hover:text-teal-dark"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh fares
          </button>
        )}
      </div>

      {/* Route + date summary */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-900/60 bg-paper rounded-xl px-4 py-3">
        <span className="font-semibold text-ink-900">{trip.origin}</span>
        <ArrowRight className="w-4 h-4 text-teal" />
        <span className="font-semibold text-ink-900">{trip.destination}</span>
        <span className="mx-1">·</span>
        <span>{trip.start_date ? new Date(trip.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
        <span className="mx-1">·</span>
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}</span>
        {meta && (
          <>
            <span className="mx-1">·</span>
            <span className="font-mono text-xs text-teal-dark">{meta.originCode} → {meta.destCode}</span>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            {error.includes("IGNAV_API_KEY") && (
              <p className="mt-1 text-xs opacity-80">
                Add <code className="bg-sunset/10 px-1 rounded">IGNAV_API_KEY</code> to your <code>.env</code> file — sign up free (no card) at <strong>ignav.com</strong>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-ink-900/50 text-sm py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-teal" />
          Searching {trip.travelers > 1 ? `${trip.travelers} seats` : "flights"} across airlines…
        </div>
      )}

      {/* Results */}
      {!loading && searched && flights.length === 0 && !error && (
        <p className="text-sm text-ink-900/50 py-6 text-center">
          No flights found for this route and date. Try adjusting the travel date.
        </p>
      )}

      {!loading && flights.length > 0 && (
        <div className="space-y-3">
          {flights.map((f) => (
            <FlightCard key={f.id} flight={f} travelers={trip.travelers} />
          ))}
          <p className="text-xs text-ink-900/40 text-center pt-2">
            Fares are live from Amadeus · Prices include taxes · Book directly with the airline
          </p>
        </div>
      )}

      {/* Setup instructions shown when not yet searched (no API key scenario handled by error above) */}
      {!searched && !loading && (
        <div className="text-center py-6">
          <button
            onClick={doSearch}
            className="inline-flex items-center gap-2 bg-teal hover:bg-teal-dark text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
          >
            <Plane className="w-4 h-4" /> Search flights
          </button>
        </div>
      )}
    </div>
  );
}

function FlightCard({ flight, travelers }) {
  const depTime = new Date(flight.departure);
  const arrTime = new Date(flight.arrival);

  const fmtTime = (d) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const fmtDate = (d) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const totalPrice = flight.price;
  const perPerson = travelers > 1 ? Math.round(totalPrice / travelers) : null;
  const isDifferentDay = depTime.toDateString() !== arrTime.toDateString();

  const stopLabel =
    flight.stops === 0 ? "Direct" : flight.stops === 1 ? "1 stop" : `${flight.stops} stops`;

  const cabinColor =
    flight.cabin === "BUSINESS" ? "bg-sunset-light text-sunset-dark" :
    flight.cabin === "FIRST" ? "bg-ink-900 text-paper" :
    "bg-sand text-ink-900/60";

  return (
    <div className="border border-sand rounded-xl p-4 hover:border-teal/40 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: airline + flight number */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-teal-dark">{flight.airlineCode}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-ink-900 truncate">{flight.airline}</p>
            <p className="text-xs text-ink-900/50">{flight.flightNumber}</p>
          </div>
        </div>

        {/* Middle: route + times */}
        <div className="flex items-center gap-4 flex-1 justify-center flex-wrap gap-y-1">
          <div className="text-center">
            <p className="font-mono text-lg font-semibold text-ink-900">{fmtTime(depTime)}</p>
            <p className="text-xs text-ink-900/50">{flight.origin} · {fmtDate(depTime)}</p>
          </div>
          <div className="flex flex-col items-center gap-1 px-2">
            <p className="text-xs text-ink-900/50">{formatDuration(flight.duration)}</p>
            <div className="flex items-center gap-1">
              <div className="w-8 h-px bg-sand" />
              <ChevronsRight className="w-3.5 h-3.5 text-sand" />
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              flight.stops === 0 ? "bg-teal-light text-teal-dark" : "bg-sand text-ink-900/60"
            }`}>
              {stopLabel}
            </span>
          </div>
          <div className="text-center">
            <p className="font-mono text-lg font-semibold text-ink-900">
              {fmtTime(arrTime)}
              {isDifferentDay && <sup className="text-xs text-sunset ml-0.5">+1</sup>}
            </p>
            <p className="text-xs text-ink-900/50">{flight.destination} · {fmtDate(arrTime)}</p>
          </div>
        </div>

        {/* Right: price + cabin */}
        <div className="text-right shrink-0">
          <p className="font-mono text-xl font-bold text-ink-900">
            ৳{totalPrice.toLocaleString()}
          </p>
          {perPerson && (
            <p className="text-xs text-ink-900/50">৳{perPerson.toLocaleString()} / person</p>
          )}
          <div className="flex items-center justify-end gap-2 mt-1.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cabinColor}`}>
              {flight.cabin}
            </span>
            {flight.seatsLeft <= 5 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sunset-light text-sunset-dark">
                {flight.seatsLeft} left
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// "PT7H30M" → "7h 30m"
function formatDuration(iso) {
  if (!iso) return "—";
  const h = iso.match(/(\d+)H/)?.[1];
  const m = iso.match(/(\d+)M/)?.[1];
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ") || iso;
}
