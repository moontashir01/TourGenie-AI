import { useEffect, useState } from "react";
import Button from "../components/ui/Button";
import { Link } from "react-router-dom";
import { MapPin, MessageCircleMore, Wallet, ChevronDown, Loader2, Plus, X, Sparkles, AlertCircle, Building2, Landmark, AlertTriangle, Compass, Phone, Printer, GripVertical, Undo2 } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter, pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import AppShell from "../components/AppShell";
import { NoTripState } from "../components/ui/States";
import DayMap from "../components/DayMap";
import FlightSearch from "../components/FlightSearch";
import WeatherBadge, { WeatherDetail } from "../components/WeatherBadge";
import GenerationProgress from "../components/GenerationProgress";
import RainyDayPlan from "../components/RainyDayPlan";
import Money from "../components/Money";
import Skeleton, { DayCardSkeleton, PanelSkeleton } from "../components/Skeleton";
import { tripsApi, itineraryApi, weatherApi, nearbyApi, notificationApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useChat } from "../context/ChatContext";

// FR-13 — "what's around me" for one itinerary day. Anchored on the day's
// first catalogued attraction, falling back to the city center.
const NEARBY_CATEGORIES = [
  ["restaurant", "Food"],
  ["cafe", "Cafés"],
  ["atm", "ATMs"],
  ["pharmacy", "Pharmacy"],
  ["hospital", "Hospital"],
  ["shopping", "Shops"],
];

