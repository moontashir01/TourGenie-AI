import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw, X, Loader2, AlertTriangle, Database } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import useAdminList from "../../hooks/useAdminList";
import {
  AdminToolbar,
  AdminSelect,
  ColumnPicker,
  SortableHeader,
  Pager,
  ListState,
  ErrorBanner,
} from "../../components/admin/ListShell";
import { useColumnPreferences } from "../../hooks/useListPreferences";

// The collections that had no admin screen at all: changing a destination, a
// route, an expense category or the copy the assistant answers with meant
// editing a seed file and re-running the seed. One table and one form serve
// all of them, driven by the field specs below — which is also what keeps
// them consistent as more are added.
//
// Attractions, hotels and transport keep their own tabs; their forms predate
// this and are shaped around fields these don't have.
//
// Two field kinds exist for the shapes a flat form can't otherwise reach: a
// `list` is a comma-separated line that stores an array of strings, and a
// `json` is a textarea for the genuinely nested parts — an itinerary
// template's days, a route's endpoints. A malformed one is refused with the
// parser's own message rather than being sent as a string.

const text = (name, label, extra = {}) => ({ name, label, kind: "text", ...extra });
const num = (name, label, extra = {}) => ({ name, label, kind: "number", ...extra });
const bool = (name, label) => ({ name, label, kind: "boolean" });
const choice = (name, label, options, extra = {}) => ({ name, label, kind: "select", options, ...extra });
const list = (name, label, extra = {}) => ({ name, label, kind: "list", ...extra });
const json = (name, label, extra = {}) => ({ name, label, kind: "json", wide: true, ...extra });

