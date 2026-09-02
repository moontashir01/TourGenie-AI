import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, ArrowLeft, Loader2, TriangleAlert, Compass } from "lucide-react";
import { tripsApi, itineraryApi, bookingApi, hotelBookingApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useCurrency } from "../context/CurrencyContext";

// A printable copy of the whole plan.
//
// Deliberately not a PDF library: every browser already prints to PDF, and
// a print stylesheet gives the traveller both options — paper or file —
// without shipping 300 kB of renderer. What this page owes them is a layout
// that survives the transition: no chrome, no colour dependence, and days
// that don't split across a page break.

const DATE = { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", DATE) : "";
}

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-3 py-1 border-b border-sand/70 last:border-0">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-ink-900/50">{label}</dt>
      <dd className="text-sm text-ink-900">{value}</dd>
    </div>
  );
}

export default function TripPrint() {
  const { currentTripId } = useCurrentTrip();
  const { formatBdt, convert } = useCurrency();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all([
      tripsApi.get(currentTripId),
      itineraryApi.get(currentTripId),
      // Bookings are a bonus, not a requirement — a trip with none should
      // still print.
      bookingApi.forTrip(currentTripId).catch(() => ({ bookings: [] })),
      hotelBookingApi.forTrip(currentTripId).catch(() => ({ bookings: [] })),
    ])
      .then(([tripRes, itineraryRes, transportRes, hotelRes]) => {
        if (cancelled) return;
        setData({
          trip: tripRes.trip,
          items: itineraryRes.items || [],
          transport: (transportRes.bookings || []).filter((b) => b.status !== "cancelled"),
          hotels: (hotelRes.bookings || []).filter((b) => b.status !== "cancelled"),
        });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [currentTripId]);

  if (!currentTripId) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm text-ink-900/70">Open a trip first — this prints the plan for whichever trip you have open.</p>
          <Link to="/dashboard" className="inline-block mt-4 text-sm font-semibold text-teal-dark hover:underline">
            Go to my trips
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-teal-dark" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="max-w-md flex items-start gap-3 p-4 bg-sunset-light border border-sunset/30 rounded-xl">
          <TriangleAlert className="w-5 h-5 text-sunset-dark shrink-0 mt-0.5" />
          <p className="text-sm text-ink-900/80">{error || "Couldn't load this trip."}</p>
        </div>
      </div>
    );
  }

  const { trip, items, transport, hotels } = data;
  const local = trip.destination_id?.currency;
  const money = (bdt) => {
    const c = convert(bdt, local);
    return c ? `${formatBdt(bdt)} (≈ ${c.formatted})` : formatBdt(bdt);
  };

  const days = [...new Set(items.map((i) => i.day))].sort((a, b) => a - b);
  const itineraryTotal = items.reduce((sum, i) => sum + (i.est_cost || 0), 0);

  return (
    <div className="min-h-screen bg-paper py-8 px-4 print:p-0 print:bg-surface">
      {/* Toolbar — never printed */}
      <div className="no-print max-w-3xl mx-auto mb-5 flex flex-wrap items-center gap-3">
        <Link
          to="/itinerary"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface border border-sand rounded-xl text-sm font-medium text-ink-900/70 hover:border-teal/40"
        >
          <ArrowLeft className="w-4 h-4" /> Back to itinerary
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer className="w-4 h-4" /> Print or save as PDF
        </button>
        <p className="text-xs text-ink-900/55 basis-full sm:basis-auto">
          Choose “Save as PDF” in the print dialog to keep a copy offline.
        </p>
      </div>

      <article className="print-surface max-w-3xl mx-auto bg-surface border border-sand rounded-2xl shadow-soft p-8 print:border-0 print:rounded-none print:shadow-none print:p-0">
        {/* Masthead */}
        <header className="print-block flex items-start justify-between gap-4 pb-4 mb-5 border-b-2 border-ink-900">
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-ink-900 leading-tight">
              {trip.origin} → {trip.destination}
            </h1>
            <p className="text-sm text-ink-900/65 mt-0.5">
              {formatDate(trip.start_date)} – {formatDate(trip.end_date)} · {trip.duration_days} days ·{" "}
              {trip.travelers} {trip.travelers === 1 ? "traveller" : "travellers"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-ink-900">
            <Compass className="w-4 h-4" strokeWidth={1.75} />
            <span className="font-display text-sm">TourGenie AI</span>
          </div>
        </header>

        {/* Trip facts */}
        <section className="print-block mb-6">
          <dl>
            <Row label="Destination" value={`${trip.destination}${trip.destination_id?.country ? `, ${trip.destination_id.country}` : ""}`} />
            <Row label="Status" value={trip.status} />
            <Row label="Budget" value={money(trip.budget)} />
            {itineraryTotal > 0 && <Row label="Planned cost" value={money(itineraryTotal)} />}
            {trip.carbon?.total_kg > 0 && (
              <Row label="Carbon" value={`${trip.carbon.total_kg} kg CO₂ (${trip.carbon.per_person_kg} kg per person)`} />
            )}
          </dl>
        </section>

        {/* Reservations */}
        {(transport.length > 0 || hotels.length > 0) && (
          <section className="print-block mb-6">
            <h2 className="font-display text-lg text-ink-900 mb-2">Reservations</h2>
            <p className="text-[11px] text-ink-900/55 mb-3">
              Demonstration records — no payment was taken and nothing is reserved with any operator or property.
            </p>

            {transport.map((b) => (
              <div key={b._id} className="print-block mb-2 p-3 border border-sand rounded-lg">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-sm text-ink-900">
                    {b.journey?.operator || b.transport_id?.operator}
                  </span>
                  <span className="font-mono text-xs">{b.reference}</span>
                </div>
                <p className="text-xs text-ink-900/70 mt-1">
                  {b.journey?.from_city} → {b.journey?.to_city} · {b.journey?.depart_time}–{b.journey?.arrive_time}
                  {b.travel_date ? ` · ${formatDate(b.travel_date)}` : ""}
                </p>
                <p className="text-xs text-ink-900/60 mt-0.5">
                  {b.passengers.length} passenger{b.passengers.length > 1 ? "s" : ""} · seats {b.seats.join(", ")} ·{" "}
                  {money(b.total_fare)}
                </p>
              </div>
            ))}

            {hotels.map((b) => (
              <div key={b._id} className="print-block mb-2 p-3 border border-sand rounded-lg">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-sm text-ink-900">{b.property?.name}</span>
                  <span className="font-mono text-xs">{b.reference}</span>
                </div>
                <p className="text-xs text-ink-900/70 mt-1">
                  {b.rooms} × {b.room_type} · {formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.nights} nights
                </p>
                <p className="text-xs text-ink-900/60 mt-0.5">
                  Check-in {b.property?.checkin_time}, check-out {b.property?.checkout_time} · {money(b.total_amount)}
                </p>
                {b.property?.address && <p className="text-xs text-ink-900/55 mt-0.5">{b.property.address}</p>}
                {b.property?.phone && <p className="text-xs text-ink-900/55">{b.property.phone}</p>}
              </div>
            ))}
          </section>
        )}

        {/* Day by day */}
        <section>
          <h2 className="font-display text-lg text-ink-900 mb-3">Day by day</h2>
          {days.length === 0 ? (
            <p className="text-sm text-ink-900/55">No itinerary has been generated for this trip yet.</p>
          ) : (
            days.map((day) => {
              const dayItems = items.filter((i) => i.day === day).sort((a, b) => a.time.localeCompare(b.time));
              const dayCost = dayItems.reduce((sum, i) => sum + (i.est_cost || 0), 0);
              const theme = dayItems.find((i) => i.day_theme)?.day_theme;

              return (
                <div key={day} className="print-block mb-5">
                  <div className="flex items-baseline justify-between gap-3 pb-1 mb-2 border-b border-ink-900/25">
                    <h3 className="font-display text-base text-ink-900">
                      Day {day}
                      {dayItems[0]?.date && (
                        <span className="ml-2 text-xs font-body text-ink-900/60">{formatDate(dayItems[0].date)}</span>
                      )}
                      {theme && <span className="ml-2 text-xs font-body text-ink-900/55">· {theme}</span>}
                    </h3>
                    {dayCost > 0 && <span className="text-xs font-mono text-ink-900/65">{formatBdt(dayCost)}</span>}
                  </div>

                  <ul>
                    {dayItems.map((item) => (
                      <li key={item._id} className="flex gap-3 py-1.5 border-b border-sand/60 last:border-0">
                        <span className="w-12 shrink-0 font-mono text-xs text-ink-900/70 pt-0.5">{item.time}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink-900 leading-snug">{item.activity}</span>
                          {(item.location || item.city) && (
                            <span className="block text-xs text-ink-900/55">
                              {[item.location, item.city].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </span>
                        <span className="w-20 shrink-0 text-right font-mono text-xs text-ink-900/65 pt-0.5">
                          {item.est_cost > 0 ? formatBdt(item.est_cost) : "Free"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>

        {/* Budget */}
        {trip.budget_breakdown?.length > 0 && (
          <section className="print-block mt-6 pt-4 border-t border-ink-900/25">
            <h2 className="font-display text-lg text-ink-900 mb-2">Estimated budget</h2>
            <dl>
              {trip.budget_breakdown.map((line) => (
                <div key={line.category} className="flex justify-between gap-3 py-1 border-b border-sand/60 last:border-0">
                  <dt className="text-sm text-ink-900/70">{line.label}</dt>
                  <dd className="text-sm font-mono text-ink-900">{formatBdt(line.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-2 mt-1 border-t border-ink-900/25">
                <dt className="text-sm font-semibold text-ink-900">Total</dt>
                <dd className="text-sm font-mono font-semibold text-ink-900">{money(trip.estimated_total)}</dd>
              </div>
            </dl>
          </section>
        )}

        <footer className="print-block mt-6 pt-3 border-t border-sand text-[10px] text-ink-900/50 flex flex-wrap justify-between gap-2">
          <span>Printed {formatDate(new Date())} · TourGenie AI</span>
          <span>Costs are estimates in BDT. Bookings shown are demonstration records.</span>
        </footer>
      </article>
    </div>
  );
}
