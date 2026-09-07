import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bus, Train, Ship, Clock, Wallet, Users, Ticket, TriangleAlert, Loader2, Check,
  ArrowRight, X, Info, CircleCheck, Armchair,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { PanelSkeleton } from "../components/Skeleton";
import { tripsApi, transportApi, bookingApi, notificationApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useLanguage } from "../context/LanguageContext";

// FR-08 — Mock Ticket Booking (wireframe §3.9).
//
// Demonstration only. The screen is deliberately explicit about that at the
// top and again on the confirmation, because a booking screen that looks
// real and isn't is the one thing here that could actually mislead someone.

const MODE_ICON = { bus: Bus, train: Train, launch: Ship };

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// "2-2" → an aisle after seat 2 in each row. Drawing the gap is what makes
// a grid of buttons read as a coach rather than a spreadsheet.
function aisleAfter(layout) {
  const parts = String(layout || "2-2").split("-").map(Number);
  return Number.isFinite(parts[0]) ? parts[0] : 2;
}

export default function Booking() {
  const { currentTripId } = useCurrentTrip();
  const { t } = useLanguage();

  const [trip, setTrip] = useState(null);
  const [options, setOptions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [chosenSeats, setChosenSeats] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const selected = options.find((o) => o._id === selectedId) || null;
  const travelDate = trip?.start_date ? String(trip.start_date).slice(0, 10) : "";

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    tripsApi
      .get(currentTripId)
      .then(async ({ trip: loaded }) => {
        if (cancelled) return;
        setTrip(loaded);
        setPassengers(
          Array.from({ length: loaded.travelers || 1 }, (_, i) => ({
            name: i === 0 ? "" : "",
            age: "",
            gender: "",
          }))
        );

        const [{ options: found }, { bookings: existing }] = await Promise.all([
          transportApi.list({ from: loaded.origin, to: loaded.destination }),
          bookingApi.forTrip(currentTripId),
        ]);
        if (cancelled) return;
        setOptions(found || []);
        setBookings(existing || []);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [currentTripId]);

  // Seat map for whichever departure is selected.
  useEffect(() => {
    if (!selectedId) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setSeatsLoading(true);
    setChosenSeats([]);
    bookingApi
      .availability(selectedId, travelDate)
      .then((res) => !cancelled && setAvailability(res))
      .catch(() => !cancelled && setAvailability(null))
      .finally(() => !cancelled && setSeatsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedId, travelDate]);

  const rows = useMemo(() => {
    if (!availability) return [];
    const grouped = new Map();
    for (const seat of availability.seats) {
      if (!grouped.has(seat.row)) grouped.set(seat.row, []);
      grouped.get(seat.row).push(seat);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]).map(([, seats]) => seats);
  }, [availability]);

  function toggleSeat(label, taken) {
    if (taken) return;
    setChosenSeats((prev) => {
      if (prev.includes(label)) return prev.filter((s) => s !== label);
      if (prev.length >= passengers.length) return prev; // one seat per passenger
      return [...prev, label];
    });
  }

  function updatePassenger(index, field, value) {
    setPassengers((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  const namesFilled = passengers.every((p) => p.name.trim().length > 0);
  const seatsOk = chosenSeats.length === 0 || chosenSeats.length === passengers.length;
  const canConfirm = selected && namesFilled && seatsOk && !submitting;

  async function confirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError("");
    try {
      const { booking, message } = await bookingApi.create({
        trip_id: currentTripId,
        transport_id: selected._id,
        travel_date: travelDate,
        ...(chosenSeats.length ? { seats: chosenSeats } : {}),
        passenger_details: passengers.map((p, i) => ({
          name: p.name.trim(),
          age: p.age ? Number(p.age) : null,
          gender: p.gender || "",
          ...(chosenSeats[i] ? { seat: chosenSeats[i] } : {}),
        })),
      });
      setConfirmation({ booking, message });
      setBookings((prev) => [booking, ...prev]);
      // Let the booking_confirmed rule fire now rather than on the badge's
      // next long-cooldown poll.
      notificationApi.refresh().catch(() => {});
      setSelectedId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(bookingId) {
    try {
      const { booking } = await bookingApi.cancel(currentTripId, bookingId);
      setBookings((prev) => prev.map((b) => (b._id === booking._id ? { ...b, ...booking } : b)));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!currentTripId) {
    return (
      <AppShell title={t("booking.title", "Ticket Booking")}>
        <div className="max-w-md p-6 bg-surface border border-sand rounded-2xl shadow-soft">
          <p className="text-sm text-ink-900/70">Open a trip first — bookings are made against a trip.</p>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-teal-dark hover:underline">
            Go to my trips <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("booking.title", "Ticket Booking")}
      subtitle={trip ? `${trip.origin} → ${trip.destination} · ${travelDate}` : undefined}
    >
      {/* The disclaimer the wireframe puts at the top of this page. */}
      <div className="flex items-start gap-3 p-4 mb-6 bg-gold/10 border border-gold/40 rounded-xl max-w-3xl">
        <Info className="w-5 h-5 text-gold shrink-0 mt-0.5" />
        <p className="text-sm text-ink-900/75 leading-relaxed">
          {t(
            "booking.demo_notice",
            "Demonstration booking only — no payment is taken and no real ticket is issued."
          )}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-sunset-light border border-sunset/30 rounded-xl max-w-3xl">
          <TriangleAlert className="w-5 h-5 text-sunset-dark shrink-0 mt-0.5" />
          <p className="text-sm text-ink-900/80">{error}</p>
        </div>
      )}

      {confirmation && (
        <div className="p-5 mb-6 bg-teal-light border border-teal/40 rounded-2xl max-w-3xl animate-pop-in">
          <div className="flex items-start gap-3">
            <CircleCheck className="w-6 h-6 text-teal-dark shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg text-ink-900">Booking confirmed</h2>
              <p className="text-sm text-ink-900/70 mt-1">{confirmation.message}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
                <span>
                  <span className="text-ink-900/50">{t("booking.reference", "Booking reference")}: </span>
                  <span className="font-mono font-bold text-ink-900">{confirmation.booking.reference}</span>
                </span>
                <span>
                  <span className="text-ink-900/50">{t("booking.seat", "Seat")}: </span>
                  <span className="font-mono text-ink-900">{confirmation.booking.seats.join(", ")}</span>
                </span>
                <span>
                  <span className="text-ink-900/50">{t("common.total", "Total")}: </span>
                  <span className="font-semibold text-ink-900">৳{confirmation.booking.total_fare.toLocaleString()}</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => setConfirmation(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-900/30 hover:text-ink-900/60 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <PanelSkeleton lines={6} />
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Available departures */}
          <section>
            <h2 className="font-display text-lg text-ink-900 mb-3">Available departures</h2>
            {options.length === 0 ? (
              <p className="text-sm text-ink-900/55 p-4 bg-surface border border-sand rounded-xl">
                No transport is recorded between {trip?.origin} and {trip?.destination} yet. An admin can add
                services from the Transport console.
              </p>
            ) : (
              <div className="space-y-2">
                {options.map((o) => {
                  const Icon = MODE_ICON[o.mode] || Bus;
                  const isSelected = o._id === selectedId;
                  return (
                    <button
                      key={o._id}
                      onClick={() => setSelectedId(isSelected ? null : o._id)}
                      className={`w-full p-4 rounded-xl border text-left transition ${
                        isSelected
                          ? "bg-surface border-teal shadow-soft ring-1 ring-teal/20"
                          : "bg-surface/70 border-sand hover:border-teal/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-9 h-9 rounded-lg bg-teal-light flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-teal-dark" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-semibold text-ink-900">{o.operator}</span>
                            {o.service_class && (
                              <span className="text-2xs text-ink-900/50">{o.service_class}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-900/65">
                            <span className="font-mono">
                              {o.depart_time} → {o.arrive_time}
                              {o.arrives_next_day && <span className="text-sunset-dark"> +1</span>}
                            </span>
                            {o.duration_min && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {formatDuration(o.duration_min)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Armchair className="w-3 h-3" /> {o.seats_available}/{o.total_seats}
                            </span>
                          </div>
                          {o.boarding_point && (
                            <p className="text-2xs text-ink-900/45 mt-1">From {o.boarding_point}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display text-lg text-ink-900">৳{o.fare.toLocaleString()}</p>
                          <p className="text-3xs text-ink-900/45">per passenger</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Seat map for the selected departure */}
            {selected && (
              <div className="mt-5 p-4 bg-surface border border-sand rounded-2xl">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-display text-base text-ink-900">Choose seats</h3>
                  <span className="text-xs text-ink-900/50">
                    {chosenSeats.length}/{passengers.length} picked
                    {chosenSeats.length === 0 && " · auto-assign if left blank"}
                  </span>
                </div>

                {seatsLoading ? (
                  <p className="flex items-center gap-2 text-xs text-ink-900/50">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading seat map…
                  </p>
                ) : rows.length === 0 ? (
                  <p className="text-xs text-ink-900/50">No seat map available for this service.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                      {rows.map((seats, i) => {
                        const gap = aisleAfter(availability.layout);
                        return (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="w-5 text-3xs font-mono text-ink-900/30 shrink-0">{i + 1}</span>
                            {seats.map((seat, j) => (
                              <span key={seat.label} className="flex items-center">
                                <button
                                  onClick={() => toggleSeat(seat.label, seat.taken)}
                                  disabled={seat.taken}
                                  title={seat.taken ? "Already booked" : seat.label}
                                  className={`w-9 h-8 rounded-md text-3xs font-mono transition-colors ${
                                    seat.taken
                                      ? "bg-sand/60 text-ink-900/25 cursor-not-allowed line-through"
                                      : chosenSeats.includes(seat.label)
                                        ? "bg-teal text-white font-bold"
                                        : "bg-paper border border-sand text-ink-900/60 hover:border-teal/50"
                                  }`}
                                >
                                  {seat.label}
                                </button>
                                {j + 1 === gap && <span className="w-4" />}
                              </span>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-3xs text-ink-900/45">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-paper border border-sand" /> Free</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal" /> Yours</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sand/60" /> Taken</span>
                      <span className="ml-auto">{availability.available_count} of {availability.seats.length} free</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Existing bookings */}
            {bookings.length > 0 && (
              <section className="mt-6">
                <h2 className="font-display text-lg text-ink-900 mb-3">Your bookings for this trip</h2>
                <div className="space-y-2">
                  {bookings.map((b) => (
                    <div
                      key={b._id}
                      className={`p-4 rounded-xl border ${
                        b.status === "cancelled" ? "bg-paper border-sand opacity-60" : "bg-surface border-sand"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Ticket className="w-4 h-4 text-teal-dark shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-mono font-bold text-sm text-ink-900">{b.reference || "—"}</span>
                            <span
                              className={`text-3xs px-2 py-0.5 rounded-full font-semibold ${
                                b.status === "cancelled"
                                  ? "bg-sand text-ink-900/50"
                                  : "bg-teal-light text-teal-dark"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <p className="text-xs text-ink-900/65 mt-1">
                            {b.journey?.operator || b.transport_id?.operator} ·{" "}
                            {b.journey?.from_city || b.transport_id?.from_city} →{" "}
                            {b.journey?.to_city || b.transport_id?.to_city} ·{" "}
                            {b.journey?.depart_time || b.transport_id?.depart_time}
                          </p>
                          <p className="text-2xs text-ink-900/45 mt-0.5">
                            {b.passengers.length} passenger{b.passengers.length > 1 ? "s" : ""} · seats{" "}
                            {b.seats.join(", ")} · ৳{b.total_fare.toLocaleString()}
                          </p>
                        </div>
                        {b.status !== "cancelled" && (
                          <button
                            onClick={() => cancel(b._id)}
                            className="text-xs text-ink-900/45 hover:text-sunset-dark underline shrink-0"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>

          {/* Passenger panel */}
          <aside className="p-4 bg-surface border border-sand rounded-2xl shadow-soft lg:sticky lg:top-6">
            <h2 className="flex items-center gap-2 font-display text-base text-ink-900 mb-3">
              <Users className="w-4 h-4 text-teal-dark" />
              {t("booking.passenger_details", "Passenger details")}
            </h2>

            <div className="space-y-3">
              {passengers.map((p, i) => (
                <div key={i} className="p-3 bg-paper border border-sand rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-ink-900/40">
                      Passenger {i + 1}
                    </span>
                    {chosenSeats[i] && (
                      <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-teal-light text-teal-dark">
                        {chosenSeats[i]}
                      </span>
                    )}
                  </div>
                  <input
                    value={p.name}
                    onChange={(e) => updatePassenger(i, "name", e.target.value)}
                    placeholder="Full name"
                    className="w-full px-2.5 py-1.5 mb-1.5 bg-surface border border-sand rounded-lg text-sm text-ink-900 placeholder:text-ink-900/30 focus:outline-none focus:border-teal/50"
                  />
                  <div className="flex gap-1.5">
                    <input
                      value={p.age}
                      onChange={(e) => updatePassenger(i, "age", e.target.value.replace(/\D/g, "").slice(0, 3))}
                      placeholder="Age"
                      inputMode="numeric"
                      className="w-20 px-2.5 py-1.5 bg-surface border border-sand rounded-lg text-sm text-ink-900 placeholder:text-ink-900/30 focus:outline-none focus:border-teal/50"
                    />
                    <select
                      value={p.gender}
                      onChange={(e) => updatePassenger(i, "gender", e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-surface border border-sand rounded-lg text-sm text-ink-900 focus:outline-none focus:border-teal/50"
                    >
                      <option value="">Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPassengers((prev) => [...prev, { name: "", age: "", gender: "" }])}
              className="w-full mt-2 py-1.5 text-xs text-ink-900/50 hover:text-teal-dark"
            >
              + Add another passenger
            </button>

            {/* Fare summary */}
            {selected && (
              <div className="mt-4 pt-4 border-t border-sand space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-900/65">
                  <span>
                    {t("booking.fare", "Fare")} × {passengers.length}
                  </span>
                  <span className="font-mono">৳{(selected.fare * passengers.length).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-ink-900 pt-1.5 border-t border-sand">
                  <span>{t("common.total", "Total")}</span>
                  <span className="font-mono">৳{(selected.fare * passengers.length).toLocaleString()}</span>
                </div>
              </div>
            )}

            <button
              onClick={confirm}
              disabled={!canConfirm}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-sunset text-white hover:bg-sunset-dark disabled:bg-sand disabled:text-ink-fixed/35 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t("booking.confirm", "Confirm Booking (Demo)")}
            </button>

            {!selected && (
              <p className="mt-2 text-2xs text-ink-900/45 text-center">Pick a departure first.</p>
            )}
            {selected && !namesFilled && (
              <p className="mt-2 text-2xs text-ink-900/45 text-center">Every passenger needs a name.</p>
            )}
            {selected && namesFilled && !seatsOk && (
              <p className="mt-2 text-2xs text-sunset-dark text-center">
                Pick one seat per passenger, or none to auto-assign.
              </p>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}
