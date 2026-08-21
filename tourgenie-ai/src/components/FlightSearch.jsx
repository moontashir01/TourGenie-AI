import { useState, useEffect } from "react";
import {
  Plane,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  ChevronsRight,
  ExternalLink,
  CalendarClock,
  BadgeCheck,
  FlaskConical,
} from "lucide-react";
import { flightApi, tripsApi } from "../lib/api";

// Shown on the Itinerary page when transport_preference is "Flight"
// or when the destination looks international.
//
// Fares come from whichever provider the server has a key for
// (Travelpayouts/Aviasales first, then Ignav). With no provider configured
// it falls back to the seeded demo schedules — which are clearly marked as
// demo data rather than passed off as bookable flights.
const SOURCES = {
  travelpayouts: {
    label: "Real fares · Aviasales",
    note: "Real fares found by Aviasales users in the last 48 hours. Prices move — open the fare to check it's still there before booking.",
    real: true,
  },
  ignav: {
    label: "Live fares · Ignav",
    note: "Live fares including taxes. Book directly with the airline.",
    real: true,
  },
  seeded: {
    label: "Demo schedules — not real flights",
    note: "No live flight provider is configured, so these are sample schedules from the seed data. They are not bookable and the fares are made up.",
    real: false,
  },
};

export default function FlightSearch({ trip, onFlightSelected }) {
  const [flights, setFlights] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedFlightId, setSelectedFlightId] = useState(trip?.selected_flight?.id || null);

  // Auto-search when the component mounts if we have enough info
  useEffect(() => {
    if (trip?.origin && trip?.destination && trip?.start_date) {
      doSearch();
    }
  }, [trip?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doSearch() {
    setLoading(true);
    setError("");
    setSearched(true);
    setSelectedFlightId(null);
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
      setError(typeof err.message === "string" ? err.message : typeof err === "string" ? err : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }

  // Handle saving the selected flight to the backend
  async function handleSelect(flight) {
    setSelectedFlightId(flight.id);
    try {
      await tripsApi.update(trip._id, { selected_flight: flight });
      onFlightSelected?.(flight);
    } catch (err) {
      setError("Could not save flight selection");
    }
  }

  const sourceInfo = SOURCES[meta?.source] || null;

  return (
    <div className="bg-white border border-sand rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Plane className="w-5 h-5 text-teal" strokeWidth={1.75} />
          <h3 className="font-display text-lg text-ink-900">Available Flights</h3>
          {sourceInfo && !loading && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                sourceInfo.real ? "bg-teal-light text-teal-dark" : "bg-sunset-light text-sunset-dark"
              }`}
            >
              {sourceInfo.real ? <BadgeCheck className="w-3 h-3" /> : <FlaskConical className="w-3 h-3" />}
              {sourceInfo.label}
            </span>
          )}
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

      {/* No real provider configured — say what to do about it */}
      {!loading && meta && !meta.is_real && meta.setup_hint && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-xl px-4 py-3">
          <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">These are demo flights, not real ones.</p>
            <p className="mt-1 text-xs opacity-90">
              Add <code className="bg-sunset/10 px-1 rounded">TRAVELPAYOUTS_API_KEY</code> to the server's{" "}
              <code className="bg-sunset/10 px-1 rounded">.env</code> — a free token takes a minute at{" "}
              <a href="https://www.travelpayouts.com" target="_blank" rel="noreferrer" className="underline font-semibold">
                travelpayouts.com
              </a>
              , then hit Refresh fares.
            </p>
          </div>
        </div>
      )}

      {/* The requested day had no cached fares, so these are nearby dates */}
      {!loading && meta?.date_shifted && (
        <div className="flex items-start gap-2 bg-gold/10 border border-gold/30 text-ink-900 text-sm rounded-xl px-4 py-3">
          <CalendarClock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Nothing was cached for{" "}
            {new Date(meta.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} exactly — these are the
            cheapest real fares found on nearby dates that month. Check each departure date before selecting.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
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
            <FlightCard
              key={f.id}
              flight={f}
              travelers={trip.travelers}
              tripDate={meta?.date}
              isSelected={selectedFlightId === f.id}
              onSelect={handleSelect}
            />
          ))}
          {sourceInfo && <p className="text-xs text-ink-900/40 text-center pt-2">{sourceInfo.note}</p>}
        </div>
      )}

      {/* Setup instructions shown when not yet searched */}
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

function FlightCard({ flight, travelers, tripDate, onSelect, isSelected }) {
  const depTime = flight.departure ? new Date(flight.departure) : null;
  const arrTime = flight.arrival ? new Date(flight.arrival) : null;

  const fmtTime = (d) =>
    d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
  const fmtDate = (d) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

  const totalPrice = flight.price;
  const perPerson = travelers > 1 ? flight.pricePerSeat ?? Math.round(totalPrice / travelers) : null;
  const isDifferentDay = depTime && arrTime && depTime.toDateString() !== arrTime.toDateString();
  // A fare pulled from a nearby date is only worth calling out per-card when
  // it actually departs on a different day than the trip starts.
  const offDate =
    flight.dateShifted && depTime && tripDate && depTime.toISOString().slice(0, 10) !== tripDate;

  const stopLabel =
    flight.stops === 0 ? "Direct" : flight.stops === 1 ? "1 stop" : `${flight.stops} stops`;

  const cabinColor =
    flight.cabin === "BUSINESS" ? "bg-sunset-light text-sunset-dark" :
    flight.cabin === "FIRST" ? "bg-ink-900 text-paper" :
    "bg-sand text-ink-900/60";
  const formatMoney = (amount) => new Intl.NumberFormat("en", {
    style: "currency",
    currency: flight.currency || "BDT",
    maximumFractionDigits: 0,
  }).format(amount || 0);

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      isSelected ? "border-teal bg-teal-light/10 shadow-sm" : "border-sand hover:border-teal/40 hover:shadow-sm"
    }`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: airline + flight number */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-teal-dark">{flight.airlineCode}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-ink-900 truncate">{flight.airline}</p>
            <p className="text-xs text-ink-900/50">
              {flight.flightNumber}
              {flight.isLowcost && <span className="ml-1.5 text-teal-dark">low-cost</span>}
            </p>
          </div>
        </div>

        {/* Middle: route + times */}
        <div className="flex items-center gap-4 flex-1 justify-center flex-wrap gap-y-1">
          <div className="text-center">
            <p className="font-mono text-lg font-semibold text-ink-900">{fmtTime(depTime)}</p>
            <p className={`text-xs ${offDate ? "text-sunset-dark font-medium" : "text-ink-900/50"}`}>
              {flight.origin} · {fmtDate(depTime)}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 px-2">
            <p className="text-xs text-ink-900/50">{flight.duration || "—"}</p>
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

        {/* Right: price + cabin + select button */}
        <div className="text-right shrink-0 flex flex-col items-end">
          <p className="font-mono text-xl font-bold text-ink-900">
            {formatMoney(totalPrice)}
          </p>
          {perPerson && (
            <p className="text-xs text-ink-900/50">{formatMoney(perPerson)} / person</p>
          )}
          <div className="flex items-center justify-end gap-2 mt-1.5 mb-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cabinColor}`}>
              {flight.cabin}
            </span>
            {flight.priceStatus === "indicative" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sunset-light text-sunset-dark">
                demo fare
              </span>
            )}
            {flight.priceStatus === "cached" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sand text-ink-900/60">
                last seen fare
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {flight.bookingUrl && (
              <a
                href={flight.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-sand text-ink-900/70 hover:border-teal hover:text-teal transition-colors"
              >
                Check fare <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={() => onSelect(flight)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-colors ${
                isSelected
                  ? "bg-teal text-white shadow-sm"
                  : "bg-paper text-ink-900/70 border border-sand hover:border-teal hover:text-teal"
              }`}
            >
              {isSelected ? "Selected" : "Select"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
