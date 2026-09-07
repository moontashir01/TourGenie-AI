import { useEffect, useMemo, useState } from "react";
import {
  User as UserIcon, Mail, Phone, MapPin, CalendarDays, Globe2, Languages, Wallet,
  Compass, Bell, Lock, Check, AlertCircle, Loader2, ShieldCheck, ShieldAlert,
  Sun, Moon, Monitor, Palette,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { authApi, destinationsApi, referenceApi, setToken } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import Button from "../components/ui/Button";
import DataRow from "../components/ui/DataRow";

// The interest chips the Plan Trip form offers. Saved interests pre-fill that
// form, so the two lists have to agree — a chip that isn't there can never be
// shown back to the traveller.
const INTERESTS = [
  "Beaches", "Hills & nature", "History", "Food",
  "Nightlife", "Shopping", "Adventure", "Family-friendly",
];

const TIERS = [
  { value: "budget", label: "Budget", hint: "Guesthouses, local buses, street food" },
  { value: "mid", label: "Mid-range", hint: "Comfortable hotels, mixed transport" },
  { value: "luxury", label: "Luxury", hint: "Top-end stays, private transfers" },
];

const THEMES = [
  { value: "light", label: "Light", icon: Sun, hint: "Warm paper, the original look" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Ink background, easier at night" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow your device setting" },
];

const NOTIFY = [
  { key: "notify_departure", label: "Departure reminders", hint: "Countdown and packing nudges before you leave" },
  { key: "notify_weather", label: "Weather alerts", hint: "Rain or heat on a day you planned something outdoors" },
  { key: "notify_budget", label: "Budget warnings", hint: "When spending is tracking past what you set aside" },
];

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="card p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="w-9 h-9 rounded-xl bg-teal-light flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-teal-dark" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-lg text-ink-900 leading-snug">{title}</h2>
          <p className="text-sm text-ink-600 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-600 mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-500" />}
        {label}
      </span>
      {children}
    </label>
  );
}

