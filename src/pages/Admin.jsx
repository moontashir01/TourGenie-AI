import {
  Users,
  MapPinned,
  Building2,
  Bus,
  MessageSquareWarning,
  BarChart3,
  Check,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { adminMetrics, tripsCreatedByMonth, pendingModeration } from "../data/mockData";

const sidebarItems = [
  { label: "Overview", icon: BarChart3 },
  { label: "Users", icon: Users },
  { label: "Attractions", icon: MapPinned },
  { label: "Hotels", icon: Building2 },
  { label: "Transport", icon: Bus },
  { label: "Reviews", icon: MessageSquareWarning },
];

const attractions = [
  { name: "Himchari National Park", city: "Cox's Bazar", category: "Nature", fee: 100 },
  { name: "Konak Cong Waterfall", city: "Sajek Valley", category: "Nature", fee: 0 },
  { name: "Karamjal Wildlife Centre", city: "Sundarbans", category: "Wildlife", fee: 200 },
];

export default function Admin() {
  const max = Math.max(...tripsCreatedByMonth.map((d) => d.value));

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sand bg-ink-900 py-6 px-4">
        <p className="font-display text-lg text-paper px-2 mb-8">Admin console</p>
        <nav className="flex flex-col gap-1">
          {sidebarItems.map((item, i) => (
            <button
              key={item.label}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                i === 0 ? "bg-ink-800 text-sunset" : "text-paper/60 hover:bg-ink-800 hover:text-paper"
              }`}
            >
              <item.icon className="w-4 h-4" strokeWidth={1.75} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="border-b border-sand bg-white/40 px-6 md:px-10 py-6">
          <h1 className="font-display text-2xl text-ink-900">Overview</h1>
          <p className="text-sm text-ink-900/60 mt-1">Platform health at a glance.</p>
        </header>

        <main className="px-6 md:px-10 py-8 space-y-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {adminMetrics.map((m) => (
              <div key={m.label} className="bg-white border border-sand rounded-2xl p-5">
                <p className="text-xs font-medium text-ink-900/50 mb-2">{m.label}</p>
                <p className="font-mono text-2xl font-semibold text-ink-900">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white border border-sand rounded-2xl p-6">
              <h3 className="font-display text-lg text-ink-900 mb-6">Trips created</h3>
              <div className="flex items-end gap-4 h-40">
                {tripsCreatedByMonth.map((d) => (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-teal rounded-t-md"
                      style={{ height: `${(d.value / max) * 100}%` }}
                    />
                    <span className="text-xs text-ink-900/50">{d.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-sand rounded-2xl p-6">
              <h3 className="font-display text-lg text-ink-900 mb-4">Pending moderation</h3>
              <ul className="space-y-4">
                {pendingModeration.map((m) => (
                  <li key={m.id} className="border-b border-sand last:border-0 pb-4 last:pb-0">
                    <p className="text-sm font-semibold text-ink-900">{m.type} · {m.place}</p>
                    <p className="text-xs text-ink-900/50 mb-3">{m.reason} — {m.user}</p>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 text-xs font-semibold text-teal-dark bg-teal-light px-2.5 py-1.5 rounded-full">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button className="flex items-center gap-1 text-xs font-semibold text-sunset-dark bg-sunset-light px-2.5 py-1.5 rounded-full">
                        <X className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white border border-sand rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg text-ink-900">Manage attractions</h3>
              <button className="text-sm font-semibold text-teal-dark hover:text-teal">+ Add attraction</button>
            </div>
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
                  <tr key={a.name}>
                    <td className="py-3 font-medium text-ink-900">{a.name}</td>
                    <td className="py-3 text-ink-900/70">{a.city}</td>
                    <td className="py-3 text-ink-900/70">{a.category}</td>
                    <td className="py-3 font-mono text-ink-900/70">{a.fee === 0 ? "Free" : `৳${a.fee}`}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-3 text-ink-900/40">
                        <button className="hover:text-teal-dark"><Pencil className="w-4 h-4" /></button>
                        <button className="hover:text-sunset-dark"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