const RESOURCES = {
  destinations: {
    label: "Destinations",
    search: "Search name, slug, country or division…",
    columns: [
      { key: "name", label: "Name" },
      { key: "country", label: "Country" },
      { key: "type", label: "Type", sortable: false },
      { key: "recommended_days", label: "Days", sortable: false },
      { key: "avg_daily_cost", label: "Daily cost", money: true },
      { key: "popularity", label: "Popularity" },
    ],
    fields: [
      text("name", "Name", { required: true }),
      text("slug", "Slug", { required: true, hint: "lowercase, used in the URL" }),
      text("country", "Country", { required: true }),
      text("country_code", "Country code", { required: true, maxLength: 2 }),
      choice("type", "Type", ["city", "beach", "hill", "forest", "island", "heritage", "nature", "metro"], {
        required: true,
      }),
      text("division", "Division"),
      text("summary", "Summary", { wide: true }),
      num("recommended_days", "Recommended days"),
      num("avg_daily_cost", "Average daily cost (BDT)"),
      num("popularity", "Popularity (0–100)"),
      text("nearest_airport", "Nearest airport (IATA)", { maxLength: 3 }),
      bool("is_active", "Active"),
    ],
  },
  countries: {
    label: "Countries",
    search: "Search name, code, capital or currency…",
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "capital", label: "Capital", sortable: false },
      { key: "currency", label: "Currency", sortable: false },
      { key: "is_core", label: "Core", boolean: true, sortable: false },
    ],
    fields: [
      text("name", "Name", { required: true }),
      text("code", "Code", { required: true, maxLength: 2, hint: "ISO two-letter, e.g. BD" }),
      text("capital", "Capital"),
      text("currency", "Currency", { required: true, maxLength: 3 }),
      text("currency_symbol", "Symbol"),
      text("pricing_currency", "Pricing currency", { maxLength: 3 }),
      text("primary_airport", "Primary airport (IATA)", { maxLength: 3 }),
      bool("is_core", "Core country (offered when planning)"),
      bool("is_active", "Active"),
    ],
  },
  flights: {
    label: "Flights",
    search: "Search airline, flight number or airport…",
    columns: [
      { key: "flight_number", label: "Flight", sortable: false },
      { key: "airline", label: "Airline" },
      { key: "from_iata", label: "From", sortable: false },
      { key: "to_iata", label: "To", sortable: false },
      { key: "depart_time", label: "Departs" },
      { key: "total_fare_bdt", label: "Fare", money: true },
    ],
    fields: [
      text("airline", "Airline", { required: true }),
      text("airline_code", "Airline code", { required: true, maxLength: 3 }),
      text("flight_number", "Flight number", { required: true }),
      text("from_city", "From city", { required: true }),
      text("from_iata", "From IATA", { required: true, maxLength: 3 }),
      text("to_city", "To city", { required: true }),
      text("to_iata", "To IATA", { required: true, maxLength: 3 }),
      text("depart_time", "Departs", { required: true, hint: "24-hour, e.g. 07:30" }),
      text("arrive_time", "Arrives", { required: true }),
      num("duration_min", "Duration (minutes)", { required: true }),
      num("stops", "Stops"),
      choice("cabin", "Cabin", ["economy", "premium", "business", "first"]),
      num("base_fare_bdt", "Base fare (BDT)", { required: true }),
      num("taxes_bdt", "Taxes (BDT)"),
      num("total_fare_bdt", "Total fare (BDT)", { required: true }),
      num("seats_available", "Seats available"),
      bool("refundable", "Refundable"),
      bool("is_active", "Active"),
    ],
  },
  airports: {
    label: "Airports",
    search: "Search IATA, name, city or country…",
    columns: [
      { key: "iata", label: "IATA" },
      { key: "name", label: "Name" },
      { key: "city", label: "City" },
      { key: "country", label: "Country", sortable: false },
      { key: "is_international", label: "International", boolean: true, sortable: false },
    ],
    fields: [
      text("iata", "IATA code", { required: true, maxLength: 3 }),
      text("icao", "ICAO code", { maxLength: 4 }),
      text("name", "Name", { required: true }),
      text("city", "City", { required: true }),
      text("country", "Country", { required: true }),
      text("country_code", "Country code", { maxLength: 2 }),
      text("timezone", "Timezone"),
      bool("is_international", "International"),
      bool("is_active", "Active"),
    ],
  },

  routes: {
    label: "Routes",
    search: "Search endpoints, notes or profile…",
    columns: [
      { key: "from", label: "From", get: (r) => r.from?.name, sortable: false },
      { key: "to", label: "To", get: (r) => r.to?.name, sortable: false },
      { key: "mode", label: "Mode" },
      { key: "variant", label: "Variant", sortable: false },
      { key: "distance_km", label: "Distance (km)" },
      { key: "duration_min", label: "Minutes" },
    ],
    fields: [
      // Endpoints carry a name, a kind and coordinates; a flat form can't
      // express that, so they are edited as the objects they are.
      json("from", "From", { hint: '{ "name": "Dhaka", "kind": "city", "lat_lng": { "lat": 23.81, "lng": 90.41 } }' }),
      json("to", "To", { hint: "Same shape as From" }),
      choice("mode", "Mode", ["driving", "bus", "train", "launch", "flight", "walking", "cycling"], {
        required: true,
      }),
      choice("variant", "Variant", ["fastest", "shortest", "scenic", "cheapest"]),
      text("profile", "Profile", { hint: "ORS naming, e.g. driving-car" }),
      num("distance_km", "Distance (km)", { required: true }),
      num("duration_min", "Duration (minutes)", { required: true }),
      num("est_fare_bdt", "Fare (BDT, per passenger)"),
      num("toll_bdt", "Tolls (BDT)"),
      num("fuel_cost_bdt", "Fuel cost (BDT)"),
      num("carbon_kg", "Carbon (kg per passenger)"),
      text("notes", "Notes", { wide: true }),
      bool("is_default", "Selected by default for this pair"),
      bool("is_active", "Active"),
    ],
  },

  "nearby-services": {
    label: "Nearby services",
    search: "Search name, city, area or address…",
    columns: [
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "city", label: "City" },
      { key: "area", label: "Area", sortable: false },
      { key: "rating", label: "Rating" },
      { key: "is_24h", label: "24h", boolean: true, sortable: false },
    ],
    fields: [
      text("name", "Name", { required: true }),
      choice(
        "category",
        "Category",
        [
          "restaurant", "cafe", "hospital", "pharmacy", "atm", "bank", "fuel",
          "shopping", "toilet", "police", "mosque", "bus_stop", "hotel", "tourist_info",
        ],
        { required: true }
      ),
      text("subcategory", "Subcategory"),
      text("city", "City", { required: true }),
      text("area", "Area"),
      text("address", "Address", { wide: true }),
      text("phone", "Phone"),
      text("opening_hours", "Opening hours"),
      num("rating", "Rating (0–5)"),
      num("price_level", "Price level (0–4)"),
      list("tags", "Tags", { hint: "halal, wheelchair, card-accepted" }),
      json("lat_lng", "Coordinates", { hint: '{ "lat": 21.42, "lng": 92.01 }' }),
      bool("is_24h", "Open 24 hours"),
      bool("is_active", "Active"),
    ],
  },

  "expense-categories": {
    label: "Expense categories",
    search: "Search code, label or description…",
    columns: [
      { key: "sort_order", label: "#" },
      { key: "code", label: "Code" },
      { key: "label", label: "Label" },
      { key: "color", label: "Colour", sortable: false },
      { key: "default_budget_share", label: "Budget share", sortable: false },
      { key: "is_system", label: "System", boolean: true, sortable: false },
    ],
    fields: [
      text("code", "Code", { required: true, hint: "lowercase; expenses store this" }),
      text("label", "Label", { required: true }),
      text("color", "Colour", { required: true, hint: "hex, used by the budget donut" }),
      text("icon", "Icon", { hint: "lucide-react icon name" }),
      text("description", "Description", { wide: true }),
      num("default_budget_share", "Default budget share", { hint: "0–1, seeds the estimated breakdown" }),
      num("sort_order", "Sort order"),
      bool("is_active", "Active"),
    ],
  },

  "interest-tags": {
    label: "Interest tags",
    search: "Search code, label or description…",
    columns: [
      { key: "sort_order", label: "#" },
      { key: "code", label: "Code" },
      { key: "label", label: "Label" },
      { key: "group", label: "Group" },
    ],
    fields: [
      text("code", "Code", { required: true, hint: "matched against templates and trips" }),
      text("label", "Label", { required: true }),
      choice("group", "Group", ["nature", "culture", "activity", "food", "relaxation", "social"]),
      text("icon", "Icon", { hint: "lucide-react icon name" }),
      text("description", "Description", { wide: true }),
      list("suits_destination_types", "Suits destination types", { hint: "beach, hill, island" }),
      num("sort_order", "Sort order"),
      bool("is_active", "Active"),
    ],
  },

  "carbon-factors": {
    label: "Carbon factors",
    search: "Search mode, label, source or notes…",
    columns: [
      { key: "sort_order", label: "#" },
      { key: "mode", label: "Mode" },
      { key: "label", label: "Label", sortable: false },
      { key: "grams_co2_per_passenger_km", label: "g CO₂ / pax-km" },
      { key: "rating", label: "Rating", sortable: false },
    ],
    fields: [
      text("mode", "Mode", { required: true, hint: "bus, train, flight_short…" }),
      text("label", "Label", { required: true }),
      choice("category", "Category", ["road", "rail", "water", "air", "active"], { required: true }),
      num("grams_co2_per_passenger_km", "Grams CO₂ per passenger-km", { required: true }),
      num("occupancy_assumption", "Occupancy assumption"),
      choice("rating", "Rating", ["low", "moderate", "high", "very-high"]),
      list("greener_alternatives", "Greener alternatives"),
      text("source", "Source"),
      text("notes", "Notes", { wide: true }),
      num("sort_order", "Sort order"),
      bool("is_shared", "Shared mode"),
      bool("is_active", "Active"),
    ],
  },

  "itinerary-templates": {
    label: "Itinerary templates",
    search: "Search code, title, city or summary…",
    columns: [
      { key: "title", label: "Title" },
      { key: "city", label: "City" },
      { key: "duration_days", label: "Days" },
      { key: "budget_tier", label: "Tier", sortable: false },
      { key: "popularity", label: "Popularity" },
    ],
    fields: [
      text("code", "Code", { required: true }),
      text("title", "Title", { required: true }),
      text("city", "City", { required: true }),
      text("destination_id", "Destination id", { required: true, hint: "the Destinations tab has these" }),
      text("summary", "Summary", { wide: true }),
      num("duration_days", "Duration (days)", { required: true }),
      choice("pace", "Pace", ["relaxed", "balanced", "packed"]),
      choice("budget_tier", "Budget tier", ["budget", "mid", "luxury"]),
      list("interests", "Interests", { hint: "matched against the trip's interests" }),
      list("suitable_for", "Suitable for", { hint: "family, couple, solo, friends" }),
      num("est_total_cost_per_person", "Estimated cost per person (BDT)"),
      num("popularity", "Popularity (0–100)"),
      json("days", "Days", { hint: '[{ "day": 1, "theme": "Arrival", "items": [ … ] }]' }),
      bool("is_active", "Active"),
    ],
  },

  "packing-templates": {
    label: "Packing templates",
    search: "Search code, label or description…",
    columns: [
      { key: "label", label: "Label" },
      { key: "code", label: "Code" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority" },
      { key: "always_include", label: "Always", boolean: true, sortable: false },
    ],
    fields: [
      text("code", "Code", { required: true }),
      text("label", "Label", { required: true }),
      choice(
        "category",
        "Category",
        ["clothing", "electronics", "documents", "toiletries", "health", "gear", "misc"],
        { required: true }
      ),
      text("description", "Description", { wide: true }),
      num("priority", "Priority", { hint: "higher wins when two templates supply the same item" }),
      json("items", "Items", { hint: '[{ "name": "Rain jacket", "qty_rule": "per_traveler", "essential": true }]' }),
      json("conditions", "Conditions", { hint: "All present conditions must match; omit a key to ignore it" }),
      bool("always_include", "Baseline kit (no matching)"),
      bool("is_active", "Active"),
    ],
  },

  "chat-intents": {
    label: "Chat intents",
    search: "Search code, label, reply or keywords…",
    columns: [
      { key: "label", label: "Label" },
      { key: "code", label: "Code" },
      { key: "priority", label: "Priority" },
      { key: "is_quick_action", label: "Quick action", boolean: true, sortable: false },
      { key: "requires_trip", label: "Needs a trip", boolean: true, sortable: false },
    ],
    fields: [
      text("code", "Code", { required: true }),
      text("label", "Label", { required: true }),
      list("keywords", "Keywords", { hint: "cheaper, cheap, budget, save" }),
      list("patterns", "Patterns", { hint: "case-insensitive regex sources" }),
      text("response_template", "Reply", {
        required: true,
        wide: true,
        hint: "supports {{destination}}, {{days}}, {{budget}}, {{saved}}",
      }),
      list("followup_suggestions", "Follow-up suggestions"),
      json("action", "Action", { hint: '{ "type": "reduce_budget", "params": {} }' }),
      num("priority", "Priority", { hint: "higher wins when several intents match" }),
      text("quick_action_label", "Quick action label"),
      num("quick_action_order", "Quick action order"),
      bool("is_quick_action", "Show as a chip above the chat input"),
      bool("requires_trip", "Only answerable with a trip open"),
      bool("is_active", "Active"),
    ],
  },
};