function NearbySection({ dayItems, cityCoordinates, city }) {
  const [category, setCategory] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const exact = dayItems.find((i) => i.attraction_id?.lat_lng?.lat != null)?.attraction_id?.lat_lng;
  const anchor = exact || cityCoordinates?.[city] || null;

  function pick(cat) {
    if (cat === category) {
      setCategory(null);
      return;
    }
    setCategory(cat);
    setLoading(true);
    setError("");
    const query = anchor
      ? { lat: anchor.lat, lng: anchor.lng, category: cat, radius_km: 8, limit: 6 }
      : { city, category: cat, limit: 6 };
    nearbyApi
      .list(query)
      .then(({ services }) => setResults(services))
      .catch((err) => {
        setResults([]);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  if (!anchor && !city) return null;

  return (
    <div className="mt-5 pt-4 border-t border-sand">
      <p className="text-xs font-semibold tracking-wide uppercase text-ink-900/40 mb-2 flex items-center gap-1.5">
        <Compass className="w-3.5 h-3.5" /> Nearby{city ? ` in ${city}` : ""}
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {NEARBY_CATEGORIES.map(([cat, label]) => (
          <button
            key={cat}
            onClick={() => pick(cat)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              category === cat ? "bg-teal text-white border-teal" : "border-sand text-ink-900/60 hover:border-teal/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && (
        <p className="text-xs text-ink-900/40 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Searching nearby…
        </p>
      )}
      {error && <p className="text-xs text-sunset-dark">{error}</p>}
      {!loading && category && results.length === 0 && !error && (
        <p className="text-xs text-ink-900/40">Nothing catalogued in this category around here yet.</p>
      )}
      {!loading && results.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-2">
          {results.map((s) => (
            <li key={s._id} className="bg-paper border border-sand rounded-xl px-3 py-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink-900 leading-snug">{s.name}</p>
                {s.distance_m != null && (
                  <span className="font-mono text-teal-dark shrink-0">
                    {s.distance_m < 1000 ? `${s.distance_m}m` : `${(s.distance_m / 1000).toFixed(1)}km`}
                  </span>
                )}
              </div>
              <p className="text-ink-900/50 mt-0.5">
                {[s.subcategory, s.area].filter(Boolean).join(" · ") || s.category}
                {s.is_24h && <span className="text-teal-dark font-semibold"> · 24h</span>}
              </p>
              {s.phone && (
                <p className="text-ink-900/50 mt-0.5 inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {s.phone}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// --- Drag-and-drop reordering (time-slot swap) -----------------------------
//
// A day's time slots are treated as fixed and the activities move between
// them: drag the museum above lunch and it takes the 09:00 slot while lunch
// shifts to 12:00. That keeps `time` as the single source of order — the
// server sorts on it — so the list can never display 15:00 above 09:00.

/**
 * Enough zero-padded slots to seat `count` activities, reusing the day's
 * existing times first. A day that gains an item needs one more slot than it
 * had, so the extra is pushed two hours past the last one.
 */
function slotsFor(count, existingTimes) {
  const slots = [...new Set(existingTimes)].sort();

  while (slots.length < count) {
    const last = slots[slots.length - 1] || "07:00";
    const [h, m] = last.split(":").map(Number);
    let hh = Math.min(23, h + 2);
    let mm = m;
    let next = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    // Clamping at 23:00 can collide with a slot that already exists, and
    // duplicate times make the order ambiguous — nudge the minutes instead.
    while (slots.includes(next) && mm < 55) {
      mm += 5;
      next = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    if (slots.includes(next)) break; // give up rather than loop forever
    slots.push(next);
  }

  return slots.slice(0, count);
}

/** Re-times one day's activities into that day's slots, in their new order. */
function retimeDay(orderedItems, existingTimes) {
  const slots = slotsFor(orderedItems.length, existingTimes);
  return orderedItems.map((item, i) => ({ ...item, time: slots[i] || item.time }));
}

/**
 * Which drop target the cursor is over.
 *
 * closestCenter measures the dragged element's box rather than the pointer,
 * and the open day's card is many times taller than the collapsed ones — so
 * it consistently resolved one day too far down: aiming at Day 2's header
 * dropped the activity into Day 3. Going by the pointer fixes that, because
 * containment doesn't care how big the boxes are.
 *
 * A row inside the open day is preferred over the day card wrapping it, so
 * dropping between two activities sorts them instead of appending to the day.
 * Keyboard dragging reports no pointer, hence the closestCenter fallback.
 */
function collisionStrategy(args) {
  const hits = pointerWithin(args);
  if (hits.length > 0) {
    const row = hits.find((hit) => !String(hit.id).startsWith("day-"));
    return row ? [row] : hits;
  }
  return closestCenter(args);
}

function SortableRow({ id, children, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return children({
    ref: setNodeRef,
    style: {
      transform: CSS.Translate.toString(transform),
      transition,
      // The original stays in place as a ghost while DragOverlay renders the
      // travelling copy, so the list doesn't visually lose a row.
      opacity: isDragging ? 0.35 : 1,
    },
    handleProps: { ...attributes, ...listeners },
    isDragging,
  });
}

/** A collapsed day header doubles as a drop target for cross-day moves. */
function DayDropZone({ day, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}`, data: { day } });
  return (
    <div ref={setNodeRef} className={isOver ? "bg-teal-light/50 transition-colors" : "transition-colors"}>
      {children}
    </div>
  );
}

function isInternationalTrip(trip) {
  const originCountry = trip?.origin_destination_id?.country_code;
  const destinationCountry = trip?.multi_city ? trip.country_code : trip?.destination_id?.country_code;
  return Boolean(originCountry && destinationCountry && originCountry !== destinationCountry);
}

export default function Itinerary() {
  const { currentTripId } = useCurrentTrip();
  const { itineraryVersion } = useChat();
  const [trip, setTrip] = useState(null);
  const [items, setItems] = useState([]);
  const [cityCoordinates, setCityCoordinates] = useState({});
  const [weatherByDay, setWeatherByDay] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openDay, setOpenDay] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);
  const [reordering, setReordering] = useState(false);
  // Snapshot taken before an optimistic reorder so a failed save can roll the
  // list back instead of leaving the screen disagreeing with the database.
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  const sensors = useSensors(
    // A small activation distance keeps a tap on the transport buttons inside
    // a row from being swallowed as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function loadWeather(tripId) {
    weatherApi
      .trip(tripId)
      .then(({ days }) => setWeatherByDay(Object.fromEntries(days.map((d) => [d.day, d]))))
      .catch(() => setWeatherByDay({}));
  }

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    Promise.all([tripsApi.get(currentTripId), itineraryApi.get(currentTripId)])
      .then(([tripRes, itemsRes]) => {
        setTrip(tripRes.trip);
        setItems(itemsRes.items);
        setCityCoordinates(itemsRes.city_coordinates || {});
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    loadWeather(currentTripId);
  }, [currentTripId]);

  // An assistant edit replaces every itinerary row server-side — new ids and
  // all — so when the dock reports one, refetch rather than trying to merge.
  useEffect(() => {
    if (!itineraryVersion || !currentTripId) return;
    Promise.all([tripsApi.get(currentTripId), itineraryApi.get(currentTripId)])
      .then(([tripRes, itemsRes]) => {
        setTrip(tripRes.trip);
        setItems(itemsRes.items);
        setCityCoordinates(itemsRes.city_coordinates || {});
        setUndoSnapshot(null); // the pre-edit order no longer exists to restore
      })
      .catch((err) => setError(err.message));
    loadWeather(currentTripId);
  }, [itineraryVersion, currentTripId]);

  async function handleGenerateAI() {
    setError("");
    setGenerating(true);
    try {
      const { items: generated, city_coordinates } = await itineraryApi.generateAI(currentTripId);
      setItems(generated);
      setCityCoordinates(city_coordinates || {});
      setOpenDay(generated[0]?.day || 1);
      loadWeather(currentTripId); // the cities per day may have changed
      // A fresh plan sets itinerary_generated_at and changes which cities
      // the weather rules read, so both of those become answerable now.
      notificationApi.refresh().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  /**
   * Applies a drop: works out the affected days, re-times them, saves the
   * whole change in one request, and rolls back if that request fails.
   */
  async function handleDragEnd({ active, over }) {
    setActiveDragId(null);
    if (!over) return;

    const moved = items.find((i) => i._id === active.id);
    if (!moved) return;

    // Dropping on a day header targets that day; dropping on a row targets
    // whichever day that row belongs to.
    const overDayHeader = String(over.id).startsWith("day-");
    const targetDay = overDayHeader
      ? Number(String(over.id).slice(4))
      : items.find((i) => i._id === over.id)?.day;

    if (targetDay == null) return;
    if (over.id === active.id) return;

    const sourceDay = moved.day;
    const byDay = (d) => items.filter((i) => i.day === d).sort((a, b) => a.time.localeCompare(b.time));

    let touched = [];

    if (sourceDay === targetDay) {
      const list = byDay(sourceDay);
      const from = list.findIndex((i) => i._id === active.id);
      const to = list.findIndex((i) => i._id === over.id);
      if (from === -1 || to === -1 || from === to) return;

      const reordered = [...list];
      reordered.splice(to, 0, reordered.splice(from, 1)[0]);
      touched = retimeDay(reordered, list.map((i) => i.time));
    } else {
      // Cross-day move: the item leaves one day and is inserted into another.
      const source = byDay(sourceDay).filter((i) => i._id !== active.id);
      const target = byDay(targetDay);

      const insertAt = overDayHeader
        ? target.length // a header drop appends to the end of that day
        : Math.max(0, target.findIndex((i) => i._id === over.id));

      const nextTarget = [...target];
      nextTarget.splice(insertAt, 0, { ...moved, day: targetDay });

      touched = [
        ...retimeDay(source, byDay(sourceDay).map((i) => i.time)),
        ...retimeDay(nextTarget, target.map((i) => i.time)).map((i) => ({ ...i, day: targetDay })),
      ];
    }

    if (touched.length === 0) return;

    const previous = items;
    setUndoSnapshot(null);
    // Optimistic: the list settles instantly, then the server confirms.
    const touchedById = new Map(touched.map((i) => [i._id, i]));
    setItems((prev) => prev.map((i) => touchedById.get(i._id) || i));
    setReordering(true);
    setError("");

    try {
      const { items: saved } = await itineraryApi.reorder(
        currentTripId,
        touched.map((i) => ({ _id: i._id, day: i.day, time: i.time }))
      );
      setItems(saved);
      setUndoSnapshot(previous);
    } catch (err) {
      setItems(previous); // the save failed, so put the list back
      setError(`Couldn't save the new order — ${err.message}`);
    } finally {
      setReordering(false);
    }
  }

  async function handleUndoReorder() {
    if (!undoSnapshot) return;
    const restore = undoSnapshot;
    setUndoSnapshot(null);
    setReordering(true);
    try {
      const { items: saved } = await itineraryApi.reorder(
        currentTripId,
        restore.map((i) => ({ _id: i._id, day: i.day, time: i.time }))
      );
      setItems(saved);
    } catch (err) {
      setError(`Couldn't undo — ${err.message}`);
    } finally {
      setReordering(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const newItem = {
      day: Number(form.get("day")),
      time: form.get("time"),
      activity: form.get("activity"),
      location: form.get("location"),
      est_cost: Number(form.get("est_cost") || 0),
    };

    setSaving(true);
    try {
      const { items: saved } = await itineraryApi.generate(currentTripId, [...items, newItem]);
      setItems(saved);
      setOpenDay(newItem.day);
      setShowForm(false);
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!currentTripId) {
    return (
      <AppShell title="Itinerary">
        <NoTripState what="The itinerary" />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Itinerary">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <DayCardSkeleton />
            <DayCardSkeleton />
            <DayCardSkeleton />
            <DayCardSkeleton />
          </div>
          <div className="space-y-5">
            <PanelSkeleton lines={5} />
            <PanelSkeleton lines={3} />
            <Skeleton className="h-12 rounded-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  const days = [...new Set(items.map((i) => i.day))].sort((a, b) => a - b);
  const lastDay = days[days.length - 1] || 0;

  // Same rule the Budget API applies (isBookedFlightLeg): once a round-trip
  // fare is selected, the AI's own arrival (day 1) and departure (last day)
  // travel rows must not be charged again — the fare already covers both ways.
  const AIR_LEG = /\b(flight|flights|fly|flying|airport|airline|airways|plane)\b/i;
  const isBookedFlightLeg = (item) =>
    Boolean(trip?.selected_flight) &&
    item.category === "travel" &&
    (item.day === 1 || item.day === lastDay) &&
    ((item.from_city && item.from_city === trip.origin) ||
      (item.to_city && item.to_city === trip.origin) ||
      AIR_LEG.test(`${item.activity || ""} ${item.location || ""}`));

  const itineraryCost = items.reduce((s, i) => (isBookedFlightLeg(i) ? s : s + (i.est_cost || 0)), 0);
  const flightCost = trip?.selected_flight?.price || 0;
  let hotelCost = 0;
  if (trip?.multi_city && trip.hotel_selections?.length) {
    // Each day's last activity (items are ordered by day, time, so later
    // entries win) marks the city slept in that night. The final day is the
    // day the traveler leaves, so it isn't a night anywhere.
    const cityByDay = {};
    for (const i of items) {
      if (i.city) cityByDay[i.day] = i.city;
    }
    const sleepDays = Object.keys(cityByDay).map(Number).sort((a, b) => a - b).slice(0, -1);
    const nightsByCity = {};
    for (const day of sleepDays) {
      const city = cityByDay[day];
      nightsByCity[city] = (nightsByCity[city] || 0) + 1;
    }
    hotelCost = trip.hotel_selections.reduce((s, sel) => {
      const hotel = sel.hotel_id;
      if (!hotel?.price_per_night) return s;
      const nights = nightsByCity[sel.city] || 0;
      return s + hotel.price_per_night * nights;
    }, 0);
  } else if (trip?.hotel_id) {
    // Nights, not days — a 4-day trip is 3 hotel nights.
    hotelCost = (trip.hotel_id.price_per_night || 0) * Math.max(1, (trip.duration_days || 1) - 1);
  }
  const totalCost = itineraryCost + flightCost + hotelCost;

  return (
    <AppShell
      title={trip ? `${trip.destination} Itinerary` : "Itinerary"}
      subtitle={trip ? `${new Date(trip.start_date).toLocaleDateString()} – ${new Date(trip.end_date).toLocaleDateString()} · ${trip.travelers} travelers` : ""}
    >
      {error && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {/* Flight search panel — shown when transport preference is Flight
              OR when origin and destination are different countries */}
          {trip && (
            trip.transport_preference === "Flight" ||
            isInternationalTrip(trip)
          ) && (
            <FlightSearch
              trip={trip.multi_city ? { ...trip, destination: trip.entry_city } : trip}
              onFlightSelected={(flight) => setTrip((prev) => ({ ...prev, selected_flight: flight }))}
            />
          )}

          {generating && <GenerationProgress trip={trip} />}

          {!generating && items.length === 0 && !showForm && (
            <div className="bg-surface border border-dashed border-sand rounded-2xl p-10 text-center">
              <p className="text-ink-900/60 mb-2 text-sm">No itinerary items yet — generate a full plan with AI, or build it by hand.</p>
              <p className="text-ink-900/50 mb-5 text-xs">
                {trip?.must_visit_attraction_ids?.length > 0 ? (
                  <span className="text-teal-dark font-medium">{trip.must_visit_attraction_ids.length} must-see attraction{trip.must_visit_attraction_ids.length !== 1 ? "s" : ""} locked in</span>
                ) : (
                  <>Want more control over what's included? <Link to="/attractions" className="font-semibold text-teal-dark hover:text-teal underline">Pick your must-see attractions first</Link>.</>
                )}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={handleGenerateAI} className="btn-primary">
                  <Sparkles className="w-4 h-4" /> Generate Itinerary with AI
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal px-2"
                >
                  <Plus className="w-4 h-4" /> Add activity manually
                </button>
              </div>
            </div>
          )}

          {!generating && days.length > 0 && (
            <div className="flex items-center justify-between gap-3 text-xs text-ink-900/45 px-1">
              <span className="inline-flex items-center gap-1.5">
                <GripVertical className="w-3.5 h-3.5" />
                Drag an activity to reorder it, or onto another day's header to move it there.
              </span>
              <span className="flex items-center gap-3">
                {reordering && (
                  <span className="inline-flex items-center gap-1.5 text-teal-dark">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                  </span>
                )}
                {undoSnapshot && !reordering && (
                  <button
                    onClick={handleUndoReorder}
                    className="inline-flex items-center gap-1.5 font-semibold text-teal-dark hover:text-teal"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Undo move
                  </button>
                )}
              </span>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={collisionStrategy}
            onDragStart={({ active }) => setActiveDragId(active.id)}
            onDragCancel={() => setActiveDragId(null)}
            onDragEnd={handleDragEnd}
          >
          {!generating && days.map((day) => {
            const dayItems = items.filter((i) => i.day === day).sort((a, b) => a.time.localeCompare(b.time));
            const open = openDay === day;
            const dayCities = trip?.multi_city
              ? [...new Set(dayItems.map((i) => i.city).filter(Boolean))]
              : [];
            const dayCost = dayItems.reduce((s, i) => (isBookedFlightLeg(i) ? s : s + (i.est_cost || 0)), 0);
            return (
              <DayDropZone key={day} day={day}>
              <div className={`card overflow-hidden transition-shadow mb-4 ${open ? "shadow-lift" : ""}`}>
                <button
                  onClick={() => setOpenDay(open ? null : day)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-paper/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-display text-sm shrink-0 transition-colors ${
                        open ? "bg-teal text-white" : "bg-teal-light text-teal-dark"
                      }`}
                    >
                      {day}
                    </span>
                    <p className="font-display text-lg text-ink-900">Day {day}</p>
                    {dayCities.length > 0 && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light/40 text-teal-dark">
                        {dayCities.join(" → ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <WeatherBadge forecast={weatherByDay[day]?.forecast} />
                    {dayCost > 0 && (
                      <span className="hidden sm:inline text-xs font-mono text-ink-900/50">৳{dayCost.toLocaleString()}</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-ink-900/40 transition-transform duration-base ${open ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {/* Mounted only while open — the body carries a Leaflet map,
                    and keeping ten of them alive to animate a height is not a
                    trade worth making. So the open animates and the close is
                    a cut, which is the right way round: you are looking at
                    what appears, not at what you just dismissed. */}
                {open && (
                  <div className="px-6 pb-6 animate-slide-down">
                    <WeatherDetail forecast={weatherByDay[day]?.forecast} />
                    {(weatherByDay[day]?.forecast?.alerts || []).map((a, i) => (
                      <div key={i} className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-xs rounded-xl px-4 py-2.5 mb-4">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>{a.headline}.</strong> {a.description}
                        </span>
                      </div>
                    ))}
                    <DayMap items={dayItems} cityCoordinates={cityCoordinates} />
                    <SortableContext
                      items={dayItems.map((i) => i._id)}
                      strategy={verticalListSortingStrategy}
                    >
                    <ul className="space-y-4">
                      {dayItems.map((item) => (
                        <SortableRow key={item._id} id={item._id} disabled={reordering}>
                        {({ ref, style, handleProps, isDragging }) => (
                        <li
                          ref={ref}
                          style={style}
                          // Lifting the dragged row off the page is what makes
                          // a reorder feel like moving a card rather than
                          // watching a list re-sort itself.
                          className={`flex gap-2 group/row rounded-xl ${
                            isDragging ? "relative z-10 bg-surface shadow-lift ring-1 ring-teal/30" : ""
                          }`}
                        >
                          {/* Handle rather than whole-row dragging: the row
                              contains its own buttons (transport picking). */}
                          <button
                            {...handleProps}
                            className="shrink-0 self-start mt-0.5 w-5 h-6 flex items-center justify-center rounded text-ink-900/20 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 hover:text-teal-dark hover:bg-teal-light/50 cursor-grab active:cursor-grabbing transition touch-none"
                            aria-label={`Reorder ${item.activity}`}
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-14 shrink-0 text-xs font-mono text-teal-dark pt-0.5">{item.time}</div>
                          <div className="flex-1 border-l-2 border-teal-light pl-4 pb-1 relative">
                            <span
                              className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ring-2 ring-surface"
                              style={{
                                background:
                                  { travel: "#1C8C82", meal: "#D9A441", sightseeing: "#146560", rest: "#8A7B6B", shopping: "#D96B3B", checkin: "#123244", checkout: "#123244" }[item.category] || "#EF8354",
                              }}
                              aria-hidden
                            />
                            <p className="text-sm font-semibold text-ink-900">{item.activity}</p>
                            {item.location && (
                              <p className="text-xs text-ink-900/50 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> {item.location}
                              </p>
                            )}
                            {!isBookedFlightLeg(item) && item.available_transport_options?.length > 0 && (
                              <div className="mt-3 bg-sand/30 rounded-xl p-3 border border-sand">
                                <p className="text-xs font-semibold text-ink-900/70 mb-2 uppercase tracking-wide">Select Transport</p>
                                <div className="space-y-2">
                                  {item.available_transport_options.map((opt, idx) => {
                                    const sel = item.selected_transport_option;
                                    // Live API offers carry a unique id; seeded ground options match on code/fields.
                                    const isSelected = sel != null && (
                                      (opt.id && sel.id === opt.id) ||
                                      (opt.code && sel.code === opt.code) ||
                                      (!opt.id && !opt.code && sel.flight_number === opt.flight_number && sel.fare === opt.fare)
                                    );
                                    return (
                                      <button
                                        key={idx}
                                        onClick={async () => {
                                          try {
                                            const { item: updated } = await itineraryApi.selectTransport(currentTripId, item._id, { selected_option: opt });
                                            setItems((prev) => prev.map((i) => (i._id === item._id ? updated : i)));
                                          } catch (err) {
                                            setError(err.message);
                                          }
                                        }}
                                        className={`w-full text-left text-xs p-2.5 rounded-lg border flex justify-between items-center transition duration-base ${
                                          isSelected
                                            ? "bg-teal-light/20 border-teal shadow-sm text-teal-dark font-medium"
                                            : "bg-surface border-sand hover:border-teal/40 text-ink-900 hover:shadow-sm"
                                        }`}
                                      >
                                        <span>
                                          <span className="font-semibold">{opt.airline || opt.operator}</span>
                                          <span className="opacity-70 ml-1.5">{opt.flight_number || opt.mode} • {opt.depart_time}</span>
                                        </span>
                                        <span className="font-mono font-medium">৳{(opt.estimated_cost || 0).toLocaleString()}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-mono text-ink-900/60 pt-0.5 shrink-0">
                            {isBookedFlightLeg(item) ? (
                              <span className="text-teal-dark font-sans font-medium">In flight fare</span>
                            ) : item.est_cost > 0 ? (
                              `৳${item.est_cost.toLocaleString()}`
                            ) : (
                              "Free"
                            )}
                          </div>
                        </li>
                        )}
                        </SortableRow>
                      ))}
                    </ul>
                    </SortableContext>
                    <NearbySection
                      dayItems={dayItems}
                      cityCoordinates={cityCoordinates}
                      city={weatherByDay[day]?.city || dayCities[0] || (trip?.multi_city ? trip?.entry_city : trip?.destination)}
                    />
                  </div>
                )}
              </div>
              </DayDropZone>
            );
          })}

          {/* The travelling copy under the cursor. Rendering the row's essence
              rather than the whole card keeps the drag light. */}
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16,1,0.3,1)" }}>
            {activeDragId ? (
              <div className="card shadow-lift px-4 py-2.5 flex items-center gap-3 cursor-grabbing">
                <GripVertical className="w-3.5 h-3.5 text-teal-dark shrink-0" />
                <span className="text-xs font-mono text-teal-dark shrink-0">
                  {items.find((i) => i._id === activeDragId)?.time}
                </span>
                <span className="text-sm font-semibold text-ink-900 truncate">
                  {items.find((i) => i._id === activeDragId)?.activity}
                </span>
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>

          {!generating && items.length > 0 && !showForm && (
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/itinerary/print"
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900/50 hover:text-teal-dark"
              >
                <Printer className="w-4 h-4" /> Print / save as PDF
              </Link>
              <RainyDayPlan
                tripId={currentTripId}
                onApplied={() =>
                  itineraryApi.get(currentTripId).then((res) => setItems(res.items))
                }
              />
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark hover:text-teal"
              >
                <Plus className="w-4 h-4" /> Add another activity
              </button>
              <button
                onClick={handleGenerateAI}
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900/50 hover:text-sunset-dark"
              >
                <Sparkles className="w-4 h-4" /> Regenerate with AI (replaces current plan)
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleAddItem} className="bg-surface border border-sand rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-base text-ink-900">Add activity</h4>
                <button type="button" onClick={() => setShowForm(false)} className="text-ink-900/40 hover:text-ink-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Day</span>
                  <input name="day" type="number" min="1" defaultValue="1" required className="input" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Time</span>
                  <input name="time" type="time" required className="input" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Activity</span>
                <input name="activity" type="text" placeholder="e.g. Sunset walk on the beach" required className="input" />
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Location</span>
                  <input name="location" type="text" placeholder="e.g. Laboni Point" className="input" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Estimated cost (BDT)</span>
                  <input name="est_cost" type="number" min="0" defaultValue="0" className="input" />
                </label>
              </div>
              <Button type="submit" variant="teal" loading={saving}>
                Save activity
              </Button>
            </form>
          )}
        </div>

        <aside className="space-y-5">
          <div className="theme-ink bg-ink-900 bg-ink-glow rounded-2xl p-6 shadow-lift">
            <p className="text-xs font-semibold tracking-wide uppercase text-sunset mb-4">Trip snapshot</p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-paper/50">Route</dt><dd className="text-paper">{trip?.origin} → {trip?.destination}</dd></div>
              <div className="flex justify-between"><dt className="text-paper/50">Travelers</dt><dd className="text-paper">{trip?.travelers}</dd></div>
              <div className="flex justify-between"><dt className="text-paper/50">Activities</dt><dd className="text-paper">৳{itineraryCost.toLocaleString()}</dd></div>
              {flightCost > 0 && (
                <div className="flex justify-between">
                  <dt className="text-paper/50">
                    Flight{trip?.selected_flight?.tripType === "round_trip" ? " (both ways)" : ""}
                  </dt>
                  <dd className="text-paper">৳{flightCost.toLocaleString()}</dd>
                </div>
              )}
              {hotelCost > 0 && (
                <div className="flex justify-between"><dt className="text-paper/50">Hotel</dt><dd className="text-paper">৳{hotelCost.toLocaleString()}</dd></div>
              )}
              <div className="flex justify-between border-t border-ink-700 pt-3">
                <dt className="text-paper/50">Trip cost so far</dt>
                <dd className="text-sunset font-mono font-semibold"><Money bdt={totalCost} local={trip?.destination_id?.currency} localClassName="text-paper/50" /></dd>
              </div>
            </dl>
          </div>

          <div className="card p-6">
            <p className="text-xs font-semibold tracking-wide uppercase text-teal mb-3 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Budget snapshot
            </p>
            <p className={`text-2xl font-display mb-1 ${totalCost > (trip?.budget || 0) ? "text-sunset-dark" : "text-ink-900"}`}><Money bdt={totalCost} local={trip?.destination_id?.currency} localClassName="text-base" /></p>
            <p className="text-xs text-ink-900/50">
              of ৳{trip?.budget?.toLocaleString()} planned budget
              {trip?.budget > 0 && totalCost > trip.budget && (
                <span className="text-sunset-dark font-medium"> — over by ৳{(totalCost - trip.budget).toLocaleString()}</span>
              )}
            </p>
            {/* The bar caps at 100%, so overspend is shown by colour and the
                line above rather than disappearing off the end. */}
            <div className="w-full h-2 bg-paper rounded-full mt-3 overflow-hidden">
              <div
                className={totalCost > (trip?.budget || 0) ? "h-full bg-sunset" : "h-full bg-teal"}
                style={{ width: `${trip?.budget ? Math.min((totalCost / trip.budget) * 100, 100) : 0}%` }}
              />
            </div>
          </div>

          <Link to="/attractions" className="btn-secondary w-full py-3">
            <Landmark className="w-4 h-4" />
            {trip?.must_visit_attraction_ids?.length > 0
              ? `${trip.must_visit_attraction_ids.length} Must-See${trip.must_visit_attraction_ids.length !== 1 ? "s" : ""} Picked`
              : "Pick Must-See Attractions"}
          </Link>

          <Link to="/hotels" className="btn-secondary w-full py-3">
            <Building2 className="w-4 h-4" /> Browse Hotels
          </Link>

          <Link to="/chat" className="btn-primary w-full py-3">
            <MessageCircleMore className="w-4 h-4" /> Ask AI to Adjust
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
