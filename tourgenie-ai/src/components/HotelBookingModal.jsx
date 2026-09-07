import { useEffect, useState } from "react";
import Overlay from "./ui/Overlay";
import { X, BedDouble, Users, CalendarRange, Loader2, Check, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { hotelBookingApi, notificationApi } from "../lib/api";
import Money from "./Money";

// FR-08 for accommodation. Demonstration only — the disclaimer appears
// before you book and again on the confirmation, because a reservation
// screen that looks real and isn't is the one thing here that could
// actually mislead someone.

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
}

export default function HotelBookingModal({ hotel, trip, localCurrency, onClose, onBooked }) {
  const [checkIn, setCheckIn] = useState(() => String(trip?.start_date || "").slice(0, 10));
  const [checkOut, setCheckOut] = useState(() => String(trip?.end_date || "").slice(0, 10));
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomType, setRoomType] = useState("");
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(() =>
    Array.from({ length: Math.max(1, trip?.travelers || 1) }, () => ({ name: "" }))
  );
  const [requests, setRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const nights = nightsBetween(checkIn, checkOut);

  useEffect(() => {
    if (!checkIn || !checkOut || nights < 1) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    hotelBookingApi
      .availability(hotel._id, checkIn, checkOut)
      .then((res) => {
        if (cancelled) return;
        setAvailability(res);
        // Default to the first room type with anything left.
        const firstFree = res.rooms.find((r) => r.rooms_available > 0) || res.rooms[0];
        setRoomType((prev) => (res.rooms.some((r) => r.name === prev) ? prev : firstFree?.name || ""));
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hotel._id, checkIn, checkOut, nights]);

  const room = availability?.rooms.find((r) => r.name === roomType) || null;
  const capacity = (room?.capacity || 2) * rooms;
  const total = room ? room.price_per_night * nights * rooms : 0;
  const namedGuests = guests.filter((g) => g.name.trim());
  const canBook =
    room && nights >= 1 && namedGuests.length > 0 && namedGuests.length <= capacity && rooms <= room.rooms_available && !submitting;

  async function book() {
    if (!canBook) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await hotelBookingApi.create({
        trip_id: trip._id,
        hotel_id: hotel._id,
        room_type: roomType,
        rooms,
        check_in: checkIn,
        check_out: checkOut,
        guests: namedGuests.map((g) => ({ name: g.name.trim() })),
        special_requests: requests.trim(),
      });
      setConfirmation(res);
      onBooked?.(res.booking);
      // The booking_confirmed rule can fire the moment this lands, and the
      // badge poll is on a ten-minute server cooldown. Forcing the sweep is
      // what that endpoint exists for; nothing here waits on it.
      notificationApi.refresh().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Overlay open onClose={onClose} variant="adaptive" size="lg" label={hotel.name}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 bg-paper/95 backdrop-blur border-b border-sand">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-ink-900 truncate">{hotel.name}</h2>
            <p className="text-xs text-ink-900/60 truncate">
              {hotel.area ? `${hotel.area}, ` : ""}{hotel.city}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-ink-900/40 hover:text-ink-900 hover:bg-surface"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {confirmation ? (
          <div className="p-5">
            <div className="flex items-start gap-3 p-4 bg-teal-light border border-teal/40 rounded-xl">
              <CircleCheck className="w-6 h-6 text-teal-dark shrink-0" />
              <div className="min-w-0">
                <h3 className="font-display text-base text-ink-900">Reservation confirmed</h3>
                <p className="text-sm text-ink-900/70 mt-1">{confirmation.message}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-900/60">Reference</dt>
                <dd className="font-mono font-bold text-ink-900">{confirmation.booking.reference}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-900/60">Room</dt>
                <dd className="text-ink-900 text-right">
                  {confirmation.booking.rooms} × {confirmation.booking.room_type}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-900/60">Stay</dt>
                <dd className="text-ink-900 text-right">
                  {String(confirmation.booking.check_in).slice(0, 10)} → {String(confirmation.booking.check_out).slice(0, 10)}
                  <span className="text-ink-900/50"> · {confirmation.booking.nights} nights</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3 pt-2 border-t border-sand">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="font-semibold text-ink-900">
                  <Money bdt={confirmation.booking.total_amount} local={localCurrency} />
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-2xs text-ink-900/55 leading-relaxed">
              Check-in from {confirmation.booking.property.checkin_time}, check-out by{" "}
              {confirmation.booking.property.checkout_time}.
              {confirmation.booking.property.cancellation_policy
                ? ` ${confirmation.booking.property.cancellation_policy}`
                : ""}
            </p>

            <button onClick={onClose} className="btn-primary w-full mt-5">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2.5 p-3 bg-gold/10 border border-gold/40 rounded-xl">
              <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <p className="text-xs text-ink-900/75 leading-relaxed">
                Demonstration reservation — no payment is taken and nothing is reserved with the property.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-sunset-light border border-sunset/30 rounded-xl">
                <TriangleAlert className="w-4 h-4 text-sunset-dark shrink-0 mt-0.5" />
                <p className="text-xs text-ink-900/80">{error}</p>
              </div>
            )}

            {/* Dates */}
            <div>
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-900/45 mb-1.5">
                <CalendarRange className="w-3 h-3" /> Stay
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-2xs text-ink-900/55 mb-1">Check in</span>
                  <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input" />
                </label>
                <label className="block">
                  <span className="block text-2xs text-ink-900/55 mb-1">Check out</span>
                  <input type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} className="input" />
                </label>
              </div>
              {nights < 1 && <p className="mt-1 text-2xs text-sunset-dark">Check-out has to be after check-in.</p>}
            </div>

            {/* Rooms */}
            <div>
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-900/45 mb-1.5">
                <BedDouble className="w-3 h-3" /> Room
              </p>
              {loading ? (
                <p className="flex items-center gap-2 text-xs text-ink-900/55 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…
                </p>
              ) : !availability?.rooms.length ? (
                <p className="text-xs text-ink-900/55">No rooms listed for this property.</p>
              ) : (
                <div className="space-y-1.5">
                  {availability.rooms.map((r) => {
                    const soldOut = r.rooms_available < 1;
                    return (
                      <button
                        key={r.name}
                        onClick={() => !soldOut && setRoomType(r.name)}
                        disabled={soldOut}
                        className={`w-full p-3 rounded-xl border text-left transition ${
                          soldOut
                            ? "bg-sand/30 border-sand text-ink-900/35 cursor-not-allowed"
                            : r.name === roomType
                              ? "bg-surface border-teal ring-1 ring-teal/20"
                              : "bg-surface/70 border-sand hover:border-teal/40"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-sm">{r.name}</span>
                          <span className="font-mono text-sm shrink-0">
                            <Money bdt={r.price_per_night} local={localCurrency} localClassName="text-xs" />
                          </span>
                        </div>
                        <p className="text-2xs text-ink-900/55 mt-0.5">
                          Sleeps {r.capacity}
                          {r.beds ? ` · ${r.beds}` : ""}
                          {r.breakfast_included ? " · breakfast included" : ""}
                          {" · "}
                          {soldOut ? "sold out for these dates" : `${r.rooms_available} left`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* How many rooms */}
            {room && (
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-900/70">Number of rooms</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, room.rooms_available)}
                  value={rooms}
                  onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))}
                  className="input w-20 text-center"
                />
              </label>
            )}

            {/* Guests */}
            <div>
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-900/45 mb-1.5">
                <Users className="w-3 h-3" /> Guests
                {room && <span className="font-normal normal-case tracking-normal text-ink-900/40">· sleeps {capacity}</span>}
              </p>
              <div className="space-y-1.5">
                {guests.map((g, i) => (
                  <input
                    key={i}
                    value={g.name}
                    onChange={(e) =>
                      setGuests((prev) => prev.map((p, j) => (j === i ? { name: e.target.value } : p)))
                    }
                    placeholder={i === 0 ? "Lead guest — full name" : `Guest ${i + 1}`}
                    className="input"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <button
                  onClick={() => setGuests((p) => [...p, { name: "" }])}
                  className="text-xs text-ink-900/50 hover:text-teal-dark"
                >
                  + Add guest
                </button>
                {namedGuests.length > capacity && (
                  <span className="text-2xs text-sunset-dark">
                    {namedGuests.length} guests need more than {rooms} room{rooms > 1 ? "s" : ""}.
                  </span>
                )}
              </div>
            </div>

            <label className="block">
              <span className="block text-2xs font-semibold uppercase tracking-wide text-ink-900/45 mb-1.5">
                Special requests
              </span>
              <textarea
                value={requests}
                onChange={(e) => setRequests(e.target.value.slice(0, 400))}
                rows={2}
                placeholder="High floor, late arrival, extra bed…"
                className="input resize-none"
              />
            </label>

            {/* Total */}
            {room && nights >= 1 && (
              <div className="p-3 bg-surface border border-sand rounded-xl space-y-1 text-sm">
                <div className="flex justify-between text-ink-900/65">
                  <span>
                    ৳{room.price_per_night.toLocaleString()} × {nights} night{nights > 1 ? "s" : ""} × {rooms} room{rooms > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-ink-900 pt-1.5 border-t border-sand">
                  <span>Total</span>
                  <Money bdt={total} local={localCurrency} />
                </div>
              </div>
            )}

            <button onClick={book} disabled={!canBook} className="btn-primary w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Reservation (Demo)
            </button>
          </div>
        )}
    </Overlay>
  );
}
