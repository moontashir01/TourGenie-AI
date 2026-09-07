import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle, MapPin, Globe2, Wallet, Loader2, Plane } from "lucide-react";
import AppShell from "../components/AppShell";
import { destinationsApi, referenceApi, tripsApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import PageHeroPanel from "../components/ui/PageHeroPanel";

const interests = ["Beaches", "Hills & nature", "History", "Food", "Nightlife", "Shopping", "Adventure", "Family-friendly"];

// Mirrors MAX_TRIP_DAYS / MAX_TRAVELERS in the API's trip controller. Both
// used to be enforced server-side only, so an over-long trip was rejected
// after a full round-trip instead of while the dates were being picked.
const MAX_TRIP_DAYS = 60;
const MAX_TRAVELERS = 20;

// Ground modes only exist between cities we have seeded transport for, which
// is domestic travel. Offering "Launch" for a Bangkok trip made the form look
// like it wasn't reading its own inputs.
const DOMESTIC_TRANSPORT = ["No preference", "Flight", "Bus", "Train", "Launch"];
const INTERNATIONAL_TRANSPORT = ["No preference", "Flight"];

// A half-filled trip form is a lot of typing to lose to a stray refresh or a
// tapped back button, so it is kept until the trip is actually created.
const DRAFT_KEY = "tourgenie_trip_draft";

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

const EMPTY_FORM = {
  origin_destination_id: "",
  origin: "",
  destination_id: "",
  country_code: "",
  start_date: "",
  end_date: "",
  travelers: "2",
  budget: "",
  budget_currency: "BDT",
  budget_tier: "mid",
  budget_includes_flights: true,
  transport_preference: "No preference",
  food_preference: "No preference",
  destination: "", // free-text fallback when the catalogue hasn't loaded
};

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // A draft whose start date has already passed is worse than no draft.
    if (draft?.form?.start_date && draft.form.start_date < todayISO()) return null;
    // The form saves on every keystroke, so simply opening the page once
    // writes a draft. Treating that as "the traveler has work in progress"
    // would suppress the preference prefill from then on — a draft only
    // counts once one of the trip's own answers is in it.
    const f = draft?.form || {};
    const started =
      f.destination_id || f.country_code || f.destination || f.start_date || f.end_date || f.budget;
    return started ? draft : null;
  } catch {
    return null;
  }
}

// User.preferences exists specifically to seed this form — currency, travel
// style, home city — and was being ignored, so every traveler retyped the
// same three answers on every trip.
function preferenceDefaults(user) {
  const preferences = user?.preferences || {};
  const seeded = {};
  if (preferences.currency) seeded.budget_currency = preferences.currency;
  if (preferences.default_budget_tier) seeded.budget_tier = preferences.default_budget_tier;
  if (user?.city) seeded.origin = user.city;
  return seeded;
}

/** Saved interests are free text; only chips this form offers can be shown. */
function preferredInterests(user) {
  const saved = user?.preferences?.interests || [];
  return interests.filter((i) => saved.includes(i));
}

