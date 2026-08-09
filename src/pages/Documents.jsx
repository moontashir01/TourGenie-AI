import { UploadCloud, FileText, RefreshCw } from "lucide-react";
import AppShell from "../components/AppShell";

const docs = [
  { type: "Passport", expiry: "Expires 2029-03-12" },
  { type: "Visa", expiry: "Not required" },
  { type: "Hotel Booking", expiry: "Aug 15, 2026" },
  { type: "Bus Ticket", expiry: "Aug 15, 2026" },
];

const packing = {
  Clothing: ["Light cotton shirts", "Swimwear", "Rain jacket"],
  Electronics: ["Phone charger", "Power bank", "Waterproof phone case"],
  Documents: ["NID / Passport copy", "Hotel booking printout"],
  Toiletries: ["Sunscreen SPF 50", "Toothbrush kit", "Mosquito repellent"],
};

export default function Documents() {
  return (
    <AppShell title="Travel Documents & Packing" subtitle="Everything you need, stored with the trip.">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-sand rounded-2xl py-10 cursor-pointer hover:border-teal transition-colors bg-white">
            <UploadCloud className="w-7 h-7 text-teal" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink-900">Drag a file here or click to upload</p>
            <p className="text-xs text-ink-900/50">Passport, visa, ID, insurance, tickets, hotel bookings</p>
            <input type="file" className="hidden" />
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            {docs.map((d) => (
              <div key={d.type} className="bg-white border border-sand rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-light flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-teal-dark" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{d.type}</p>
                  <p className="text-xs text-ink-900/50">{d.expiry}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="bg-white border border-sand rounded-2xl p-6 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg text-ink-900">Smart packing list</h3>
            <button className="text-ink-900/40 hover:text-teal-dark"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="space-y-5">
            {Object.entries(packing).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold tracking-wide uppercase text-ink-900/50 mb-2">{cat}</p>
                <ul className="space-y-1.5">
                  {items.map((it) => (
                    <li key={it} className="flex items-center gap-2 text-sm text-ink-900/80">
                      <input type="checkbox" className="accent-teal" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
