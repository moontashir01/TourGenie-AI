import { useEffect, useState } from "react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SectionHeader from "../components/ui/SectionHeader";
import Stat from "../components/ui/Stat";
import { Plus, X, Plane, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import AppShell from "../components/AppShell";
import { NoTripState } from "../components/ui/States";
import Skeleton, { PanelSkeleton } from "../components/Skeleton";
import { ChartTooltip } from "../components/charts";
import { CATEGORY_COLORS, CHART_COLORS } from "../lib/chartTheme";
import { expenseApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useLanguage } from "../context/LanguageContext";

const categoryColors = CATEGORY_COLORS;

export default function Budget() {
  const { t } = useLanguage();
  const { currentTripId } = useCurrentTrip();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Which donut arc is hovered. Declared up here with the other hooks because
  // the empty/loading branches below return early.
  const [activeSlice, setActiveSlice] = useState(null);

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
      <AppShell title={t("budget.title", "Budget & Expenses")}>
        <NoTripState what="Budget & expenses" />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title={t("budget.title", "Budget & Expenses")} subtitle="Tracked spending for this trip">
        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          <PanelSkeleton lines={1} />
          <PanelSkeleton lines={1} />
          <PanelSkeleton lines={1} />
        </div>
        <Skeleton className="h-2 rounded-full mb-10" />
        <div className="grid lg:grid-cols-2 gap-8">
          <PanelSkeleton lines={6} />
          <PanelSkeleton lines={6} />
        </div>
      </AppShell>
    );
  }

  const symbol = summary?.symbol || "৳";
  // One formatter, because five places were each doing symbol + toLocaleString
  // and three of them rounded differently.
  const money = (n) => `${symbol}${Math.round(n || 0).toLocaleString()}`;
  const categories = Object.entries(summary?.byCategory || {}).filter(([, amount]) => amount > 0);
  const total = categories.reduce((s, [, v]) => s + v, 0);
  // The server has more expense categories than the six named ones, and
  // sending every extra to the same grey made "Sightseeing" and "Checkout"
  // indistinguishable. Unmapped ones take the next palette colour that isn't
  // already spoken for, so nothing collides with a named category's shade.
  const spoken = new Set(categories.map(([c]) => categoryColors[c]).filter(Boolean));
  const spare = CHART_COLORS.filter((c) => !spoken.has(c));
  let unmapped = 0;
  const segments = categories.map(([category, amount]) => ({
    category,
    amount,
    color: categoryColors[category] || spare[unmapped++ % spare.length] || "#8A7F6A",
  }));
  const active = activeSlice != null ? segments[activeSlice] : null;

  const overBudget = summary?.over_budget;
  const spentPercent = summary?.budget ? Math.min((summary.spent / summary.budget) * 100, 100) : 0;
  // How far past the budget the spend went, as a share of the budget, so the
  // overshoot is visible instead of the bar just stopping at full.
  const overPercent = summary?.budget ? Math.min((summary.overspend / summary.budget) * 100, 100) : 0;

  return (
    <AppShell title={t("budget.title", "Budget & Expenses")} subtitle="Tracked spending for this trip">
      {error && <div className="bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">{error}</div>}

      {overBudget && (
        <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/40 text-sunset-dark text-sm rounded-lg px-4 py-3 mb-6">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Over budget by <strong className="font-mono">{symbol}{summary.overspend.toLocaleString()}</strong>. Trim an
            activity, pick a cheaper hotel, or raise the budget on the trip.
          </span>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-5 mb-8">
        <Stat label="Total Budget" value={summary?.budget || 0} format={money} />
        <Stat
          label="Spent"
          value={summary?.spent || 0}
          format={money}
          tone="sunset"
          hint={`${money(summary?.logged_total || 0)} logged · ${money(summary?.estimated_total || 0)} estimated from the plan`}
        />
        <Stat
          label={overBudget ? "Over by" : "Remaining"}
          value={overBudget ? summary.overspend : summary?.remaining || 0}
          format={money}
          tone={overBudget ? "sunset" : "teal"}
        />
      </div>

      <div className="w-full h-2 bg-sand rounded-full overflow-hidden mb-2 flex">
        <div
          className={`h-full transition-[width] duration-slow ease-tg-out ${overBudget ? "bg-sunset-dark" : "bg-sunset"}`}
          style={{ width: `${spentPercent}%` }}
        />
        {overBudget && (
          <div
            className="h-full bg-sunset/40 border-l border-surface transition-[width] duration-slow ease-tg-out"
            style={{ width: `${overPercent}%` }}
          />
        )}
      </div>
      {summary?.budget_includes_flights === false && summary?.flights_excluded > 0 ? (
        <p className="text-sm text-ink-500 mb-10 inline-flex items-center gap-1">
          <Plane className="w-3 h-3" /> {money(summary.flights_excluded)} airfare tracked outside this budget
        </p>
      ) : (
        <div className="mb-10" />
      )}

      {summary?.planned_breakdown?.length > 0 && (
        <div className="card p-6 mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-lg text-ink-900">Planned split</h3>
            <p className="text-sm text-ink-500">
              What a {summary.budget_tier === "mid" ? "mid-range" : summary.budget_tier} trip like this typically costs —{" "}
              <span className="font-mono">{symbol}{summary.planned_total.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden mb-3">
            {summary.planned_breakdown.map((line) => (
              <div
                key={line.category}
                title={`${line.label}: ${symbol}${line.amount.toLocaleString()}`}
                style={{
                  width: `${(line.amount / Math.max(1, summary.planned_total)) * 100}%`,
                  background: line.color,
                }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-600">
            {summary.planned_breakdown.map((line) => (
              <li key={line.category} className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: line.color }} />
                {line.label} <span className="font-mono text-ink-900/80">{symbol}{line.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <SectionHeader title="Spending by category" count={segments.length || undefined} />
          {segments.length === 0 ? (
            <p className="text-sm text-ink-500">No expenses logged yet.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="relative w-44 h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={segments}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius="66%"
                      outerRadius="100%"
                      paddingAngle={segments.length > 1 ? 2 : 0}
                      stroke="none"
                      // Sweeps the arcs in on first paint; the slight
                      // out-easing keeps it from feeling mechanical.
                      animationBegin={120}
                      animationDuration={800}
                      animationEasing="ease-out"
                      onMouseEnter={(_, index) => setActiveSlice(index)}
                      onMouseLeave={() => setActiveSlice(null)}
                    >
                      {segments.map((s, i) => (
                        <Cell
                          key={s.category}
                          fill={s.color}
                          // The hovered arc stays full strength and the rest
                          // recede, so the centre figure has an obvious owner.
                          opacity={activeSlice === null || activeSlice === i ? 1 : 0.35}
                          style={{ transition: "opacity 150ms ease-out", outline: "none" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<ChartTooltip formatter={(v) => `${symbol}${v.toLocaleString()}`} />}
                      cursor={false}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Sits inside the donut hole; pointer-events-none so it never
                    steals the hover from the arcs underneath. */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xs uppercase tracking-wide text-ink-500 font-semibold">
                    {active ? active.category : "Spent"}
                  </span>
                  <span className="font-mono text-lg font-bold text-ink-900">
                    {symbol}{(active ? active.amount : total).toLocaleString()}
                  </span>
                  {active && (
                    <span className="text-3xs text-ink-500 font-mono">
                      {Math.round((active.amount / total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <ul className="space-y-2.5 text-sm flex-1 w-full">
                {segments.map((s, i) => (
                  <li
                    key={s.category}
                    onMouseEnter={() => setActiveSlice(i)}
                    onMouseLeave={() => setActiveSlice(null)}
                    className={`flex items-center justify-between gap-3 rounded-lg px-2 -mx-2 py-1 cursor-default transition-colors ${
                      activeSlice === i ? "bg-paper" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 text-ink-900/70 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="truncate">{s.category}</span>
                    </span>
                    <span className="font-mono text-ink-900 shrink-0">{symbol}{s.amount.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card p-6">
          <SectionHeader
            title="Expense log"
            count={expenses.length || undefined}
            action={
              <button
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:text-teal"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? "Cancel" : "Add expense"}
              </button>
            }
          />

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
              <Button type="submit" variant="teal" loading={saving} fullWidth>
                Save expense
              </Button>
            </form>
          )}

          {expenses.length === 0 ? (
            <p className="text-sm text-ink-500">No expenses yet.</p>
          ) : (
            <div className="divide-y divide-sand">
              {expenses.map((e) => (
                <div key={e._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
                      <span className="truncate">{e.description}</span>
                      {e.is_estimated && (
                        <Badge tone="outline" size="sm" className="shrink-0">Estimated</Badge>
                      )}
                    </p>
                    <p className="text-sm text-ink-500">
                      {e.category} · {new Date(e.date).toLocaleDateString()}
                      {e.counts_toward_budget === false && " · outside budget"}
                    </p>
                  </div>
                  <p
                    className={`font-mono text-sm tabular-nums shrink-0 ${
                      e.is_estimated || e.counts_toward_budget === false ? "text-ink-500" : "text-ink-900"
                    }`}
                  >
                    {money(e.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}


