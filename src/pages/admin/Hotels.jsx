import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X, Star } from "lucide-react";
import { adminApi } from "../../lib/api";

const blankForm = {
  name: "",
  city: "",
  price_per_night: "",
  rating: 3,
  facilities: "",
  lat: "",
  lng: "",
};

export default function Hotels() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = editing existing
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    adminApi
      .hotels()
      .then(({ hotels }) => setHotels(hotels))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openNew() {
    setForm(blankForm);
    setEditing({});
  }

  function openEdit(h) {
    setForm({
      name: h.name,
      city: h.city,
      price_per_night: h.price_per_night,
      rating: h.rating ?? 3,
      facilities: (h.facilities || []).join(", "),
      lat: h.lat_lng?.lat ?? "",
      lng: h.lat_lng?.lng ?? "",
    });
    setEditing(h);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      city: form.city,
      price_per_night: Number(form.price_per_night),
      rating: Number(form.rating),
      facilities: form.facilities
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      lat_lng: {
        lat: form.lat === "" ? undefined : Number(form.lat),
        lng: form.lng === "" ? undefined : Number(form.lng),
      },
    };
    try {
      if (editing?._id) {
        await adminApi.updateHotel(editing._id, payload);
      } else {
        await adminApi.createHotel(payload);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(h) {
    if (!confirm(`Delete "${h.name}" (${h.city})?`)) return;
    try {
      await adminApi.deleteHotel(h._id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-900">Hotels ({hotels.length})</h3>
        {!editing && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal">
            <Plus className="w-4 h-4" /> Add hotel
          </button>
        )}
      </div>

      {editing !== null && (
        <form onSubmit={handleSubmit} className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base text-ink-900">{editing._id ? "Edit hotel" : "New hotel"}</h4>
            <button type="button" onClick={() => setEditing(null)} className="text-ink-900/40 hover:text-ink-900">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
            <input required type="number" min="0" placeholder="Price per night (BDT)" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} className="input" />
            <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="input">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>
              ))}
            </select>
            <input type="number" step="any" placeholder="Latitude (optional)" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="input" />
            <input type="number" step="any" placeholder="Longitude (optional)" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="input" />
          </div>
          <input placeholder="Facilities (comma-separated, e.g. Wi-Fi, Pool, Breakfast)" value={form.facilities} onChange={(e) => setForm({ ...form, facilities: e.target.value })} className="input" />
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-teal hover:bg-teal-dark disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors">
            {saving ? "Saving…" : editing._id ? "Save changes" : "Create hotel"}
          </button>
        </form>
      )}

      <div className="bg-white border border-sand rounded-2xl p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-ink-900/50 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : hotels.length === 0 ? (
          <p className="text-sm text-ink-900/50">No hotels yet. Add one, or run the seed script.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">City</th>
                <th className="pb-3 font-medium">Rating</th>
                <th className="pb-3 font-medium">Price / night</th>
                <th className="pb-3 font-medium">Facilities</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {hotels.map((h) => (
                <tr key={h._id}>
                  <td className="py-3 font-medium text-ink-900">{h.name}</td>
                  <td className="py-3 text-ink-900/70">{h.city}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 text-gold">
                      <Star className="w-3.5 h-3.5 fill-gold" /> {h.rating}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-ink-900/70">৳{h.price_per_night.toLocaleString()}</td>
                  <td className="py-3 text-ink-900/60 max-w-[220px] truncate">{(h.facilities || []).join(", ") || "—"}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-3 text-ink-900/40">
                      <button onClick={() => openEdit(h)} className="hover:text-teal-dark"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(h)} className="hover:text-sunset-dark"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
