import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2, X } from "lucide-react";
import AppShell from "../components/AppShell";
import { expenseApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";

const categoryColors = {
  Transport: "#1C8C82",
  Hotel: "#EF8354",
  Food: "#D9A441",
  Attractions: "#146560",
  Shopping: "#D96B3B",
  Miscellaneous: "#8A7F6A",
};

export default function Budget() {
  const { currentTripId } = useCurrentTrip();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    return Promise.all([expenseApi.budgetSummary(currentTripId), expenseApi.list(currentTripId)]).then(
      ([summaryRes, expensesRes]) => {
        setSummary(summaryRes);
        setExpenses(expensesRes.expenses);
      }
    );
  }

  useEffect(() => {
    if (!currentTripId) {
      setLoading(false);
      return;
    }
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentTripId]);

  async function handleAddExpense(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {
      category: form.get("category"),
      description: form.get("description"),
      amount: Number(form.get("amount")),
      date: form.get("date") || new Date().toISOString(),
    };

    setSaving(true);
    try {
      await expenseApi.add(currentTripId, payload);
      await load();
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
      <AppShell title="Budget & Expenses">
        <div className="bg-white border border-dashed border-sand rounded-2xl p-12 text-center">
          <p className="text-ink-900/60 mb-4">No trip selected yet.</p>
          <Link to="/dashboard" className="text-sm font-semibold text-teal-dark hover:text-teal">← Go to your trips</Link>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Budget & Expenses">
        <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading budget…
        </div>
      </AppShell>
    );
  }

  const categories = Object.entries(summary?.byCategory || {});
  const total = categories.reduce((s, [, v]) => s + v, 0);
  let cumulative = 0;
  const segments = categories.map(([category, amount]) => {
    const start = cumulative;
    cumulative += amount;
    return { category, amount, start, end: cumulative, color: categoryColors[category] || "#8A7F6A" };
  });

  return (
    <AppShell title="Budget & Expenses" subtitle="Tracked spending for this trip">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      <div className="grid sm:grid-cols-3 gap-5 mb-8">
        <SummaryCard label="Total Budget" value={summary?.budget || 0} tone="ink" />
        <SummaryCard label="Spent" value={summary?.spent || 0} tone="sunset" />
        <SummaryCard label="Remaining" value={summary?.remaining || 0} tone="teal" />
      </div>

      <div className="w-full h-2 bg-sand rounded-full overflow-hidden mb-10">
        <div
          className="h-full bg-sunset"
          style={{ width: `${summary?.budget ? Math.min((summary.spent / summary.budget) * 100, 100) : 0}%` }}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white border border-sand rounded-2xl p-6">
          <h3 className="font-display text-lg text-ink-900 mb-6">Spending by category</h3>
          {categories.length === 0 ? (
            <p className="text-sm text-ink-900/50">No expenses logged yet.</p>
          ) : (
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
                  />
                ))}
              </svg>
              <ul className="space-y-2.5 text-sm flex-1">
                {segments.map((s) => (
                  <li key={s.category} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-ink-900/70">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      {s.category}
                    </span>
                    <span className="font-mono text-ink-900">৳{s.amount.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white border border-sand rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-lg text-ink-900">Expense log</h3>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? "Cancel" : "Add expense"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleAddExpense} className="space-y-3 mb-5 border-b border-sand pb-5">
              <select name="category" required className="input">
                <option value="">Category…</option>
                {Object.keys(categoryColors).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input name="description" type="text" placeholder="Description" required className="input" />
              <div className="grid grid-cols-2 gap-3">
                <input name="amount" type="number" min="0" placeholder="Amount (BDT)" required className="input" />
                <input name="date" type="date" className="input" />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-teal hover:bg-teal-dark disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save expense"}
              </button>
            </form>
          )}

          {expenses.length === 0 ? (
            <p className="text-sm text-ink-900/50">No expenses yet.</p>
          ) : (
            <div className="divide-y divide-sand">
              {expenses.map((e) => (
                <div key={e._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{e.description}</p>
                    <p className="text-xs text-ink-900/50">{e.category} · {new Date(e.date).toLocaleDateString()}</p>
                  </div>
                  <p className="font-mono text-sm text-ink-900">৳{e.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, tone }) {
  const toneClass = { ink: "text-ink-900", sunset: "text-sunset-dark", teal: "text-teal-dark" }[tone];
  return (
    <div className="bg-white border border-sand rounded-2xl p-6">
      <p className="text-xs font-medium text-ink-900/50 mb-2">{label}</p>
      <p className={`font-mono text-2xl font-semibold ${toneClass}`}>৳{value.toLocaleString()}</p>
    </div>
  );
}
