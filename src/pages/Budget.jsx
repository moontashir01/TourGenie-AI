import { Plus, Leaf } from "lucide-react";
import AppShell from "../components/AppShell";
import { expenses, budgetByCategory } from "../data/mockData";

const TOTAL_BUDGET = 20000;

export default function Budget() {
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = TOTAL_BUDGET - spent;

  let cumulative = 0;
  const segments = budgetByCategory.map((c) => {
    const start = cumulative;
    cumulative += c.amount;
    return { ...c, start, end: cumulative };
  });
  const total = cumulative;

  return (
    <AppShell title="Budget & Expenses" subtitle="Cox's Bazar trip · Aug 15 – Aug 18">
      <div className="grid sm:grid-cols-3 gap-5 mb-8">
        <SummaryCard label="Total Budget" value={TOTAL_BUDGET} tone="ink" />
        <SummaryCard label="Spent" value={spent} tone="sunset" />
        <SummaryCard label="Remaining" value={remaining} tone="teal" />
      </div>

      <div className="w-full h-2 bg-sand rounded-full overflow-hidden mb-10">
        <div
          className="h-full bg-sunset"
          style={{ width: `${Math.min((spent / TOTAL_BUDGET) * 100, 100)}%` }}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white border border-sand rounded-2xl p-6">
          <h3 className="font-display text-lg text-ink-900 mb-6">Spending by category</h3>
          <div className="flex items-center gap-8">
            <svg viewBox="0 0 42 42" className="w-40 h-40 shrink-0 -rotate-90">
              <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#EFE7D6" strokeWidth="6" />
              {segments.map((s) => (
                <circle
                  key={s.category}
                  cx="21" cy="21" r="15.9"
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth="6"
                  strokeDasharray={`${((s.end - s.start) / total) * 100} ${100 - ((s.end - s.start) / total) * 100}`}
                  strokeDashoffset={-((s.start / total) * 100)}
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <ul className="space-y-2.5 text-sm flex-1">
              {budgetByCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-900/70">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    {c.category}
                  </span>
                  <span className="font-mono text-ink-900">৳{c.amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white border border-sand rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-lg text-ink-900">Expense log</h3>
            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal">
              <Plus className="w-4 h-4" /> Add expense
            </button>
          </div>
          <div className="divide-y divide-sand">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{e.description}</p>
                  <p className="text-xs text-ink-900/50">{e.category} · {e.date}</p>
                </div>
                <p className="font-mono text-sm text-ink-900">৳{e.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-teal-light border border-teal/20 rounded-2xl p-5 flex items-center gap-4">
        <Leaf className="w-8 h-8 text-teal-dark shrink-0" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-semibold text-teal-dark">Estimated trip carbon footprint: 42 kg CO₂</p>
          <p className="text-xs text-teal-dark/70 mt-0.5">Mostly from the return bus journey. Choosing the train instead could cut this by roughly 15%.</p>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, tone }) {
  const toneClass = {
    ink: "text-ink-900",
    sunset: "text-sunset-dark",
    teal: "text-teal-dark",
  }[tone];
  return (
    <div className="bg-white border border-sand rounded-2xl p-6">
      <p className="text-xs font-medium text-ink-900/50 mb-2">{label}</p>
      <p className={`font-mono text-2xl font-semibold ${toneClass}`}>৳{value.toLocaleString()}</p>
    </div>
  );
}
