import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, RefreshCw, Trash2, Plus, X, Loader2, Sparkles, CalendarClock, Luggage } from "lucide-react";
import AppShell from "../components/AppShell";
import { documentApi, packingApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useLanguage } from "../context/LanguageContext";

const DOC_TYPES = ["passport", "visa", "id", "insurance", "ticket", "hotel", "other"];

const CATEGORY_LABELS = {
  clothing: "Clothing",
  electronics: "Electronics",
  documents: "Documents",
  toiletries: "Toiletries",
  health: "Health",
  gear: "Gear",
  misc: "Misc",
};

function expiryBadge(date) {
  if (!date) return null;
  const days = Math.ceil((new Date(date) - Date.now()) / 86400000);
  if (days < 0) return { label: "Expired", tone: "bg-sunset/15 text-sunset-dark" };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: "bg-gold/20 text-ink-900" };
  return { label: `Expires ${new Date(date).toLocaleDateString()}`, tone: "bg-paper text-ink-900/50" };
}

// FR-15 — the generated packing list for the current trip: rule-matched
// against the trip's real weather, persisted so ticks survive reloads.
function PackingPanel() {
  const { t } = useLanguage();
  const { currentTripId } = useCurrentTrip();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    packingApi
      .get(currentTripId)
      .then(({ packing_list }) => setList(packing_list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentTripId]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const { packing_list } = await packingApi.generate(currentTripId);
      setList(packing_list);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function toggle(category, name, checked) {
    // Optimistic — the checkbox answers instantly, the server persists it.
    setList((prev) => ({
      ...prev,
      categories: prev.categories.map((g) =>
        g.category === category
          ? { ...g, items: g.items.map((i) => (i.name === name ? { ...i, checked } : i)) }
          : g
      ),
    }));
    packingApi.toggle(currentTripId, category, name, checked).catch(() => {});
  }

  const totals = list
    ? list.categories.reduce(
        (acc, g) => {
          acc.total += g.items.length;
          acc.done += g.items.filter((i) => i.checked).length;
          return acc;
        },
        { total: 0, done: 0 }
      )
    : null;

  return (
    <aside className="card p-6 h-fit">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-lg text-ink-900 flex items-center gap-2">
          <Luggage className="w-4 h-4 text-teal-dark" /> {t("packing.title", "Smart packing list")}
        </h3>
        {list && (
          <button
            onClick={generate}
            disabled={generating}
            title="Regenerate from the latest weather (keeps your ticks)"
            className="text-ink-900/40 hover:text-teal-dark disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {!currentTripId ? (
        <p className="text-sm text-ink-900/50 mt-3">
          Open a trip from your <Link to="/dashboard" className="text-teal-dark font-semibold hover:text-teal">dashboard</Link>{" "}
          first — the list is generated from that trip's dates, cities and weather.
        </p>
      ) : loading ? (
        <p className="text-sm text-ink-900/40 mt-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : !list ? (
        <div className="mt-3">
          <p className="text-sm text-ink-900/50 mb-4">
            No list yet for this trip. It's built from your trip length, party size, the destinations' weather
            forecast and your interests — no two trips pack the same.
          </p>
          <button onClick={generate} disabled={generating} className="btn-primary w-full">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Reading the forecast…" : "Generate packing list"}
          </button>
          {error && <p className="text-xs text-sunset-dark mt-2">{error}</p>}
        </div>
      ) : (
        <div>
          <p className="text-xs text-ink-900/50 mb-1">{list.based_on?.weather_summary}</p>
          {totals && (
            <div className="mb-4">
              <p className="text-xs text-ink-900/40 mb-1.5">
                {totals.done} of {totals.total} packed
              </p>
              <div className="w-full h-1.5 bg-paper rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal transition-all duration-300"
                  style={{ width: `${totals.total ? (totals.done / totals.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {error && <p className="text-xs text-sunset-dark mb-2">{error}</p>}
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {list.categories.map((group) => (
              <div key={group.category}>
                <p className="text-xs font-semibold tracking-wide uppercase text-ink-900/50 mb-2">
                  {t(`packing.${group.category}`, CATEGORY_LABELS[group.category] || group.category)}
                </p>
                <ul className="space-y-1.5">
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <label className="flex items-start gap-2 text-sm text-ink-900/80 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="accent-teal mt-0.5"
                          checked={item.checked}
                          onChange={(e) => toggle(group.category, item.name, e.target.checked)}
                        />
                        <span className={item.checked ? "line-through text-ink-900/40" : ""}>
                          {item.name}
                          {item.qty > 1 && <span className="text-ink-900/40 font-mono text-xs"> ×{item.qty}</span>}
                          {item.essential && !item.checked && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-sunset-dark">
                              essential
                            </span>
                          )}
                          {item.note && <span className="block text-xs text-ink-900/40">{item.note}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default function Documents() {
  const { t } = useLanguage();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    documentApi
      .list()
      .then(({ documents }) => setDocs(documents))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    setSaving(true);
    setError("");
    try {
      await documentApi.add({
        type: form.get("type"),
        title: form.get("title"),
        file_url: form.get("file_url"),
        expiry_date: form.get("expiry_date") || null,
      });
      e.target.reset();
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.title || doc.type}"?`)) return;
    try {
      await documentApi.remove(doc._id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title={t("documents.title", "Travel Documents & Packing")} subtitle="Everything you need, stored with the trip.">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-5">
          {error && (
            <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-ink-900">Your documents ({docs.length})</h3>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? "Cancel" : "Add document"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleAdd} className="card p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Type</span>
                  <select name="type" required className="input capitalize">
                    {DOC_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Title</span>
                  <input name="title" type="text" placeholder="e.g. Passport — your name" className="input" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">File link</span>
                <input
                  name="file_url"
                  type="url"
                  required
                  placeholder="https://… (Google Drive, Dropbox, or any hosted copy)"
                  className="input"
                />
                <span className="text-xs text-ink-900/40 mt-1 block">
                  Paste a link to the scanned copy — direct file upload is on the roadmap.
                </span>
              </label>
              <label className="block sm:w-1/2">
                <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">Expiry date (optional)</span>
                <input name="expiry_date" type="date" className="input" />
              </label>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save document"}
              </button>
            </form>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-ink-900/50 text-sm py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
            </div>
          ) : docs.length === 0 ? (
            <div className="bg-white border border-dashed border-sand rounded-2xl p-10 text-center">
              <FileText className="w-7 h-7 text-teal mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-900/60">
                No documents yet. Keep scans of your passport, visa, tickets and bookings here so they travel with the
                trip.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {docs.map((d) => {
                const badge = expiryBadge(d.expiry_date);
                return (
                  <div key={d._id} className="card card-hover p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-light flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-teal-dark" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate capitalize">{d.title || d.type}</p>
                      <p className="text-xs text-ink-900/50 capitalize">{d.type}</p>
                      {badge && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5 ${badge.tone}`}>
                          <CalendarClock className="w-3 h-3" /> {badge.label}
                        </span>
                      )}
                      <div className="mt-2">
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-teal-dark hover:text-teal"
                        >
                          Open file →
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(d)}
                      title="Delete"
                      className="text-ink-900/30 hover:text-sunset-dark shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <PackingPanel />
      </div>
    </AppShell>
  );
}
