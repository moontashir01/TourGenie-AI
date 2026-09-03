import { useEffect, useState } from "react";
import { Sparkles, Plane, Building2, Wallet, CalendarRange } from "lucide-react";
import { adminApi } from "../../lib/api";
import Drawer, { DrawerSection, Field } from "./Drawer";
import AdminNotes from "./AdminNotes";
import { ErrorBanner } from "./ListShell";
import { StatusPill } from "./UserDetail";

const money = (n) => `৳${Math.round(n || 0).toLocaleString()}`;
const date = (d) => (d ? new Date(d).toLocaleDateString() : "—");

// Where a plan came from. When a traveller reports a bad itinerary this is
// the first question, and the answer was previously only in the database.
function Provenance({ provenance }) {
  const { itinerary_source: source, item_sources: items, flight } = provenance;
  const generated = provenance.itinerary_generated_at;

  return (
    <div className="bg-surface border border-sand rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="w-4 h-4 text-teal-dark shrink-0" />
        <span className="text-ink-900/70">Itinerary built by</span>
        <span className="font-semibold text-ink-900 capitalize">{source}</span>
        {generated && <span className="text-xs text-ink-900/45 ml-auto">{new Date(generated).toLocaleString()}</span>}
      </div>

      {Object.keys(items).length > 0 && (
        <p className="text-xs text-ink-900/55">
          Items:{" "}
          {Object.entries(items)
            .map(([kind, count]) => `${count} ${kind}`)
            .join(", ")}
        </p>
      )}

      {flight && (
        <div className="flex items-center gap-2 text-xs text-ink-900/60 pt-2 border-t border-sand">
          <Plane className="w-3.5 h-3.5 shrink-0" />
          <span>
            {flight.airline} · {money(flight.price)}
          </span>
          {/* A seeded schedule and a live fare look identical on the
              traveller's page; the difference matters when a price is
              disputed. */}
          <span
            className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              flight.is_real ? "bg-teal-light text-teal-dark" : "bg-gold/20 text-ink-800"
            }`}
          >
            {flight.is_real ? "live fare" : "seeded fare"}
            {flight.source ? ` · ${flight.source}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default function TripDetail({ tripId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    setData(null);
    adminApi
      .tripDetail(tripId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  const trip = data?.trip;
  const days = data ? [...new Set(data.items.map((i) => i.day))].sort((a, b) => a - b) : [];

  return (
    <Drawer
      open={Boolean(tripId)}
      title={trip ? `${trip.origin} → ${trip.destination}` : "Trip"}
      subtitle={trip?.user_id ? `${trip.user_id.name} · ${trip.user_id.email}` : "owner no longer exists"}
      loading={loading}
      onClose={onClose}
    >
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {data && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
            <Field label="Status">
              <span className="capitalize">{trip.status}</span>
            </Field>
            <Field label="Dates">
              {date(trip.start_date)} – {date(trip.end_date)}
            </Field>
            <Field label="Travellers">{trip.travelers}</Field>
            <Field label="Budget">{money(data.totals.budget)}</Field>
            <Field label="Logged">{money(data.totals.logged)}</Field>
            <Field label="Estimated">
              <span className={data.totals.over_budget ? "text-sunset-dark font-semibold" : ""}>
                {money(data.totals.estimated)}
              </span>
            </Field>
          </dl>

          {data.totals.over_budget && (
            <p className="flex items-center gap-2 text-xs text-sunset-dark bg-sunset/10 border border-sunset/30 rounded-lg px-3 py-2 mb-5">
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              Planned and logged costs exceed the budget this traveller set.
            </p>
          )}

          <DrawerSection title="Provenance">
            <Provenance provenance={data.provenance} />
          </DrawerSection>

          <DrawerSection title="Itinerary" count={data.items.length} empty="No itinerary generated yet.">
            <div className="space-y-3">
              {days.map((day) => (
                <div key={day}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-900/60 mb-1">
                    <CalendarRange className="w-3.5 h-3.5" /> Day {day}
                  </p>
                  <ul className="space-y-1 pl-5">
                    {data.items
                      .filter((i) => i.day === day)
                      .map((i) => (
                        <li key={i._id} className="flex items-baseline gap-2 text-xs">
                          <span className="font-mono text-ink-900/40 w-11 shrink-0">{i.time}</span>
                          <span className="text-ink-900/80 flex-1 min-w-0 truncate">{i.activity}</span>
                          {i.est_cost > 0 && (
                            <span className="font-mono text-ink-900/45 shrink-0">{money(i.est_cost)}</span>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection
            title="Stay"
            count={(trip.hotel_id ? 1 : 0) + (trip.hotel_selections?.length || 0)}
            empty="No hotel chosen."
          >
            <ul className="space-y-1.5">
              {trip.hotel_id && (
                <li className="flex items-center gap-2 text-sm">
                  <Building2 className="w-3.5 h-3.5 text-teal-dark" />
                  <span className="text-ink-900/80">{trip.hotel_id.name}</span>
                  <span className="text-xs text-ink-900/45">{trip.hotel_id.city}</span>
                  <span className="font-mono text-xs text-ink-900/50 ml-auto">
                    {money(trip.hotel_id.price_per_night)}/night
                  </span>
                </li>
              )}
              {(trip.hotel_selections || []).map((s, i) => (
                <li key={s._id || i} className="flex items-center gap-2 text-sm">
                  <Building2 className="w-3.5 h-3.5 text-teal-dark" />
                  <span className="text-ink-900/80">{s.hotel_id?.name || "—"}</span>
                  <span className="text-xs text-ink-900/45">{s.city}</span>
                </li>
              ))}
            </ul>
          </DrawerSection>

          <DrawerSection
            title="Bookings"
            count={data.bookings.length + data.hotel_bookings.length}
            empty="Nothing booked for this trip."
          >
            <ul className="space-y-2">
              {data.bookings.map((b) => (
                <li key={b._id} className="flex items-center gap-3 text-xs bg-surface border border-sand rounded-xl px-3 py-2.5">
                  <span className="font-mono text-ink-900">{b.reference}</span>
                  <span className="text-ink-900/60 flex-1 min-w-0 truncate">
                    {b.journey?.operator} · {(b.seats || []).join(", ")}
                  </span>
                  <span className="font-mono text-ink-900/50">{money(b.total_fare)}</span>
                  <StatusPill status={b.status} />
                </li>
              ))}
              {data.hotel_bookings.map((b) => (
                <li key={b._id} className="flex items-center gap-3 text-xs bg-surface border border-sand rounded-xl px-3 py-2.5">
                  <span className="font-mono text-ink-900">{b.reference}</span>
                  <span className="text-ink-900/60 flex-1 min-w-0 truncate">{b.property?.name}</span>
                  <span className="font-mono text-ink-900/50">{money(b.total_amount)}</span>
                  <StatusPill status={b.status} />
                </li>
              ))}
            </ul>
          </DrawerSection>

          <DrawerSection title="Logged expenses" count={data.expenses.length} empty="Nothing logged.">
            <ul className="space-y-1">
              {data.expenses.slice(0, 15).map((e) => (
                <li key={e._id} className="flex items-center gap-3 text-xs">
                  <span className="text-ink-900/40 w-20 shrink-0">{date(e.date)}</span>
                  <span className="text-ink-900/50 w-24 shrink-0 capitalize truncate">{e.category}</span>
                  <span className="text-ink-900/75 flex-1 min-w-0 truncate">{e.description}</span>
                  <span className="font-mono text-ink-900/60 shrink-0">{money(e.amount_bdt ?? e.amount)}</span>
                </li>
              ))}
            </ul>
          </DrawerSection>

          <AdminNotes targetType="trip" targetId={tripId} />
        </>
      )}
    </Drawer>
  );
}
