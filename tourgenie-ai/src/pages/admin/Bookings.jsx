import { useState } from "react";
import { XCircle, Loader2, Armchair } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, AdminSelect, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";
import { StatusPill } from "../../components/admin/UserDetail";
import Drawer from "../../components/admin/Drawer";

const money = (n) => `৳${Math.round(n || 0).toLocaleString()}`;
const date = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

// Cancelling for someone who cannot do it themselves is exactly the kind of
// action that has to say who did it and why.
function CancelPrompt({ target, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md card p-6 animate-pop-in">
        <h3 className="font-display text-lg text-ink-900 mb-1">Cancel {target.reference}?</h3>
        <p className="text-sm text-ink-900/60 mb-4">
          {target.kind === "transport"
            ? "The seats go back to the departure straight away, the same as if the traveller had cancelled it themselves."
            : "The room is released straight away, the same as if the traveller had cancelled it themselves."}
        </p>
        <label className="block mb-4">
          <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Reason (recorded in the activity log)</span>
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Traveller phoned in, duplicate booking…"
            className="input"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Keep it
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="inline-flex items-center justify-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-fixed font-semibold text-sm px-5 py-2.5 rounded-full transition-all disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Cancel booking
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Bookings() {
  const { user } = useAuth();
  const canCancel = ["admin", "owner"].includes(user?.role);

  const transport = useAdminList(adminApi.bookings, { status: "" });
  const hotels = useAdminList(adminApi.hotelBookings, { status: "" });

  const [prompt, setPrompt] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [seatMap, setSeatMap] = useState(null); // { label, held }
  const [loadingSeats, setLoadingSeats] = useState(false);

  async function confirmCancel(reason) {
    setBusyId(prompt.id);
    const list = prompt.kind === "transport" ? transport : hotels;
    try {
      if (prompt.kind === "transport") await adminApi.cancelBooking(prompt.id, reason);
      else await adminApi.cancelHotelBooking(prompt.id, reason);
      list.reload();
    } catch (err) {
      list.setError(err.message);
    } finally {
      setBusyId(null);
      setPrompt(null);
    }
  }

  // Who is sitting where on one departure — the question that comes up the
  // moment two people claim the same seat.
  async function openSeatMap(booking) {
    setLoadingSeats(true);
    setSeatMap({ label: `${booking.journey?.from_city} → ${booking.journey?.to_city}`, held: [] });
    try {
      const { held } = await adminApi.seatMap(booking.transport_id, booking.travel_date);
      setSeatMap({
        label: `${booking.journey?.operator || ""} · ${booking.journey?.from_city} → ${booking.journey?.to_city} · ${date(booking.travel_date)}`,
        held,
      });
    } catch (err) {
      transport.setError(err.message);
      setSeatMap(null);
    } finally {
      setLoadingSeats(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-4">Transport bookings</h3>
        <ErrorBanner message={transport.error} onDismiss={() => transport.setError("")} />

        <AdminToolbar list={transport} placeholder="Search reference, operator, city or passenger…">
          <AdminSelect
            label="Status"
            value={transport.filters.status}
            onChange={(v) => transport.setFilter("status", v)}
            options={STATUS_OPTIONS}
          />
        </AdminToolbar>

        <ListState list={transport} empty="No bookings match that." />

        {transport.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Traveller</th>
                  <th className="pb-3 font-medium">Journey</th>
                  <th className="pb-3 font-medium">Travel date</th>
                  <th className="pb-3 font-medium">Seats</th>
                  <th className="pb-3 font-medium">Fare</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {transport.rows.map((b) => (
                  <tr key={b._id} className={busyId === b._id ? "opacity-50" : ""}>
                    <td className="py-3 font-mono text-xs text-ink-900">{b.reference}</td>
                    <td className="py-3 text-ink-900/70 text-xs">
                      {b.user_id?.name || <span className="text-ink-900/35">no longer exists</span>}
                    </td>
                    <td className="py-3 text-ink-900/70 text-xs">
                      {b.journey?.from_city} → {b.journey?.to_city}
                      <span className="block text-ink-900/40">{b.journey?.operator}</span>
                    </td>
                    <td className="py-3 text-ink-900/50 text-xs whitespace-nowrap">{date(b.travel_date)}</td>
                    <td className="py-3 text-ink-900/60 text-xs">{(b.seats || []).join(", ") || "—"}</td>
                    <td className="py-3 font-mono text-ink-900/70 text-xs">{money(b.total_fare)}</td>
                    <td className="py-3">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => openSeatMap(b)}
                          title="Who holds which seat on this departure"
                          className="text-ink-900/40 hover:text-teal-dark"
                        >
                          <Armchair className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setPrompt({ kind: "transport", id: b._id, reference: b.reference })
                          }
                          disabled={!canCancel || b.status === "cancelled" || busyId === b._id}
                          title={canCancel ? "Cancel on the traveller's behalf" : "Admins only"}
                          className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-25"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={transport} />
      </section>

      <section className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-4">Hotel reservations</h3>
        <ErrorBanner message={hotels.error} onDismiss={() => hotels.setError("")} />

        <AdminToolbar list={hotels} placeholder="Search reference, hotel, city or room…">
          <AdminSelect
            label="Status"
            value={hotels.filters.status}
            onChange={(v) => hotels.setFilter("status", v)}
            options={STATUS_OPTIONS}
          />
        </AdminToolbar>

        <ListState list={hotels} empty="No reservations match that." />

        {hotels.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Guest</th>
                  <th className="pb-3 font-medium">Property</th>
                  <th className="pb-3 font-medium">Stay</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {hotels.rows.map((b) => (
                  <tr key={b._id} className={busyId === b._id ? "opacity-50" : ""}>
                    <td className="py-3 font-mono text-xs text-ink-900">{b.reference}</td>
                    <td className="py-3 text-ink-900/70 text-xs">
                      {b.user_id?.name || <span className="text-ink-900/35">no longer exists</span>}
                    </td>
                    <td className="py-3 text-ink-900/70 text-xs">
                      {b.property?.name}
                      <span className="block text-ink-900/40">{b.room_type}</span>
                    </td>
                    <td className="py-3 text-ink-900/50 text-xs whitespace-nowrap">
                      {date(b.check_in)} · {b.nights} night{b.nights === 1 ? "" : "s"}
                    </td>
                    <td className="py-3 font-mono text-ink-900/70 text-xs">{money(b.total_amount)}</td>
                    <td className="py-3">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setPrompt({ kind: "hotel", id: b._id, reference: b.reference })}
                          disabled={!canCancel || b.status === "cancelled" || busyId === b._id}
                          title={canCancel ? "Cancel on the traveller's behalf" : "Admins only"}
                          className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-25"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={hotels} />
      </section>

      {prompt && (
        <CancelPrompt
          target={prompt}
          busy={busyId === prompt.id}
          onCancel={() => setPrompt(null)}
          onConfirm={confirmCancel}
        />
      )}

      <Drawer
        open={Boolean(seatMap)}
        title="Seat map"
        subtitle={seatMap?.label}
        loading={loadingSeats}
        onClose={() => setSeatMap(null)}
      >
        {seatMap?.held?.length === 0 ? (
          <p className="text-sm text-ink-900/50">No seats held on this departure.</p>
        ) : (
          <ul className="space-y-1.5">
            {(seatMap?.held || []).map((h) => (
              <li key={`${h.reference}-${h.seat}`} className="flex items-center gap-3 text-sm bg-surface border border-sand rounded-xl px-3 py-2">
                <span className="font-mono font-semibold text-ink-900 w-12 shrink-0">{h.seat}</span>
                <span className="text-ink-900/75 flex-1 min-w-0 truncate">{h.passenger || "—"}</span>
                <span className="text-xs text-ink-900/45 shrink-0">{h.traveller}</span>
                <span className="font-mono text-xs text-ink-900/40 shrink-0">{h.reference}</span>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