export default function PlanTrip() {
  const navigate = useNavigate();
  const { setCurrentTripId } = useCurrentTrip();
  const { user } = useAuth();
  const draft = useRef(readDraft()).current;
  const [selectedInterests, setSelectedInterests] = useState(draft?.selectedInterests || []);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([FALLBACK_CURRENCY]);
  const [destinationMode, setDestinationMode] = useState(draft?.destinationMode || "city"); // "city" | "country"

  const [form, setForm] = useState({ ...EMPTY_FORM, ...(draft?.form || {}) });
  const [draftRestored, setDraftRestored] = useState(Boolean(draft));

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing stored to clear.
    }
    // Back to a blank form, but still the traveler's own defaults — starting
    // over shouldn't mean retyping their currency and travel style either.
    setForm({ ...EMPTY_FORM, ...preferenceDefaults(user) });
    setSelectedInterests(preferredInterests(user));
    setSelectedCities([]);
    setDestinationMode("city");
    setDraftRestored(false);
  }

  const [estimate, setEstimate] = useState(null);
  // What reaching the destination costs, and whether that is inside the
  // estimate — the form has to say so, not imply it.
  const [travel, setTravel] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");

  // Country mode: the cities of the chosen country, and which ones the
  // traveler picked. Every pick becomes mandatory for the AI plan; leaving
  // it empty lets the AI choose.
  const [countryCities, setCountryCities] = useState([]);
  const [selectedCities, setSelectedCities] = useState(draft?.selectedCities || []);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // A restored draft is the traveler's own newer choice, so it wins over
  // their saved preferences — only a blank form gets seeded.
  const prefilled = useRef(Boolean(draft));

  useEffect(() => {
    if (prefilled.current || !user) return;
    prefilled.current = true;
    setForm((prev) => ({ ...prev, ...preferenceDefaults(user) }));
    const chosen = preferredInterests(user);
    if (chosen.length) setSelectedInterests(chosen);
  }, [user]);

  // Switching country wipes the city picks — except on the very first run,
  // where a restored draft's picks would be thrown away before they render.
  const citiesRestored = useRef(Boolean(draft?.selectedCities?.length));

  useEffect(() => {
    if (citiesRestored.current) citiesRestored.current = false;
    else setSelectedCities([]);
    if (destinationMode !== "country" || !form.country_code) {
      setCountryCities([]);
      return;
    }
    destinationsApi
      .list({ country_code: form.country_code })
      .then((data) => setCountryCities(data.destinations || []))
      .catch(() => setCountryCities([]));
  }, [destinationMode, form.country_code]);

  function toggleCity(name) {
    setSelectedCities((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  const tripDays = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    const ms = new Date(form.end_date) - new Date(form.start_date);
    if (Number.isNaN(ms) || ms < 0) return 0;
    return Math.round(ms / 86400000) + 1;
  }, [form.start_date, form.end_date]);

  // Mirrors the server's allocation: the traveler's OWN days, split across
  // the picked cities in proportion to each city's typical stay — so the
  // preview shows exactly what the generated plan will do.
  const cityDaySplit = useMemo(() => {
    if (!selectedCities.length || !tripDays) return [];
    const picked = selectedCities.map((name) => countryCities.find((c) => c.name === name)).filter(Boolean);
    if (!picked.length) return [];
    const weights = picked.map((c) => Math.max(1, c.recommended_days || 1));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const alloc = picked.map((c, i) => ({
      city: c.name,
      days: Math.max(1, Math.floor((tripDays * weights[i]) / totalWeight)),
      weight: weights[i],
    }));
    let used = alloc.reduce((s, a) => s + a.days, 0);
    const byWeight = [...alloc].sort((a, b) => b.weight - a.weight);
    for (let i = 0; used < tripDays; i = (i + 1) % byWeight.length) {
      byWeight[i].days += 1;
      used += 1;
    }
    while (used > tripDays) {
      const biggest = alloc.filter((a) => a.days > 1).sort((a, b) => b.days - a.days)[0];
      if (!biggest) break;
      biggest.days -= 1;
      used -= 1;
    }
    // Same day ranges the server puts in the AI prompt.
    let cursor = 1;
    return alloc.map((a) => {
      const startDay = cursor;
      const endDay = Math.min(tripDays, cursor + a.days - 1);
      cursor = endDay + 1;
      return { ...a, startDay, endDay };
    });
  }, [selectedCities, countryCities, tripDays]);

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

  // Keep the draft in step with the form. Cleared only once a trip is
  // actually created.
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ form, selectedInterests, selectedCities, destinationMode })
      );
    } catch {
      // Private browsing / quota — losing a draft is not worth an error.
    }
  }, [form, selectedInterests, selectedCities, destinationMode]);

  // Turn the traveler's saved city into a real origin id once the catalogue
  // has loaded. Falls back to Dhaka so the field is never empty.
  useEffect(() => {
    if (!destinations.length || form.origin_destination_id) return;
    const wanted = (form.origin || "").trim().toLowerCase();
    const match =
      (wanted && destinations.find((d) => d.name.toLowerCase() === wanted)) ||
      destinations.find((d) => d.slug === "dhaka");
    if (match) setField("origin_destination_id", match._id);
  }, [destinations, form.origin, form.origin_destination_id]);

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

  const selectedOrigin = useMemo(
    () => destinations.find((d) => d._id === form.origin_destination_id) || null,
    [destinations, form.origin_destination_id]
  );
  const selectedDestination = useMemo(
    () => destinations.find((d) => d._id === form.destination_id) || null,
    [destinations, form.destination_id]
  );

  // Does this trip cross a border? Decides which transport modes are worth
  // offering, and whether an airfare warning applies.
  const crossesBorder = useMemo(() => {
    if (!selectedOrigin) return false;
    if (destinationMode === "country") {
      const country = countries.find((c) => c.country_code === form.country_code);
      return Boolean(country) && country.country_code !== selectedOrigin.country_code;
    }
    return Boolean(selectedDestination) && selectedDestination.country_code !== selectedOrigin.country_code;
  }, [selectedOrigin, selectedDestination, destinationMode, countries, form.country_code]);

  const transportOptions = crossesBorder ? INTERNATIONAL_TRANSPORT : DOMESTIC_TRANSPORT;

  // Dropping to the international list can strand a ground mode in state.
  useEffect(() => {
    if (!transportOptions.includes(form.transport_preference)) {
      setField("transport_preference", "No preference");
    }
  }, [transportOptions, form.transport_preference]);

  // Hard-stop the date picker at the server's limit rather than letting a
  // 90-day range be typed and rejected on submit.
  const maxEndDate = useMemo(() => {
    if (!form.start_date) return undefined;
    const last = new Date(form.start_date);
    if (Number.isNaN(last.getTime())) return undefined;
    last.setDate(last.getDate() + MAX_TRIP_DAYS - 1);
    return last.toISOString().slice(0, 10);
  }, [form.start_date]);

  const sameOriginAndDestination = Boolean(
    destinationMode === "city" && selectedOrigin && selectedDestination && selectedOrigin._id === selectedDestination._id
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
      // Which cities a country trip visits changes what it costs.
      preferred_cities: destinationMode === "country" ? selectedCities : [],
      // Getting there is part of the cost, so where you start from matters —
      // and so does whether the budget is meant to cover the journey.
      origin_destination_id: form.origin_destination_id,
      budget_includes_flights: form.budget_includes_flights,
      start_date: form.start_date,
      end_date: form.end_date,
      travelers: form.travelers,
      budget_tier: form.budget_tier,
    }),
    [destinationMode, form.destination_id, form.country_code, selectedCities, form.origin_destination_id, form.budget_includes_flights, form.start_date, form.end_date, form.travelers, form.budget_tier]
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
      setTravel(null);
      setEstimateError("");
      return;
    }

    const requestId = ++estimateRequest.current;
    setEstimating(true);
    const timer = setTimeout(() => {
      tripsApi
        .estimate({
          ...(estimateInputs.country_code
            ? { country_code: estimateInputs.country_code, preferred_cities: estimateInputs.preferred_cities }
            : { destination_id: estimateInputs.destination_id }),
          origin_destination_id: estimateInputs.origin_destination_id || undefined,
          budget_includes_flights: estimateInputs.budget_includes_flights,
          start_date: estimateInputs.start_date,
          end_date: estimateInputs.end_date,
          travelers: Number(estimateInputs.travelers),
          budget_tier: estimateInputs.budget_tier,
        })
        .then((data) => {
          if (requestId !== estimateRequest.current) return; // a newer request won
          setEstimate(data.estimate);
          setTravel(data.travel || null);
          setEstimateError("");
        })
        .catch((err) => {
          if (requestId !== estimateRequest.current) return;
          setEstimate(null);
          setTravel(null);
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
    if (!payload.origin) return "Please choose where you're travelling from.";
    if (!payload.destination) return "Please choose a destination.";
    if (sameOriginAndDestination) {
      return `You're already in ${payload.destination} — pick a different destination.`;
    }
    if (!payload.start_date) return "Please pick a start date.";
    if (!payload.end_date) return "Please pick an end date.";
    if (new Date(payload.end_date) < new Date(payload.start_date)) {
      return "The end date must be on or after the start date.";
    }
    if (tripDays > MAX_TRIP_DAYS) {
      return `Trips longer than ${MAX_TRIP_DAYS} days can't be planned in one go — this one is ${tripDays} days.`;
    }
    if (!Number.isInteger(payload.travelers) || payload.travelers < 1) {
      return "Number of travelers must be a whole number of at least 1.";
    }
    if (payload.travelers > MAX_TRAVELERS) {
      return `Groups larger than ${MAX_TRAVELERS} need to be planned as separate trips.`;
    }
    if (form.budget === "" || form.budget === null) return "Please enter a budget.";
    if (!Number.isFinite(payload.budget)) return "Budget must be a number.";
    if (payload.budget <= 0) return "Budget must be greater than zero.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const selectedCountry = countries.find((c) => c.country_code === form.country_code);
    const tier = TIERS.find((t) => t.value === form.budget_tier) || TIERS[1];

    const payload = {
      origin: selectedOrigin?.name || form.origin,
      origin_destination_id: form.origin_destination_id || undefined,
      start_date: form.start_date,
      end_date: form.end_date,
      travelers: Number(form.travelers),
      budget: Number(form.budget),
      budget_currency: form.budget_currency,
      budget_tier: tier.value,
      budget_includes_flights: form.budget_includes_flights,
      transport_preference: form.transport_preference,
      hotel_preference: tier.hotel,
      food_preference: form.food_preference,
      interests: selectedInterests,
      ...(destinationMode === "country"
        ? { country_code: form.country_code, destination: selectedCountry?.name, preferred_cities: selectedCities }
        : {
            destination: selectedDestination?.name || form.destination,
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
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to do — the trip exists either way.
      }
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
        <form className="lg:col-span-2 card shadow-soft p-6 md:p-8 space-y-8" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {draftRestored && (
            <div className="flex items-start justify-between gap-3 bg-teal/10 border border-teal/30 text-teal-dark text-sm rounded-lg px-3 py-2.5">
              <span>We kept what you'd filled in last time.</span>
              <button
                type="button"
                onClick={clearDraft}
                className="font-semibold underline underline-offset-2 shrink-0 hover:text-teal"
              >
                Start over
              </button>
            </div>
          )}

          <Step n={1} total={3} title="Where and when" hint="Everything below is priced off these five answers.">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Origin">
              {destinations.length ? (
                <DestinationSelect
                  name="origin_destination_id"
                  groups={destinationsByCountry}
                  value={form.origin_destination_id}
                  onChange={(e) => setField("origin_destination_id", e.target.value)}
                />
              ) : (
                <input
                  name="origin"
                  type="text"
                  className="input"
                  value={form.origin}
                  onChange={(e) => setField("origin", e.target.value)}
                />
              )}
            </Field>
            {/* Not a <Field>: this group holds several buttons as well as the
                select, and a <label> wrapping more than one control sends
                every click on its text to the first button. */}
            <fieldset className="block min-w-0">
              <legend className="text-sm font-medium text-ink-600 mb-1.5">Destination</legend>
              <div className="space-y-2">
                {multiCityCountries.length > 0 && (
                  <div className="flex gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDestinationMode("city")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
                        destinationMode === "city"
                          ? "bg-teal text-paper-fixed border-teal"
                          : "border-sand text-ink-600 hover:border-teal/40"
                      }`}
                    >
                      <MapPin className="w-3 h-3" /> One city
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationMode("country")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
                        destinationMode === "country"
                          ? "bg-teal text-paper-fixed border-teal"
                          : "border-sand text-ink-600 hover:border-teal/40"
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
                  <input
                    name="destination"
                    type="text"
                    placeholder="e.g. Bangkok or Kuala Lumpur"
                    className="input"
                    required
                    value={form.destination}
                    onChange={(e) => setField("destination", e.target.value)}
                  />
                )}

                {sameOriginAndDestination && (
                  <p className="text-sm text-sunset-dark">
                    That's where you're starting from — pick somewhere else to travel to.
                  </p>
                )}

                {destinationMode === "country" && countryCities.length > 0 && (
                  <div className="pt-1">
                    <p className="text-sm text-ink-500 mb-1.5">
                      Cities to visit — pick the ones you want (the plan will cover every pick), or leave empty and
                      the AI chooses:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {countryCities.map((c) => {
                        const picked = selectedCities.includes(c.name);
                        return (
                          <button
                            type="button"
                            key={c._id}
                            onClick={() => toggleCity(c.name)}
                            title={c.recommended_days ? `Travelers typically spend ~${c.recommended_days} day${c.recommended_days > 1 ? "s" : ""} here` : undefined}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              picked
                                ? "bg-teal text-paper-fixed border-teal"
                                : "border-sand text-ink-600 hover:border-teal/40"
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                    {selectedCities.length > 0 && (
                      <p className="text-sm text-teal-dark mt-1.5">
                        {tripDays > 0 ? (
                          <>
                            Your {tripDays} day{tripDays > 1 ? "s" : ""}: ≈{" "}
                            {cityDaySplit
                              .map((a) => `${a.city} ${a.startDay === a.endDay ? `day ${a.startDay}` : `days ${a.startDay}-${a.endDay}`}`)
                              .join(" · ")}{" "}
                            — travel between cities happens inside those days (the AI may shift a boundary day to fit
                            transport timing).
                          </>
                        ) : (
                          <>
                            The itinerary will visit all {selectedCities.length}: {selectedCities.join(", ")}. Pick
                            your travel dates to see how your days get split.
                          </>
                        )}
                      </p>
                    )}
                    {tripDays > 0 && selectedCities.length > tripDays && (
                      <p className="text-sm text-sunset-dark mt-1">
                        You picked more cities than days — add days or drop a city for a comfortable pace.
                      </p>
                    )}
                  </div>
                )}
                {destinationMode === "country" && countryCities.length === 0 && (
                  <p className="text-sm text-ink-500">
                    We'll pick which cities to visit and how to travel between them based on your trip length.
                  </p>
                )}
              </div>
            </fieldset>
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
                max={maxEndDate}
                value={form.end_date}
                onChange={(e) => setField("end_date", e.target.value)}
              />
              {tripDays > MAX_TRIP_DAYS && (
                <p className="text-sm text-sunset-dark mt-1.5">
                  {tripDays} days — trips longer than {MAX_TRIP_DAYS} days can't be planned in one go. Shorten the
                  range or split it into two trips.
                </p>
              )}
              {tripDays > 0 && tripDays <= MAX_TRIP_DAYS && (
                <p className="text-sm text-ink-500 mt-1.5">
                  {tripDays} day{tripDays > 1 ? "s" : ""}
                </p>
              )}
            </Field>
            <Field label="Number of travelers">
              <input
                name="travelers"
                type="number"
                min="1"
                max={MAX_TRAVELERS}
                step="1"
                className="input"
                value={form.travelers}
                onChange={(e) => setField("travelers", e.target.value)}
              />
              {Number(form.travelers) > MAX_TRAVELERS && (
                <p className="text-sm text-sunset-dark mt-1.5">
                  Groups larger than {MAX_TRAVELERS} need to be planned as separate trips.
                </p>
              )}
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
          </Step>

          <Step n={2} total={3} title="Budget" hint="Stored in taka; the live figure updates as you change the trip.">
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
            travel={travel}
          />
          </Step>

          <Step n={3} total={3} title="How you travel" hint="Optional — these steer what the AI picks, they don't limit it.">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Transport preference">
              <select
                name="transport_preference"
                className="input"
                value={form.transport_preference}
                onChange={(e) => setField("transport_preference", e.target.value)}
              >
                {transportOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              {crossesBorder && (
                <p className="text-sm text-ink-500 mt-1.5">
                  Crossing a border — buses, trains and launches don't run this route.
                </p>
              )}
            </Field>
            <Field label="Food preference">
              <select
                name="food_preference"
                className="input"
                value={form.food_preference}
                onChange={(e) => setField("food_preference", e.target.value)}
              >
                <option>No preference</option>
                <option>Vegetarian</option>
                <option>Halal only</option>
                <option>Seafood-focused</option>
              </select>
            </Field>
          </div>

          <div>
            <span className="text-sm font-medium text-ink-600 mb-2 block">Interests</span>
            <div className="flex flex-wrap gap-2">
              {interests.map((i) => (
                <label key={i} className="cursor-pointer">
                  <input
                    type="checkbox"
                    className="peer hidden"
                    checked={selectedInterests.includes(i)}
                    onChange={() => toggleInterest(i)}
                  />
                  <span className="text-sm px-3 py-1.5 rounded-full border border-sand text-ink-900/70 peer-checked:bg-teal peer-checked:text-paper-fixed peer-checked:border-teal transition-colors inline-block">
                    {i}
                  </span>
                </label>
              ))}
            </div>
          </div>
          </Step>

          <div className="max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:px-6 max-sm:py-4 max-sm:bg-surface/95 max-sm:backdrop-blur max-sm:border-t max-sm:border-sand max-sm:rounded-b-2xl">
            <Button type="submit" loading={submitting} icon={Sparkles} size="lg" className="w-full sm:w-auto">
              {submitting ? "Creating trip…" : "Create Trip"}
            </Button>
          </div>
        </form>

        <PageHeroPanel as="aside" className="p-6 h-fit sticky top-24">
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
        </PageHeroPanel>
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
  travel,
}) {
  const showBdt = currency.code !== "BDT" && budgetBdt > 0;
  // The estimate can't price an international hop, so say so instead of
  // letting the traveler read the figure as a full trip cost.
  const airfareMissing = Boolean(travel?.excluded_from_estimate && estimate?.has_benchmark);

  return (
    <div className="border border-sand rounded-xl p-5 space-y-4 bg-paper/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-600 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Total budget
        </span>
        {estimating && (
          <span className="text-sm text-ink-500 inline-flex items-center gap-1">
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
        <p className="text-sm text-ink-500">
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
                  ? "bg-teal text-paper-fixed border-teal"
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
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                A trip like this usually costs
              </p>
              <p className="font-display text-display-sm text-ink-900 tabular-nums leading-none">
                ৳{estimate.estimated_total.toLocaleString()}
              </p>
            </div>
            <p className="text-sm text-ink-500">
              {estimate.days}-day {estimate.tier === "mid" ? "mid-range" : estimate.tier} trip for{" "}
              {estimate.travelers} traveler{estimate.travelers > 1 ? "s" : ""} · bare minimum{" "}
              <span className="tabular-nums">৳{estimate.minimum_total.toLocaleString()}</span>
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
            {estimate.lines.map((line) => (
              <li key={line.category} className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: line.color }} />
                {line.label} ৳{line.amount.toLocaleString()}
              </li>
            ))}
          </ul>
          {travel?.counted && travel.fare > 0 && (
            <p className="text-sm text-ink-500">
              Includes the {travel.mode || "journey"} there and back
              {travel.operator ? ` (${travel.operator})` : ""} at ৳{travel.fare.toLocaleString()} per person each way.
            </p>
          )}
          {airfareMissing && (
            <p className="text-sm text-gold flex items-start gap-1.5">
              <Plane className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">Airfare is not in this figure.</span> You've said your budget covers
                the flights, so leave room for them on top — real fares are searched on the Budget page once the trip
                exists.
              </span>
            </p>
          )}
        </div>
      )}

      {estimateError && <p className="text-sm text-sunset-dark">{estimateError}</p>}

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
          <span className="block text-sm text-ink-500">
            Untick if you've already booked (or budgeted) the journey separately — it's still shown on the Budget
            page, it just stops counting against the estimate above.
          </span>
        </span>
      </label>
    </div>
  );
}

// The form is one column of eighteen controls, which is why it reads as a
// tax return rather than the first nice thing that happens in the product.
// The three groups were always there — where and when, what it costs, how you
// like to travel — they just had no edge. The rail is the cheapest way to
// show a long form has an end.
function Step({ n, total, title, hint, children }) {
  return (
    <section className="relative pl-11">
      <span
        className="absolute left-0 top-0 w-8 h-8 rounded-full bg-teal-light text-teal-dark font-display text-sm flex items-center justify-center"
        aria-hidden
      >
        {n}
      </span>
      {/* Stops short of the next disc rather than running under it, so the
          rail reads as connected instead of struck through. */}
      {n < total && <span className="absolute left-4 top-10 bottom-[-2rem] w-px bg-sand" aria-hidden />}
      <h2 className="font-display text-xl text-ink-900 leading-tight">{title}</h2>
      {hint && <p className="text-sm text-ink-500 mt-0.5">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-600 mb-1.5 block">{label}</span>
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
