import { useState } from "react";
import Button from "../../components/ui/Button";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { adminApi } from "../../lib/api";
import useAdminList from "../../hooks/useAdminList";
import { AdminToolbar, Pager, ListState, ErrorBanner } from "../../components/admin/ListShell";

const blankForm = { operator: "", mode: "bus", from_city: "", to_city: "", depart_time: "", arrive_time: "", fare: "" };

export default function Transport() {
  // Reads the admin list rather than the public one: this screen needs every
  // schedule, including any that are deactivated, and it needs to page.
  const list = useAdminList(adminApi.transport, {}, { listKey: "transport" });
  const options = list.rows;
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const load = list.reload;
  const error = list.error;
  const setError = list.setError;

  function openNew() {
    setForm(blankForm);
    setEditing({});
  }

  function openEdit(o) {
    setForm({
      operator: o.operator,
      mode: o.mode,
      from_city: o.from_city,
      to_city: o.to_city,
      depart_time: o.depart_time,
      arrive_time: o.arrive_time,
      fare: o.fare,
    });
    setEditing(o);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = { ...form, fare: Number(form.fare) };
    try {
      if (editing?._id) {
        await adminApi.updateTransport(editing._id, payload);
      } else {
        await adminApi.createTransport(payload);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(o) {
    if (!confirm(`Delete "${o.operator}" (${o.from_city} → ${o.to_city})?`)) return;
    try {
      await adminApi.deleteTransport(o._id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-900">Transport options ({options.length})</h3>
        {!editing && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal">
            <Plus className="w-4 h-4" /> Add option
          </button>
        )}
      </div>

      {editing !== null && (
        <form onSubmit={handleSubmit} className="bg-surface border border-sand rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base text-ink-900">{editing._id ? "Edit transport option" : "New transport option"}</h4>
            <button type="button" onClick={() => setEditing(null)} className="text-ink-900/40 hover:text-ink-900">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Operator (e.g. Green Line)" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} className="input" />
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="input">
              <option value="bus">Bus</option>
              <option value="train">Train</option>
              <option value="launch">Launch</option>
            </select>
            <input required placeholder="From city" value={form.from_city} onChange={(e) => setForm({ ...form, from_city: e.target.value })} className="input" />
            <input required placeholder="To city" value={form.to_city} onChange={(e) => setForm({ ...form, to_city: e.target.value })} className="input" />
            <input required type="time" placeholder="Departs" value={form.depart_time} onChange={(e) => setForm({ ...form, depart_time: e.target.value })} className="input" />
            <input required type="time" placeholder="Arrives" value={form.arrive_time} onChange={(e) => setForm({ ...form, arrive_time: e.target.value })} className="input" />
            <input required type="number" min="0" placeholder="Fare (BDT)" value={form.fare} onChange={(e) => setForm({ ...form, fare: e.target.value })} className="input" />
          </div>
          <Button type="submit" variant="teal" loading={saving} className="self-start">
            {editing._id ? "Save changes" : "Create option"}
          </Button>
        </form>
      )}

      <div className="bg-surface border border-sand rounded-2xl p-6">
        <AdminToolbar list={list} placeholder="Search operator, from or to city…" />
        <ListState list={list} empty="No schedules match that." />
        {options.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Operator</th>
                <th className="pb-3 font-medium">Mode</th>
                <th className="pb-3 font-medium">Route</th>
                <th className="pb-3 font-medium">Departs</th>
                <th className="pb-3 font-medium">Fare</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {options.map((o) => (
                <tr key={o._id}>
                  <td className="py-3 font-medium text-ink-900">{o.operator}</td>
                  <td className="py-3 text-ink-900/70 capitalize">{o.mode}</td>
                  <td className="py-3 text-ink-900/70">{o.from_city} → {o.to_city}</td>
                  <td className="py-3 text-ink-900/70">{o.depart_time}</td>
                  <td className="py-3 font-mono text-ink-900/70">৳{o.fare.toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex justify-end gap-3 text-ink-900/40">
                      <button onClick={() => openEdit(o)} className="hover:text-teal-dark"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(o)} className="hover:text-sunset-dark"><Trash2 className="w-4 h-4" /></button>
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
