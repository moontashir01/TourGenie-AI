import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { adminApi, attractionApi } from "../../lib/api";

const blankForm = { name: "", city: "", category: "", entry_fee: 0, lat: "", lng: "", open_hours: "" };

export default function Attractions() {
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = editing existing
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    attractionApi
      .list()
      .then(({ attractions }) => setAttractions(attractions))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openNew() {
    setForm(blankForm);
    setEditing({});
  }

  function openEdit(a) {
    setForm({
      name: a.name,
      city: a.city,
      category: a.category,
      entry_fee: a.entry_fee,
      lat: a.lat_lng?.lat ?? "",
      lng: a.lat_lng?.lng ?? "",
      open_hours: a.open_hours || "",
    });
    setEditing(a);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      city: form.city,
      category: form.category,
      entry_fee: Number(form.entry_fee),
      lat_lng: { lat: Number(form.lat), lng: Number(form.lng) },
      open_hours: form.open_hours,
    };
    try {
      if (editing?._id) {
        await adminApi.updateAttraction(editing._id, payload);
      } else {
        await adminApi.createAttraction(payload);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a) {
    if (!confirm(`Delete "${a.name}"?`)) return;
    try {
      await adminApi.deleteAttraction(a._id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-900">Attractions ({attractions.length})</h3>
        {!editing && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal"
          >
            <Plus className="w-4 h-4" /> Add attraction
          </button>
        )}
      </div>

      {editing !== null && (
        <form onSubmit={handleSubmit} className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base text-ink-900">{editing._id ? "Edit attraction" : "New attraction"}</h4>
            <button type="button" onClick={() => setEditing(null)} className="text-ink-900/40 hover:text-ink-900">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
            <input required placeholder="Category (e.g. nature, beach)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" />
            <input type="number" min="0" placeholder="Entry fee (BDT)" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} className="input" />
            <input type="number" step="any" required placeholder="Latitude" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="input" />
            <input type="number" step="any" required placeholder="Longitude" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="input" />
          </div>
          <input placeholder="Open hours (e.g. 9:00 AM - 5:00 PM)" value={form.open_hours} onChange={(e) => setForm({ ...form, open_hours: e.target.value })} className="input" />
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-teal hover:bg-teal-dark disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors">
            {saving ? "Saving…" : editing._id ? "Save changes" : "Create attraction"}
          </button>
        </form>
      )}

      <div className="bg-white border border-sand rounded-2xl p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-ink-900/50 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">City</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Entry fee</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {attractions.map((a) => (
                <tr key={a._id}>
                  <td className="py-3 font-medium text-ink-900">{a.name}</td>
                  <td className="py-3 text-ink-900/70">{a.city}</td>
                  <td className="py-3 text-ink-900/70">{a.category}</td>
                  <td className="py-3 font-mono text-ink-900/70">{a.entry_fee === 0 ? "Free" : `৳${a.entry_fee}`}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-3 text-ink-900/40">
                      <button onClick={() => openEdit(a)} className="hover:text-teal-dark"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(a)} className="hover:text-sunset-dark"><Trash2 className="w-4 h-4" /></button>
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
