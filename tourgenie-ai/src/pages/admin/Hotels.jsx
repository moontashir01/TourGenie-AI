import { useState } from "react";
import Button from "../../components/ui/Button";
import { Plus, Pencil, Trash2, X, Star } from "lucide-react";
import { adminApi } from "../../lib/api";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";

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
  // The catalogue is far past the point where fetching all of it per render
  // made sense, so it pages like every other admin list.
  const list = useAdminList(adminApi.hotels, {}, { listKey: "hotels" });
  const hotels = list.rows;
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = editing existing
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const load = list.reload;
  const error = list.error;
  const setError = list.setError;

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
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-900">Hotels ({hotels.length})</h3>
        {!editing && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal">
            <Plus className="w-4 h-4" /> Add hotel
          </button>
        )}
      </div>

      {editing !== null && (
        <form onSubmit={handleSubmit} className="bg-surface border border-sand rounded-2xl p-6 space-y-4">
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
          <Button type="submit" variant="teal" loading={saving} className="self-start">
            {editing._id ? "Save changes" : "Create hotel"}
          </Button>
        </form>
      )}

      <div className="bg-surface border border-sand rounded-2xl p-6">
        <AdminToolbar list={list} placeholder="Search hotel name, city or area…" />
        <ListState list={list} empty="No hotels match that. Add one, or run the seed script." />
        {hotels.length > 0 && (
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
        <Pager list={list} />
      </div>
    </div>
  );
}
