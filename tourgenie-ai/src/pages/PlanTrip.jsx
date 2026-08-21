import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle, MapPin, Globe2, Wallet, Loader2, Plane } from "lucide-react";
import AppShell from "../components/AppShell";
import { destinationsApi, referenceApi, tripsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";

const interests = ["Beaches", "Hills & nature", "History", "Food", "Nightlife", "Shopping", "Adventure", "Family-friendly"];

// One control now drives both the cost model (budget_tier, which CostBenchmark
// and the hotel catalogue key off) and the wording the AI planner sees
// (hotel_preference). They used to be separate, so picking "Luxury" changed
// nothing about the estimated cost.
const TIERS = [
  { value: "budget", label: "Budget", hotel: "Budget", hint: "Guesthouses, local buses, street food" },
  { value: "mid", label: "Mid-range", hotel: "Balanced", hint: "3-star hotels, mix of taxis and buses" },
  { value: "luxury", label: "Luxury", hotel: "Luxury", hint: "4–5 star, private transfers, fine dining" },
];

const FALLBACK_CURRENCY = { code: "BDT", symbol: "৳", rate: 1, decimals: 0 };

const VERDICTS = {
  below_minimum: { tone: "bg-sunset/10 border-sunset/40 text-sunset-dark", label: "Below the minimum" },
  tight: { tone: "bg-gold/10 border-gold/40 text-ink-900", label: "Tight" },
  comfortable: { tone: "bg-teal/10 border-teal/40 text-teal-dark", label: "Comfortable" },
  generous: { tone: "bg-teal/10 border-teal/40 text-teal-dark", label: "Plenty of room" },
};

// Mirrors verdictFor() in the API's budgetEstimator so the hint updates as the
// traveler types instead of costing a request per keystroke. The server still
// decides what it will accept.
function verdictFor(budgetBdt, estimate) {
  if (!estimate?.has_benchmark || !estimate.estimated_total || !budgetBdt) return "unknown";
  if (budgetBdt < estimate.minimum_total) return "below_minimum";
  if (budgetBdt < estimate.estimated_total * 0.9) return "tight";
  if (budgetBdt > estimate.estimated_total * 1.5) return "generous";
  return "comfortable";
}

function money(amount, currency) {
  const symbol = currency?.symbol || "";
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PlanTrip() {
  const navigate = useNavigate();
  const { setCurrentTripId } = useCurrentTrip();
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([FALLBACK_CURRENCY]);
  const [destinationMode, setDestinationMode] = useState("city"); // "city" | "country"

  const [form, setForm] = useState({
    destination_id: "",
    country_code: "",
    start_date: "",
    end_date: "",
    travelers: "2",
    budget: "",
    budget_currency: "BDT",
    budget_tier: "mid",
    budget_includes_flights: true,
  });

  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    destinationsApi
      .list({ limit: 200 })
      .then((data) => {
        setDestinations(data.destinations || []);
        setCountries(data.countries || []);
      })
      .catch(() => {
        setDestinations([]);
        setCountries([]);
      });

    referenceApi
      .currencies()
      .then((data) => setCurrencies(data.currencies?.length ? data.currencies : [FALLBACK_CURRENCY]))
      .catch(() => setCurrencies([FALLBACK_CURRENCY]));
  }, []);

  const destinationsByCountry = useMemo(() => {
    return destinations.reduce((groups, destination) => {
      (groups[destination.country] ||= []).push(destination);
      return groups;
    }, {});
  }, [destinations]);

  // Only countries with 2+ seeded cities can actually support a "which
  // cities should I visit" plan — everything else stays a single-city pick.
  const multiCityCountries = useMemo(
    () => countries.filter((c) => c.destinations >= 2),
    [countries]
  );

  const currency = useMemo(
    () => currencies.find((c) => c.code === form.budget_currency) || FALLBACK_CURRENCY,
    [currencies, form.budget_currency]
  );

  const budgetBdt = useMemo(() => {
    const value = Number(form.budget);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value * (currency.rate || 1));
  }, [form.budget, currency]);

  // ── live estimate ──────────────────────────────────────────────────
  // Deliberately excludes the budget itself: the estimate only depends on
  // where, how long, how many and which tier, so typing a number doesn't
  // trigger a request. The verdict is derived locally from the result.
  const estimateInputs = useMemo(
    () => ({
      destination_id: destinationMode === "city" ? form.destination_id : "",
      country_code: destinationMode === "country" ? form.country_code : "",
      start_date: form.start_date,
      end_date: form.end_date,
      travelers: form.travelers,
      budget_tier: form.budget_tier,
    }),
    [destinationMode, form.destination_id, form.country_code, form.start_date, form.end_date, form.travelers, form.budget_tier]
  );

  const estimateRequest = useRef(0);

  useEffect(() => {
    const ready =
      (estimateInputs.destination_id || estimateInputs.country_code) &&
      estimateInputs.start_date &&
      estimateInputs.end_date &&
      Number(estimateInputs.travelers) >= 1 &&
      new Date(estimateInputs.end_date) >= new Date(estimateInputs.start_date);

    if (!ready) {
      setEstimate(null);
      setEstimateError("");
      return;
    }

    const requestId = ++estimateRequest.current;
    setEstimating(true);
    const timer = setTimeout(() => {
      tripsApi
        .estimate({
          ...(estimateInputs.country_code
            ? { country_code: estimateInputs.country_code }
            : { destination_id: estimateInputs.destination_id }),
          start_date: estimateInputs.start_date,
          end_date: estimateInputs.end_date,
          travelers: Number(estimateInputs.travelers),
          budget_tier: estimateInputs.budget_tier,
        })
        .then((data) => {
          if (requestId !== estimateRequest.current) return; // a newer request won
          setEstimate(data.estimate);
          setEstimateError("");
        })
        .catch((err) => {
          if (requestId !== estimateRequest.current) return;
          setEstimate(null);
          setEstimateError(err.message);
        })
        .finally(() => {
          if (requestId === estimateRequest.current) setEstimating(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [estimateInputs]);

  // Suggested amounts in the traveler's chosen currency, rounded to
  // something typeable rather than an exact model output.
  const presets = useMemo(() => {
    if (!estimate?.has_benchmark || !estimate.estimated_total) return [];
    const step = currency.code === "BDT" ? 500 : 10;
    const inCurrency = (bdt) => Math.max(step, Math.round(bdt / (currency.rate || 1) / step) * step);
    return [
      { label: "Lean", amount: inCurrency(estimate.minimum_total * 1.05) },
      { label: "Recommended", amount: inCurrency(estimate.estimated_total) },
      { label: "Comfortable", amount: inCurrency(estimate.estimated_total * 1.25) },
    ];
  }, [estimate, currency]);

  const verdict = verdictFor(budgetBdt, estimate);
  const verdictStyle = VERDICTS[verdict];

  function toggleInterest(i) {
    setSelectedInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  // Each field gets its own message — the old single check treated a budget
  // of 0 as "not filled in" and reported a missing destination instead.
  function validate(payload) {
    if (!payload.destination) return "Please choose a destination.";
    if (!payload.start_date) return "Please pick a start date.";
    if (!payload.end_date) return "Please pick an end date.";
    if (new Date(payload.end_date) < new Date(payload.start_date)) {
      return "The end date must be on or after the start date.";
    }
    if (!Number.isInteger(payload.travelers) || payload.travelers < 1) {
      return "Number of travelers must be a whole number of at least 1.";
    }
    if (form.budget === "" || form.budget === null) return "Please enter a budget.";
    if (!Number.isFinite(payload.budget)) return "Budget must be a number.";
    if (payload.budget <= 0) return "Budget must be greater than zero.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.target);

    const originId = formData.get("origin_destination_id");
    const selectedOrigin = destinations.find((destination) => destination._id === originId);
    const selectedDestination = destinations.find((destination) => destination._id === form.destination_id);
    const selectedCountry = countries.find((c) => c.country_code === form.country_code);
    const tier = TIERS.find((t) => t.value === form.budget_tier) || TIERS[1];

    const payload = {
      origin: selectedOrigin?.name || formData.get("origin"),
      origin_destination_id: originId || undefined,
      start_date: form.start_date,
      end_date: form.end_date,
      travelers: Number(form.travelers),
      budget: Number(form.budget),
      budget_currency: form.budget_currency,
      budget_tier: tier.value,
      budget_includes_flights: form.budget_includes_flights,
      transport_preference: formData.get("transport_preference"),
      hotel_preference: tier.hotel,
      food_preference: formData.get("food_preference"),
      interests: selectedInterests,
      ...(destinationMode === "country"
        ? { country_code: form.country_code, destination: selectedCountry?.name }
        : {
            destination: selectedDestination?.name || formData.get("destination"),
            destination_id: form.destination_id || undefined,
          }),
    };

    const problem = validate(payload);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    try {
      const { trip } = await tripsApi.create(payload);
      setCurrentTripId(trip._id);
      navigate("/itinerary");
    } catch (err) {
      setError(err.message || "Couldn't create the trip");
      if (err.details?.estimate) setEstimate(err.details.estimate);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Plan a new trip" subtitle="Fill in the basics — the AI does the rest.">
      <div className="grid lg:grid-cols-3 gap-8">
        <form className="lg:col-span-2 bg-white border border-sand rounded-2xl p-6 md:p-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Origin">
              {destinations.length ? (
                <DestinationSelect
                  name="origin_destination_id"
                  groups={destinationsByCountry}
                  defaultValue={destinations.find((destination) => destination.slug === "dhaka")?._id}
                />
              ) : (
                <input name="origin" type="text" defaultValue="Dhaka" className="input" />
              )}
            </Field>
            <Field label="Destination">
              <div className="space-y-2">
                {multiCityCountries.length > 0 && (
                  <div className="flex gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDestinationMode("city")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
                        destinationMode === "city"
                          ? "bg-teal text-white border-teal"
                          : "border-sand text-ink-900/60 hover:border-teal/40"
                      }`}
                    >
                      <MapPin className="w-3 h-3" /> One city
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationMode("country")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
                        destinationMode === "country"
                          ? "bg-teal text-white border-teal"
                          : "border-sand text-ink-900/60 hover:border-teal/40"
                      }`}
                    >
                      <Globe2 className="w-3 h-3" /> Whole country
                    </button>
                  </div>
                )}

                {destinationMode === "country" ? (
                  <select
                    name="country_code"
                    required
                    className="input"
                    value={form.country_code}
                    onChange={(e) => setField("country_code", e.target.value)}
                  >
                    <option value="">Choose a country</option>
                    {multiCityCountries.map((c) => (
                      <option key={c.country_code} value={c.country_code}>
                        {c.name} ({c.destinations} cities)
                      </option>
                    ))}
                  </select>
                ) : destinations.length ? (
                  <DestinationSelect
                    name="destination_id"
                    groups={destinationsByCountry}
                    required
                    placeholder="Choose a destination"
                    value={form.destination_id}
                    onChange={(e) => setField("destination_id", e.target.value)}
                  />
                ) : (
                  <input name="destination" type="text" placeholder="e.g. Bangkok or Kuala Lumpur" className="input" required />
                )}

                {destinationMode === "country" && (
                  <p className="text-xs text-ink-900/40">
                    We'll pick which cities to visit and how to travel between them based on your trip length.
                  </p>
                )}
              </div>
            </Field>
            <Field label="Start date">
              <input
                name="start_date"
                type="date"
                className="input"
                required
                min={todayISO()}
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
              />
            </Field>
            <Field label="End date">
              <input
                name="end_date"
                type="date"
                className="input"
                required
                min={form.start_date || todayISO()}
                value={form.end_date}
                onChange={(e) => setField("end_date", e.target.value)}
              />
            </Field>
            <Field label="Number of travelers">
              <input
                name="travelers"
                type="number"
                min="1"
                max="20"
                step="1"
                className="input"
                value={form.travelers}
                onChange={(e) => setField("travelers", e.target.value)}
              />
            </Field>
            <Field label="Travel style">
              <select
                name="budget_tier"
                className="input"
                value={form.budget_tier}
                onChange={(e) => setField("budget_tier", e.target.value)}
              >
                {TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label} — {tier.hint}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <BudgetSection
            form={form}
            setField={setField}
            currencies={currencies}
            currency={currency}
            budgetBdt={budgetBdt}
            estimate={estimate}
            estimating={estimating}
            estimateError={estimateError}
            presets={presets}
            verdict={verdict}
            verdictStyle={verdictStyle}
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Transport preference">
              <select name="transport_preference" className="input" defaultValue="No preference">
                <option>No preference</option>
                <option>Flight</option>
                <option>Bus</option>
                <option>Train</option>
                <option>Launch</option>
              </select>
            </Field>
            <Field label="Food preference">
              <select name="food_preference" className="input" defaultValue="No preference">
                <option>No preference</option>
                <option>Vegetarian</option>
                <option>Halal only</option>
                <option>Seafood-focused</option>
              </select>
            </Field>
          </div>

          <div>
            <span className="text-xs font-medium text-ink-900/60 mb-2 block">Interests</span>
            <div className="flex flex-wrap gap-2">
              {interests.map((i) => (
                <label key={i} className="cursor-pointer">
                  <input
                    type="checkbox"
                    className="peer hidden"
                    checked={selectedInterests.includes(i)}
                    onChange={() => toggleInterest(i)}
                  />
                  <span className="text-sm px-3 py-1.5 rounded-full border border-sand text-ink-900/70 peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors inline-block">
                    {i}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-sunset hover:bg-sunset-dark disabled:opacity-60 text-ink-900 font-semibold text-sm px-6 py-3 rounded-full transition-colors"
          >
            <Sparkles className="w-4 h-4" /> {submitting ? "Creating trip…" : "Create Trip"}
          </button>
        </form>

        <aside className="bg-ink-900 rounded-2xl p-6 h-fit sticky top-24">
          <Sparkles className="w-6 h-6 text-sunset mb-4" strokeWidth={1.5} />
          <h3 className="font-display text-lg text-paper mb-3">How the AI plans your trip</h3>
          <ol className="space-y-3 text-sm text-paper/60">
            <li><span className="text-sunset font-semibold">1.</span> Your parameters are matched against the curated attractions database for your destination.</li>
            <li><span className="text-sunset font-semibold">2.</span> Claude builds a day-by-day plan balancing your budget, interests, and trip length.</li>
            <li><span className="text-sunset font-semibold">3.</span> Routes, hotels, and estimated costs are attached automatically.</li>
            <li><span className="text-sunset font-semibold">4.</span> You can refine anything afterward via the AI chat assistant.</li>
          </ol>
          <p className="text-xs text-paper/40 mt-4 border-t border-ink-700 pt-4">
            Creating a trip here saves it to your dashboard — you'll generate the actual itinerary with AI on the next screen.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}

// FR-09 — the budget field, with what the trip actually costs next to it.
function BudgetSection({
  form,
  setField,
  currencies,
  currency,
  budgetBdt,
  estimate,
  estimating,
  estimateError,
  presets,
  verdict,
  verdictStyle,
}) {
  const showBdt = currency.code !== "BDT" && budgetBdt > 0;

  return (
    <div className="border border-sand rounded-xl p-5 space-y-4 bg-paper/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-900/60 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Total budget
        </span>
        {estimating && (
          <span className="text-xs text-ink-900/40 inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> pricing…
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <select
          className="input w-32 shrink-0"
          value={form.budget_currency}
          onChange={(e) => setField("budget_currency", e.target.value)}
          aria-label="Budget currency"
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol ? `${c.symbol} ` : ""}{c.code}
            </option>
          ))}
        </select>
        <input
          name="budget"
          type="number"
          min="0"
          step={currency.code === "BDT" ? "500" : "10"}
          placeholder={presets[1] ? String(presets[1].amount) : "e.g. 20000"}
          className="input flex-1"
          required
          value={form.budget}
          onChange={(e) => setField("budget", e.target.value)}
        />
      </div>

      {showBdt && (
        <p className="text-xs text-ink-900/50">
          Stored as ৳{budgetBdt.toLocaleString()} — every cost in the app is normalised to BDT.
        </p>
      )}

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setField("budget", String(preset.amount))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                String(preset.amount) === String(form.budget)
                  ? "bg-teal text-white border-teal"
                  : "border-sand text-ink-900/70 hover:border-teal/40"
              }`}
            >
              {preset.label} · {money(preset.amount, currency)}
            </button>
          ))}
        </div>
      )}

      {estimate?.has_benchmark && (
        <div className="text-sm space-y-2">
          <p className="text-ink-900/70">
            A {estimate.days}-day {estimate.tier === "mid" ? "mid-range" : estimate.tier} trip for{" "}
            {estimate.travelers} traveler{estimate.travelers > 1 ? "s" : ""} costs about{" "}
            <span className="font-mono font-semibold text-ink-900">৳{estimate.estimated_total.toLocaleString()}</span>
            {" "}— the bare minimum is ৳{estimate.minimum_total.toLocaleString()}.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-900/50">
            {estimate.lines.map((line) => (
              <li key={line.category} className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: line.color }} />
                {line.label} ৳{line.amount.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estimateError && <p className="text-xs text-sunset-dark">{estimateError}</p>}

      {verdictStyle && budgetBdt > 0 && (
        <div className={`text-xs rounded-lg border px-3 py-2 ${verdictStyle.tone}`}>
          <span className="font-semibold">{verdictStyle.label}.</span>{" "}
          {verdict === "below_minimum" &&
            `৳${budgetBdt.toLocaleString()} won't cover beds, food and local transport for this trip.`}
          {verdict === "tight" && "Doable, but expect to cut back on activities or rooms."}
          {verdict === "comfortable" && "This lines up with what the trip typically costs."}
          {verdict === "generous" && "You've got room for upgrades — consider the next travel style up."}
        </div>
      )}

      <label className="flex items-start gap-2.5 text-sm text-ink-900/70 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 accent-teal"
          checked={form.budget_includes_flights}
          onChange={(e) => setField("budget_includes_flights", e.target.checked)}
        />
        <span>
          <span className="inline-flex items-center gap-1.5 font-medium text-ink-900">
            <Plane className="w-3.5 h-3.5" /> This budget covers the flights in and out
          </span>
          <span className="block text-xs text-ink-900/50">
            Untick if you've already booked (or budgeted) airfare separately — the fare is still shown on the Budget
            page, it just won't count against this number.
          </span>
        </span>
      </label>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function DestinationSelect({ groups, placeholder, ...props }) {
  return (
    <select className="input" {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {Object.entries(groups).map(([country, countryDestinations]) => (
        <optgroup key={country} label={country}>
          {countryDestinations.map((destination) => (
            <option key={destination._id} value={destination._id}>
              {destination.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