const money = (n) => `৳${Math.round(n || 0).toLocaleString()}`;

function blankFrom(fields) {
  return Object.fromEntries(fields.map((f) => [f.name, f.kind === "boolean" ? true : ""]));
}

/** What a stored value looks like in the form. */
function toFormValue(field, value) {
  if (value === undefined || value === null) return field.kind === "boolean" ? false : "";
  if (field.kind === "list") return Array.isArray(value) ? value.join(", ") : String(value);
  if (field.kind === "json") return JSON.stringify(value, null, 2);
  return value;
}

/**
 * What the form sends back. Throws on malformed JSON so the message the
 * parser gives is what the admin reads, rather than the field being sent as
 * a string and rejected by Mongoose as the wrong type.
 */
function toPayloadValue(field, value) {
  if (field.kind === "number") return Number(value);
  if (field.kind === "list") {
    return String(value)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (field.kind === "json") {
    try {
      return JSON.parse(value);
    } catch (err) {
      throw new Error(`${field.label}: ${err.message}`);
    }
  }
  return value;
}

// Read before offering to remove: what a record is holding up decides whether
// "delete" can mean "delete" at all.
function DeletePrompt({ resource, row, label, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  // Permanent deletion asks for the record's own name to be typed out. A
  // reason gets answered on muscle memory after the fifth time; copying the
  // name is the step that can't be finished without reading which row is
  // about to go for good.
  const [phrase, setPhrase] = useState("");
  const [refs, setRefs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.catalogue
      .references(resource, row._id)
      .then(setRefs)
      .catch(() => setRefs(null))
      .finally(() => setLoading(false));
  }, [resource, row._id]);

  const blocking = (refs?.references || []).filter((r) => r.blocking && r.count > 0);
  const held = (refs?.references || []).filter((r) => r.count > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md card p-6 animate-pop-in">
        <h3 className="font-display text-lg text-ink-900 mb-1">Delete {label}?</h3>
        <p className="text-sm text-ink-900/60 mb-4">
          It is hidden from the app and can be restored from the Deleted filter.
        </p>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-ink-900/50 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking what references it…
          </p>
        ) : (
          held.length > 0 && (
            <div className="bg-paper border border-sand rounded-lg px-3 py-2.5 mb-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-900/70 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Referenced by
              </p>
              <ul className="text-xs text-ink-900/70 space-y-0.5">
                {held.map((r) => (
                  <li key={r.label}>
                    {r.count} {r.label}
                    {r.blocking && <span className="text-sunset-dark"> · blocks permanent deletion</span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        <label className="block mb-4">
          <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Reason (recorded in the activity log)</span>
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Closed, duplicate, no longer offered…"
            className="input"
          />
        </label>

        {blocking.length === 0 && (
          <label className="block mb-4">
            <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">
              To delete permanently, type <span className="font-mono text-ink-900">{label}</span>
            </span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={label}
              className="input font-mono"
            />
            <span className="text-[11px] text-ink-900/40 mt-1 block">
              Leave it empty to delete reversibly instead.
            </span>
          </label>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim() || blocking.length > 0 || phrase.trim() !== label}
            onClick={() => onConfirm(reason.trim(), true)}
            title={
              blocking.length > 0
                ? "Something still points at this record"
                : phrase.trim() !== label
                  ? `Type ${label} above to enable this`
                  : "Remove the row from the database for good"
            }
            className="inline-flex items-center gap-2 border border-sunset/40 text-sunset-dark font-semibold text-sm px-4 py-2.5 rounded-full disabled:opacity-40"
          >
            Delete permanently
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim(), false)}
            className="inline-flex items-center justify-center gap-2 bg-sunset hover:bg-sunset-dark text-ink-fixed font-semibold text-sm px-5 py-2.5 rounded-full disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Catalogue() {
  const { user } = useAuth();
  const canWrite = ["admin", "owner"].includes(user?.role);

  const [resource, setResource] = useState("destinations");
  const config = RESOURCES[resource];

  const fetcher = useCallback((params) => adminApi.catalogue.list(resource, params), [resource]);
  const listKey = `catalogue:${resource}`;
  const list = useAdminList(fetcher, { deleted: "" }, { listKey });
  // Which columns this admin keeps, per collection — a flight has fifteen
  // fields and nobody reads all of them at once.
  const columns = useColumnPreferences(listKey, config.columns);

  const [editing, setEditing] = useState(null); // null | {} | row
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState([]);

  function switchResource(next) {
    setResource(next);
    setEditing(null);
    setSelected([]);
  }

  function openNew() {
    setForm(blankFrom(config.fields));
    setEditing({});
  }

  function openEdit(row) {
    setForm(Object.fromEntries(config.fields.map((f) => [f.name, toFormValue(f, row[f.name])])));
    setEditing(row);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // Empty strings would overwrite real defaults with nothing.
      const payload = Object.fromEntries(
        config.fields
          .filter((f) => form[f.name] !== "" && form[f.name] !== undefined)
          .map((f) => [f.name, toPayloadValue(f, form[f.name])])
      );
      if (editing._id) await adminApi.catalogue.update(resource, editing._id, payload);
      else await adminApi.catalogue.create(resource, payload);
      setEditing(null);
      list.reload();
    } catch (err) {
      list.setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(reason, hard) {
    setBusyId(deleting._id);
    try {
      await adminApi.catalogue.remove(resource, deleting._id, { reason, hard });
      setDeleting(null);
      list.reload();
    } catch (err) {
      list.setError(err.message);
      setDeleting(null);
    } finally {
      setBusyId(null);
    }
  }

  async function restoreRow(row) {
    setBusyId(row._id);
    try {
      await adminApi.catalogue.restore(resource, row._id);
      list.reload();
    } catch (err) {
      list.setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function runBulk(action) {
    if (selected.length === 0) return;
    setBusyId("bulk");
    try {
      await adminApi.catalogue.bulk(resource, selected, action, `bulk ${action} from the catalogue`);
      setSelected([]);
      list.reload();
    } catch (err) {
      list.setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function toggleRow(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const allSelected = list.rows.length > 0 && selected.length === list.rows.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(RESOURCES).map(([key, r]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchResource(key)}
            className={`text-sm font-medium px-3.5 py-2 rounded-full border transition-colors ${
              resource === key
                ? "bg-ink-900 border-ink-900 text-paper"
                : "bg-surface border-sand text-ink-900/70 hover:border-teal/50"
            }`}
          >
            {r.label}
          </button>
        ))}
        {canWrite && (
          <button onClick={openNew} className="btn-primary ml-auto">
            <Plus className="w-4 h-4" /> New {config.label.replace(/s$/, "").toLowerCase()}
          </button>
        )}
      </div>

      {editing !== null && (
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base text-ink-900">
              {editing._id ? `Edit ${config.label.replace(/s$/, "").toLowerCase()}` : `New ${config.label.replace(/s$/, "").toLowerCase()}`}
            </h4>
            <button type="button" onClick={() => setEditing(null)} className="text-ink-900/40 hover:text-ink-900">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {config.fields.map((f) => (
              <label key={f.name} className={`block ${f.wide ? "sm:col-span-2" : ""}`}>
                <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">
                  {f.label}
                  {f.required && <span className="text-sunset-dark"> *</span>}
                </span>
                {f.kind === "boolean" ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(form[f.name])}
                    onClick={() => setForm({ ...form, [f.name]: !form[f.name] })}
                    className={`w-11 h-6 rounded-full relative transition-colors ${form[f.name] ? "bg-teal" : "bg-sand"}`}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow-sm transition-transform"
                      style={{ transform: form[f.name] ? "translateX(20px)" : "translateX(0)" }}
                    />
                  </button>
                ) : f.kind === "select" ? (
                  <select
                    required={f.required}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    className="input"
                  >
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.kind === "json" ? (
                  <textarea
                    rows={6}
                    spellCheck={false}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    className="input font-mono text-xs resize-y"
                  />
                ) : (
                  <input
                    type={f.kind === "number" ? "number" : "text"}
                    required={f.required}
                    maxLength={f.maxLength}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    className="input"
                  />
                )}
                {f.hint && <span className="text-[11px] text-ink-900/40 mt-1 block">{f.hint}</span>}
              </label>
            ))}
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : editing._id ? "Save changes" : `Create ${config.label.replace(/s$/, "").toLowerCase()}`}
          </button>
        </form>
      )}

      <div className="card p-6">
        <ErrorBanner message={list.error} onDismiss={() => list.setError("")} />

        <AdminToolbar list={list} placeholder={config.search}>
          <AdminSelect
            label="Deleted"
            value={list.filters.deleted}
            onChange={(v) => list.setFilter("deleted", v)}
            options={[
              { value: "", label: "Live records" },
              { value: "only", label: "Deleted only" },
              { value: "all", label: "Everything" },
            ]}
          />
          <ColumnPicker
            columns={config.columns}
            hidden={columns.hidden}
            onToggle={columns.toggle}
            onReset={columns.reset}
          />
        </AdminToolbar>

        {canWrite && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-paper border border-sand rounded-xl px-3 py-2.5 mb-4">
            <span className="text-xs text-ink-900/60">{selected.length} selected</span>
            {["activate", "deactivate", "delete", "restore"].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => runBulk(action)}
                disabled={busyId === "bulk"}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-sand text-ink-900/70 hover:border-teal capitalize disabled:opacity-50"
              >
                {action}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-xs text-ink-900/45 hover:text-ink-900 ml-auto"
            >
              Clear
            </button>
          </div>
        )}

        <ListState list={list} empty="Nothing matches that." />

        {list.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                  {canWrite && (
                    <th className="pb-3 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : list.rows.map((r) => r._id))}
                        aria-label="Select all on this page"
                        className="accent-teal"
                      />
                    </th>
                  )}
                  {columns.visible.map((c) => (
                    <SortableHeader key={c.key} list={list} field={c.sortable === false ? null : c.key}>
                      {c.label}
                    </SortableHeader>
                  ))}
                  <th className="pb-3 font-medium">State</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {list.rows.map((row) => (
                  <tr key={row._id} className={busyId === row._id ? "opacity-50" : ""}>
                    {canWrite && (
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(row._id)}
                          onChange={() => toggleRow(row._id)}
                          aria-label={`Select ${row.name || row._id}`}
                          className="accent-teal"
                        />
                      </td>
                    )}
                    {columns.visible.map((c) => {
                      // A route's endpoints are nested objects, so a column
                      // may name an accessor instead of a top-level key.
                      const value = c.get ? c.get(row) : row[c.key];
                      return (
                        <td key={c.key} className="py-3 text-ink-900/70">
                          {c.money ? (
                            <span className="font-mono">{money(value)}</span>
                          ) : c.boolean ? (
                            value ? "Yes" : "No"
                          ) : (
                            String(value ?? "—")
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                          row.deleted_at
                            ? "bg-sunset-light text-sunset-dark"
                            : row.is_active
                              ? "bg-teal-light text-teal-dark"
                              : "bg-sand text-ink-900/60"
                        }`}
                      >
                        {row.deleted_at ? "Deleted" : row.is_active ? "Live" : "Inactive"}
                      </span>
                      {row.source_kind === "admin" && (
                        <span className="block text-[10px] text-ink-900/35 mt-0.5">added here</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-3">
                        {row.deleted_at ? (
                          <button
                            onClick={() => restoreRow(row)}
                            disabled={!canWrite || busyId === row._id}
                            title="Restore"
                            className="text-ink-900/40 hover:text-teal-dark disabled:opacity-30"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(row)}
                              disabled={!canWrite}
                              title="Edit"
                              className="text-ink-900/40 hover:text-teal-dark disabled:opacity-30"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleting(row)}
                              disabled={!canWrite || busyId === row._id}
                              title="Delete"
                              className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pager list={list} />
      </div>

      <RateCachePanel canWrite={canWrite} />

      {deleting && (
        <DeletePrompt
          resource={resource}
          row={deleting}
          label={
            deleting.name ||
            deleting.label ||
            deleting.title ||
            deleting.flight_number ||
            deleting.iata ||
            deleting.code ||
            deleting.mode ||
            "this record"
          }
          busy={busyId === deleting._id}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

// Hotel rates are a provider cache, not a rate card: one row per hotel, stay
// and occupancy, remembered so a free-tier quota survives repeated visits.
// What an admin needs is its size, and a way to drop it when prices move.
function RateCachePanel({ canWrite }) {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.catalogue
      .rateCache()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  async function clear() {
    setBusy(true);
    try {
      await adminApi.catalogue.clearRateCache();
      setStats(await adminApi.catalogue.rateCache());
    } catch {
      // The panel is informational; a failure here shouldn't take the page.
    } finally {
      setBusy(false);
    }
  }

  if (!stats) return null;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Database className="w-4 h-4 text-teal-dark" />
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-base text-ink-900">Hotel rate cache</h4>
          <p className="text-xs text-ink-900/55">
            {stats.total.toLocaleString()} cached lookup{stats.total === 1 ? "" : "s"}
            {stats.empty_markers > 0 && `, ${stats.empty_markers} recording an empty search`}
            {stats.newest && ` · newest ${new Date(stats.newest).toLocaleDateString()}`}
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={!canWrite || busy || stats.total === 0}
          className="btn-secondary text-xs"
        >
          {busy ? "Clearing…" : "Clear cache"}
        </button>
      </div>
      <p className="text-[11px] text-ink-900/40 mt-2">
        Clearing makes the next hotel search call the provider again. Prices reappear as travellers browse.
      </p>
    </div>
  );
}