// One banner per section rather than one for the page: saving preferences
// shouldn't clear the message the profile save just wrote.
function Banner({ error, success }) {
  if (!error && !success) return null;
  const isError = Boolean(error);
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 mb-4 ${
        isError
          ? "bg-sunset/10 border border-sunset/30 text-sunset-dark"
          : "bg-teal/10 border border-teal/30 text-teal-dark"
      }`}
    >
      {isError ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <Check className="w-4 h-4 shrink-0 mt-0.5" />}
      <span>{error || success}</span>
    </div>
  );
}

export default function Settings() {
  const { user, applyUser } = useAuth();
  const { lang, setLang, languages } = useLanguage();
  // ThemeContext saves to the account itself, so this section has no save
  // button — picking is the save.
  const { theme, resolved, setTheme } = useTheme();

  const [countries, setCountries] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // Each card saves on its own, so each carries its own state.
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState({ saving: false, error: "", success: "" });

  const [prefs, setPrefs] = useState(null);
  const [prefsState, setPrefsState] = useState({ saving: false, error: "", success: "" });

  const [notify, setNotify] = useState(null);
  const [notifyState, setNotifyState] = useState({ saving: false, error: "", success: "" });

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordState, setPasswordState] = useState({ saving: false, error: "", success: "" });

  // Seed the forms once the account has loaded.
  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name || "",
      phone: user.phone || "",
      city: user.city || "",
      date_of_birth: toDateInput(user.date_of_birth),
      country_code: user.country_code || "BD",
      language: user.language || lang,
    });
    setPrefs({
      currency: user.preferences?.currency || "BDT",
      default_budget_tier: user.preferences?.default_budget_tier || "mid",
      interests: user.preferences?.interests || [],
    });
    setNotify({
      notify_departure: user.preferences?.notify_departure !== false,
      notify_weather: user.preferences?.notify_weather !== false,
      notify_budget: user.preferences?.notify_budget !== false,
    });
    // Only on identity change — retyping in a field must not be overwritten
    // by a re-render of the same account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    destinationsApi
      .list({ limit: 1 })
      .then(({ countries: rows }) => setCountries((rows || []).filter((c) => c.is_core)))
      .catch(() => setCountries([]));
    referenceApi
      .currencies()
      .then(({ currencies: rows }) => setCurrencies(rows || []))
      .catch(() => setCurrencies([]));
  }, []);

  const memberSince = useMemo(
    () => (user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"),
    [user?.created_at]
  );

  async function save(payload, setState, successText, after) {
    setState({ saving: true, error: "", success: "" });
    try {
      const { user: updated } = await authApi.updateMe(payload);
      applyUser(updated);
      after?.(updated);
      setState({ saving: false, error: "", success: successText });
    } catch (err) {
      setState({ saving: false, error: err.message || "Couldn't save", success: "" });
    }
  }

  function saveProfile(e) {
    e.preventDefault();
    save(
      {
        name: profile.name,
        phone: profile.phone,
        city: profile.city,
        date_of_birth: profile.date_of_birth || null,
        country_code: profile.country_code,
        language: profile.language,
      },
      setProfileState,
      "Profile saved.",
      // The switcher reads localStorage, so the saved language has to be
      // pushed into it or the UI keeps the old one until the next visit.
      (updated) => updated.language !== lang && setLang(updated.language)
    );
  }

  function savePrefs(e) {
    e.preventDefault();
    save({ preferences: prefs }, setPrefsState, "Travel preferences saved — the Plan Trip form will use them.");
  }

  function toggleNotify(key) {
    const next = { ...notify, [key]: !notify[key] };
    setNotify(next);
    save({ preferences: next }, setNotifyState, "Notification settings saved.");
  }

  function toggleInterest(interest) {
    setPrefs((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  }

  async function changePassword(e) {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setPasswordState({ saving: false, error: "The new passwords don't match", success: "" });
      return;
    }
    setPasswordState({ saving: true, error: "", success: "" });
    try {
      const { message, token } = await authApi.changePassword(passwords.current, passwords.next);
      // The change signs every session on the account out, this one included.
      // The replacement token keeps the tab that did it signed in.
      setToken(token);
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordState({ saving: false, error: "", success: message });
    } catch (err) {
      setPasswordState({ saving: false, error: err.message || "Couldn't change the password", success: "" });
    }
  }

  if (!user || !profile || !prefs || !notify) {
    return (
      <AppShell title="Account settings" subtitle="Your profile, travel preferences and password.">
        <div className="flex items-center gap-2 text-ink-500 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your account…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Account settings" subtitle="Your profile, travel preferences and password.">
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Section
            icon={UserIcon}
            title="Profile"
            description="How you're addressed, and where you're travelling from."
          >
            <Banner error={profileState.error} success={profileState.success} />
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name" icon={UserIcon}>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Email" icon={Mail}>
                  <input type="email" value={user.email} disabled className="input opacity-60 cursor-not-allowed" />
                  <span className="text-2xs text-ink-500 mt-1 block">
                    Your email is your login — it can't be changed here.
                  </span>
                </Field>
                <Field label="Phone" icon={Phone}>
                  <input
                    type="tel"
                    maxLength={32}
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+880…"
                    className="input"
                  />
                </Field>
                <Field label="Home city" icon={MapPin}>
                  <input
                    type="text"
                    maxLength={80}
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="Dhaka"
                    className="input"
                  />
                  <span className="text-2xs text-ink-500 mt-1 block">
                    Pre-fills the "travelling from" box when you plan a trip.
                  </span>
                </Field>
                <Field label="Date of birth" icon={CalendarDays}>
                  <input
                    type="date"
                    max={toDateInput(Date.now())}
                    value={profile.date_of_birth}
                    onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Home country" icon={Globe2}>
                  <select
                    value={profile.country_code}
                    onChange={(e) => setProfile({ ...profile, country_code: e.target.value })}
                    className="input"
                  >
                    {countries.length === 0 && <option value={profile.country_code}>{user.country}</option>}
                    {countries.map((c) => (
                      <option key={c.country_code} value={c.country_code}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Language" icon={Languages}>
                  <select
                    value={profile.language}
                    onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                    className="input"
                  >
                    {languages.length === 0 && <option value={profile.language}>{profile.language}</option>}
                    {languages.map((l) => (
                      <option key={l.lang} value={l.lang}>
                        {l.flag ? `${l.flag} ` : ""}{l.native_label}
                      </option>
                    ))}
                  </select>
                  <span className="text-2xs text-ink-500 mt-1 block">
                    Saved to your account, so it follows you to another device.
                  </span>
                </Field>
              </div>
              <Button type="submit" loading={profileState.saving}>
                {profileState.saving ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </Section>

          <Section
            icon={Compass}
            title="Travel preferences"
            description="Your usual answers, filled in for you every time you plan a trip."
          >
            <Banner error={prefsState.error} success={prefsState.success} />
            <form onSubmit={savePrefs} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Preferred currency" icon={Wallet}>
                  <select
                    value={prefs.currency}
                    onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}
                    className="input"
                  >
                    {currencies.length === 0 && <option value={prefs.currency}>{prefs.currency}</option>}
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-2xs text-ink-500 mt-1 block">
                    The currency your budget is entered in. Costs are still stored and totalled in BDT.
                  </span>
                </Field>
              </div>

              <div>
                <span className="text-sm font-medium text-ink-600 mb-2 block">Travel style</span>
                <div className="grid sm:grid-cols-3 gap-2">
                  {TIERS.map((tier) => {
                    const active = prefs.default_budget_tier === tier.value;
                    return (
                      <button
                        key={tier.value}
                        type="button"
                        onClick={() => setPrefs({ ...prefs, default_budget_tier: tier.value })}
                        aria-pressed={active}
                        className={`text-left px-3.5 py-3 rounded-xl border transition ${
                          active
                            ? "border-teal bg-teal-light shadow-soft"
                            : "border-sand bg-paper hover:border-teal/40"
                        }`}
                      >
                        <span className={`block text-sm font-semibold ${active ? "text-teal-dark" : "text-ink-900"}`}>
                          {tier.label}
                        </span>
                        <span className="block text-2xs text-ink-500 leading-snug mt-0.5">{tier.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-ink-600 mb-2 block">
                  Interests <span className="text-ink-500">— the AI plans around these</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const active = prefs.interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        aria-pressed={active}
                        className={`text-sm px-3.5 py-1.5 rounded-full border transition ${
                          active
                            ? "bg-ink-900 border-ink-900 text-paper"
                            : "bg-paper border-sand text-ink-900/70 hover:border-teal/50"
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button type="submit" loading={prefsState.saving}>
                {prefsState.saving ? "Saving…" : "Save preferences"}
              </Button>
            </form>
          </Section>

          <Section
            icon={Palette}
            title="Appearance"
            description="Applies instantly and is saved to your account, so it follows you to another browser."
          >
            <div className="grid sm:grid-cols-3 gap-2">
              {THEMES.map(({ value, label, icon: Icon, hint }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={active}
                    className={`text-left px-3.5 py-3 rounded-xl border transition ${
                      active ? "border-teal bg-teal-light shadow-soft" : "border-sand bg-paper hover:border-teal/40"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mb-1.5 ${active ? "text-teal-dark" : "text-ink-500"}`}
                      strokeWidth={1.75}
                    />
                    <span className={`block text-sm font-semibold ${active ? "text-teal-dark" : "text-ink-900"}`}>
                      {label}
                    </span>
                    <span className="block text-2xs text-ink-500 leading-snug mt-0.5">{hint}</span>
                  </button>
                );
              })}
            </div>
            {theme === "system" && (
              <p className="text-2xs text-ink-500 mt-3">
                Your device is currently asking for {resolved} mode.
              </p>
            )}
          </Section>

          <Section
            icon={Bell}
            title="Notifications"
            description="Which reminders the bell is allowed to raise. Saved as you switch them."
          >
            <Banner error={notifyState.error} success={notifyState.success} />
            <div className="divide-y divide-sand">
              {NOTIFY.map(({ key, label, hint }) => (
                <div key={key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{label}</p>
                    <p className="text-sm text-ink-500 leading-snug mt-0.5">{hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notify[key]}
                    aria-label={label}
                    disabled={notifyState.saving}
                    onClick={() => toggleNotify(key)}
                    className={`w-11 h-6 rounded-full shrink-0 relative transition-colors disabled:opacity-60 ${
                      notify[key] ? "bg-teal" : "bg-sand"
                    }`}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow-sm transition-transform"
                      style={{ transform: notify[key] ? "translateX(20px)" : "translateX(0)" }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            icon={Lock}
            title="Password"
            description="Change it here while you're logged in. Forgotten it? Log out and use the reset code."
          >
            <Banner error={passwordState.error} success={passwordState.success} />
            <form onSubmit={changePassword} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Current password" icon={Lock}>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="New password" icon={Lock}>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={passwords.next}
                    onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Confirm new password" icon={Lock}>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
              <p className="text-2xs text-ink-500">
                At least 6 characters. Changing it cancels any reset code you've been emailed.
              </p>
              <Button type="submit" loading={passwordState.saving}>
                {passwordState.saving ? "Changing…" : "Change password"}
              </Button>
            </form>
          </Section>
        </div>

        <aside className="card p-6 lg:sticky lg:top-6">
          <h2 className="font-display text-lg text-ink-900 mb-4">Account</h2>
          <dl className="space-y-3.5 text-sm">
            <DataRow stacked label="Email" value={user.email} />
            <DataRow stacked label="Role" value={user.role} className="capitalize" />
            <DataRow stacked label="Member since" value={memberSince} />
            <DataRow
              stacked
              label="Last login"
              value={user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "This session"}
            />
          </dl>

          <div
            className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 mt-5 ${
              user.email_verified ? "bg-teal/10 text-teal-dark" : "bg-gold/15 text-ink-800"
            }`}
          >
            {user.email_verified ? (
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
            )}
            <span>
              {user.email_verified
                ? "Email verified."
                : "Email not verified yet — reset codes still reach this address."}
            </span>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
