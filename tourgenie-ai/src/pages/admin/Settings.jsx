import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Check, Plus, Trash2, Search, Languages, Bell, SlidersHorizontal } from "lucide-react";
import { adminApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { ErrorBanner } from "../../components/admin/ListShell";

// Phase 5 — the three collections that are configuration rather than
// catalogue, and had no screen at all: the limits the app enforces, the copy
// of every notification, and the UI string tables. Changing any of them meant
// editing a seed file and re-running the seed, which on a shared database
// rewrites everything else too.

const SECTIONS = [
  { key: "settings", label: "App settings", icon: SlidersHorizontal },
  { key: "notifications", label: "Notification copy", icon: Bell },
  { key: "translations", label: "Translations", icon: Languages },
];

export default function Settings() {
  const [section, setSection] = useState("settings");
  const Active = { settings: AppSettings, notifications: NotificationTemplates, translations: Translations }[section];

  return (
    <div className="space-y-5">
      {/* Said once, up front: all three of these collections are replaced
          wholesale by `npm run seed`, so an edit here is lost on the next
          reseed unless it is also made in the seed data. */}
      <p className="text-xs text-ink-900/50 bg-paper border border-sand rounded-lg px-4 py-2.5">
        Changes take effect immediately. They are overwritten the next time the database is reseeded — anything
        permanent belongs in the seed data as well.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={`inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-full border transition-colors ${
              section === s.key
                ? "bg-ink-900 border-ink-900 text-paper"
                : "bg-surface border-sand text-ink-900/70 hover:border-teal/50"
            }`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}

// ── app settings ─────────────────────────────────────────────────────

const GROUP_BLURB = {
  limits: "Enforced server-side. booking.max_passengers and booking.service_charge_bdt are read on every booking.",
  features: "Feature switches read at runtime.",
  ai: "The order providers are tried in. Not sent to the browser.",
  general: "Defaults for new accounts and trips.",
};

function AppSettings() {
  const { user } = useAuth();
  const canEdit = user?.role === "owner";

  const [groups, setGroups] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.settings
      .list()
      .then((data) => setGroups(data.groups || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function draftFor(setting) {
    if (drafts[setting.key] !== undefined) return drafts[setting.key];
    // An array setting is edited one entry per line; everything else is
    // shown as it is stored.
    if (setting.type === "array") return (setting.value || []).join("\n");
    if (setting.type === "json") return JSON.stringify(setting.value, null, 2);
    return setting.value;
  }

  async function save(setting) {
    setSaving(setting.key);
    setError("");
    try {
      const { setting: updated } = await adminApi.settings.update(setting.key, draftFor(setting));
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          rows: group.rows.map((row) => (row.key === updated.key ? { ...row, value: updated.value } : row)),
        }))
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[setting.key];
        return next;
      });
      setSaved(setting.key);
      setTimeout(() => setSaved(""), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }

  if (loading) return <Loading label="Loading settings…" />;

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {!canEdit && (
        <p className="text-sm text-ink-900/60 bg-paper border border-sand rounded-lg px-4 py-3">
          These change how the app behaves for everyone, so only an owner can edit them.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.group} className="card p-6">
          <h3 className="font-display text-lg text-ink-900 mb-1 capitalize">{group.group}</h3>
          <p className="text-sm text-ink-900/55 mb-5">{GROUP_BLURB[group.group] || ""}</p>

          <div className="space-y-5">
            {group.rows.map((setting) => {
              const dirty = drafts[setting.key] !== undefined;
              return (
                <div key={setting.key} className="border-b border-sand/70 last:border-0 pb-5 last:pb-0">
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium text-ink-900">{setting.label || setting.key}</span>
                    <code className="text-2xs text-ink-900/40 font-mono">{setting.key}</code>
                    {!setting.is_editable && (
                      <span className="text-3xs uppercase tracking-wide font-semibold bg-sand text-ink-900/55 px-2 py-0.5 rounded-full">
                        fixed
                      </span>
                    )}
                    {!setting.is_public && (
                      <span className="text-3xs uppercase tracking-wide font-semibold bg-sand text-ink-900/55 px-2 py-0.5 rounded-full">
                        server only
                      </span>
                    )}
                  </div>
                  {setting.description && (
                    <p className="text-xs text-ink-900/50 mb-2.5">{setting.description}</p>
                  )}

                  <div className="flex flex-wrap items-start gap-2">
                    <SettingInput
                      setting={setting}
                      value={draftFor(setting)}
                      disabled={!canEdit || !setting.is_editable}
                      onChange={(v) => setDrafts((prev) => ({ ...prev, [setting.key]: v }))}
                    />
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => save(setting)}
                        disabled={saving === setting.key}
                        className="btn-primary text-xs py-2"
                      >
                        {saving === setting.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </button>
                    )}
                    {saved === setting.key && (
                      <span className="inline-flex items-center gap-1 text-xs text-teal-dark py-2">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingInput({ setting, value, disabled, onChange }) {
  if (setting.type === "boolean") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(value)}
        aria-label={setting.label || setting.key}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-40 ${value ? "bg-teal" : "bg-sand"}`}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow-sm transition-transform"
          style={{ transform: value ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    );
  }

  if (setting.type === "array" || setting.type === "json") {
    return (
      <textarea
        rows={setting.type === "json" ? 5 : Math.min(6, String(value).split("\n").length + 1)}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={setting.label || setting.key}
        className="flex-1 min-w-64 text-sm font-mono bg-paper border border-sand rounded-lg px-3 py-2 focus:outline-none focus:border-teal disabled:opacity-50 resize-y"
      />
    );
  }

  return (
    <input
      type={setting.type === "number" ? "number" : "text"}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(setting.type === "number" ? e.target.value : e.target.value)}
      aria-label={setting.label || setting.key}
      className="input max-w-xs disabled:opacity-50"
    />
  );
}

// ── notification templates ───────────────────────────────────────────

const BLANK_TEMPLATE = {
  code: "",
  type: "departure",
  label: "",
  title_template: "",
  message_template: "",
  severity: "info",
  icon: "Bell",
  action_url: "",
  is_active: true,
  trigger: { event: "trip_start_approaching", offset_hours: 0, threshold: null, weather_conditions: [] },
};

function NotificationTemplates() {
  const { user } = useAuth();
  const canWrite = ["admin", "owner"].includes(user?.role);
  const canDelete = user?.role === "owner";

  const [templates, setTemplates] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    return adminApi.notificationTemplates
      .list()
      .then((data) => {
        setTemplates(data.templates || []);
        setPlaceholders(data.placeholders || []);
        setEvents(data.events || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing._id) await adminApi.notificationTemplates.update(editing._id, editing);
      else await adminApi.notificationTemplates.create(editing);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(template) {
    try {
      await adminApi.notificationTemplates.update(template._id, { is_active: !template.is_active });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(template) {
    if (!window.confirm(`Remove the "${template.code}" rule? Notifications already sent are unaffected.`)) return;
    try {
      await adminApi.notificationTemplates.remove(template._id, "Removed from the settings screen");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <Loading label="Loading notification rules…" />;

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h3 className="font-display text-lg text-ink-900">Notification rules</h3>
          {canWrite && (
            <button type="button" onClick={() => setEditing({ ...BLANK_TEMPLATE })} className="btn-primary">
              <Plus className="w-4 h-4" /> New rule
            </button>
          )}
        </div>
        <p className="text-sm text-ink-900/55 mb-5">
          The engine reads these on every sweep, so an edit changes the next notification anyone receives.
          <span className="block mt-1">
            <strong className="font-semibold text-ink-900/70">Fired</strong> counts the last 30 days over all
            time — a rule sitting at <span className="font-mono text-xs">never</span> is one whose trigger has
            not matched anybody's data yet.
          </span>
          Placeholders: <span className="font-mono text-xs">{placeholders.join(" ")}</span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-900/50 border-b border-sand">
                <th className="pb-3 font-medium">Code</th>
                <th className="pb-3 font-medium">Fires on</th>
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Severity</th>
                {/* A rule can be active, read sensibly and never match
                    anything — weather_cold at 12°C will not fire for a
                    Bangladeshi destination in any month. This is the only
                    place that shows it. */}
                <th className="pb-3 font-medium">Fired</th>
                <th className="pb-3 font-medium">Active</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {templates.map((template) => (
                <tr key={template._id}>
                  <td className="py-3 font-mono text-xs text-ink-900/70">{template.code}</td>
                  <td className="py-3 text-ink-900/60 text-xs">
                    {template.trigger?.event}
                    {template.trigger?.offset_hours ? ` · ${template.trigger.offset_hours}h` : ""}
                    {template.trigger?.threshold != null ? ` · ${template.trigger.threshold}` : ""}
                  </td>
                  <td className="py-3 text-ink-900/70 max-w-xs truncate" title={template.title_template}>
                    {template.title_template}
                  </td>
                  <td className="py-3 text-ink-900/60 capitalize">{template.severity}</td>
                  <td className="py-3 text-xs tabular-nums whitespace-nowrap">
                    {template.fired_total > 0 ? (
                      <span
                        className="text-ink-900/70"
                        title={
                          template.last_fired_at
                            ? `Last fired ${new Date(template.last_fired_at).toLocaleString()}`
                            : undefined
                        }
                      >
                        {template.fired_last_30d}
                        <span className="text-ink-900/35"> / {template.fired_total}</span>
                      </span>
                    ) : (
                      <span className="text-ink-900/35">never</span>
                    )}
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={template.is_active}
                      aria-label={`${template.code} active`}
                      disabled={!canWrite}
                      onClick={() => toggleActive(template)}
                      className={`w-9 h-5 rounded-full relative transition-colors disabled:opacity-40 ${
                        template.is_active ? "bg-teal" : "bg-sand"
                      }`}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface shadow-sm transition-transform"
                        style={{ transform: template.is_active ? "translateX(16px)" : "translateX(0)" }}
                      />
                    </button>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(template)}
                        disabled={!canWrite}
                        className="text-xs font-semibold text-ink-900/60 hover:text-teal-dark disabled:opacity-30"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(template)}
                        disabled={!canDelete}
                        title={canDelete ? "Remove" : "Owner only"}
                        className="text-ink-900/40 hover:text-sunset-dark disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <form onSubmit={save} className="card p-6 space-y-4">
          <h4 className="font-display text-base text-ink-900">
            {editing._id ? `Edit ${editing.code}` : "New notification rule"}
          </h4>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Code" hint="Unique, e.g. departure_24h">
              <input
                required
                value={editing.code}
                disabled={Boolean(editing._id)}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                className="input disabled:opacity-60"
              />
            </Field>
            <Field label="Label">
              <input
                value={editing.label || ""}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Fires on">
              <select
                value={editing.trigger?.event || ""}
                onChange={(e) => setEditing({ ...editing, trigger: { ...editing.trigger, event: e.target.value } })}
                className="input"
              >
                {events.map((event) => (
                  <option key={event} value={event}>
                    {event}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hours before" hint="0 for events that fire when they happen">
              <input
                type="number"
                value={editing.trigger?.offset_hours ?? 0}
                onChange={(e) =>
                  setEditing({ ...editing, trigger: { ...editing.trigger, offset_hours: Number(e.target.value) } })
                }
                className="input"
              />
            </Field>
            <Field label="Threshold" hint="% of budget, or days to expiry — blank if unused">
              <input
                type="number"
                value={editing.trigger?.threshold ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    trigger: {
                      ...editing.trigger,
                      threshold: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
                className="input"
              />
            </Field>
            <Field label="Severity">
              <select
                value={editing.severity}
                onChange={(e) => setEditing({ ...editing, severity: e.target.value })}
                className="input"
              >
                {["info", "reminder", "warning", "critical"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" wide hint={placeholders.join("  ")}>
              <input
                required
                value={editing.title_template}
                onChange={(e) => setEditing({ ...editing, title_template: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Message" wide>
              <textarea
                required
                rows={3}
                value={editing.message_template}
                onChange={(e) => setEditing({ ...editing, message_template: e.target.value })}
                className="w-full text-sm bg-paper border border-sand rounded-lg px-3 py-2.5 focus:outline-none focus:border-teal resize-none"
              />
            </Field>
            <Field label="Action link" hint="Where the notification takes you, e.g. /itinerary">
              <input
                value={editing.action_url || ""}
                onChange={(e) => setEditing({ ...editing, action_url: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : editing._id ? "Save changes" : "Create rule"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── translations ─────────────────────────────────────────────────────

function Translations() {
  const { user } = useAuth();
  const canWrite = ["admin", "owner"].includes(user?.role);

  const [languages, setLanguages] = useState([]);
  const [lang, setLang] = useState("bn");
  const [entries, setEntries] = useState([]);
  const [orphans, setOrphans] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [term, setTerm] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    adminApi.translations
      .list()
      .then((data) => setLanguages(data.languages || []))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setDrafts({});
    adminApi.translations
      .get(lang)
      .then((data) => {
        setEntries(data.entries || []);
        setOrphans(data.orphans || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [lang]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return entries.filter((entry) => {
      if (missingOnly && !entry.missing) return false;
      if (!needle) return true;
      return (
        entry.key.toLowerCase().includes(needle) ||
        entry.english.toLowerCase().includes(needle) ||
        entry.value.toLowerCase().includes(needle)
      );
    });
  }, [entries, term, missingOnly]);

  const dirtyCount = Object.keys(drafts).length;
  const current = languages.find((l) => l.lang === lang);

  // A null value is how the server removes a key rather than blanking it.
  async function dropOrphan(key) {
    try {
      await adminApi.translations.update(lang, { strings: { [key]: null }, reason: "Removed an orphan key" });
      setOrphans((prev) => prev.filter((k) => k !== key));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveAll() {
    setSaving(true);
    setError("");
    try {
      const { completeness_pct, updated } = await adminApi.translations.update(lang, { strings: drafts });
      setEntries((prev) =>
        prev.map((entry) =>
          drafts[entry.key] === undefined
            ? entry
            : { ...entry, value: drafts[entry.key], missing: !String(drafts[entry.key]).trim() }
        )
      );
      setLanguages((prev) =>
        prev.map((l) => (l.lang === lang ? { ...l, completeness_pct } : l))
      );
      setDrafts({});
      setNotice(`${updated} string${updated === 1 ? "" : "s"} saved. Travellers see it on their next page load.`);
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} onDismiss={() => setError("")} />
      {notice && (
        <div className="bg-teal-light border border-teal/30 text-teal-dark text-sm rounded-lg px-4 py-3">{notice}</div>
      )}

      <div className="card p-6">
        <h3 className="font-display text-lg text-ink-900 mb-1">UI strings</h3>
        <p className="text-sm text-ink-900/55 mb-5">
          English is the source. A key left blank falls back to the English copy rather than rendering a bare key
          name, so a partial translation is safe to save.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {languages.map((l) => (
            <button
              key={l.lang}
              type="button"
              onClick={() => setLang(l.lang)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
                lang === l.lang
                  ? "bg-ink-900 border-ink-900 text-paper"
                  : "bg-paper border-sand text-ink-900/70 hover:border-teal/50"
              }`}
            >
              {l.flag} {l.native_label}
              <span className={`ml-1.5 text-xs ${lang === l.lang ? "text-paper/60" : "text-ink-900/40"}`}>
                {l.completeness_pct}%
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="flex items-center gap-2 flex-1 min-w-56 bg-paper border border-sand rounded-lg px-3 focus-within:border-teal">
            <Search className="w-4 h-4 text-ink-900/30 shrink-0" />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search key or text…"
              className="bg-transparent text-sm text-ink-900 py-2 w-full focus:outline-none placeholder:text-ink-900/30"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-900/70">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
              className="accent-teal"
            />
            Untranslated only
          </label>
          <span className="text-xs text-ink-900/45 ml-auto tabular-nums">
            {filtered.length} of {entries.length}
            {current && ` · ${current.completeness_pct}% complete`}
          </span>
        </div>

        {dirtyCount > 0 && (
          <div className="flex items-center gap-3 bg-paper border border-sand rounded-xl px-4 py-2.5 mb-4">
            <span className="text-sm text-ink-900/70">
              {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
            </span>
            <button type="button" onClick={saveAll} disabled={saving || !canWrite} className="btn-primary text-xs py-2 ml-auto">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
            <button type="button" onClick={() => setDrafts({})} className="text-xs text-ink-900/45 hover:text-ink-900">
              Discard
            </button>
          </div>
        )}

        {loading ? (
          <Loading label="Loading strings…" />
        ) : (
          <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
            {filtered.map((entry) => (
              <div key={entry.key} className="grid sm:grid-cols-2 gap-2 items-start border-b border-sand/60 pb-3">
                <div className="min-w-0">
                  <code className="text-2xs font-mono text-ink-900/45 block truncate">{entry.key}</code>
                  <p className="text-sm text-ink-900/70">{entry.english || <span className="text-ink-900/30">—</span>}</p>
                </div>
                <input
                  value={drafts[entry.key] ?? entry.value}
                  disabled={!canWrite}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [entry.key]: e.target.value }))}
                  placeholder={entry.missing ? "Not translated" : ""}
                  className={`input text-sm disabled:opacity-60 ${
                    entry.missing && drafts[entry.key] === undefined ? "border-gold/50" : ""
                  }`}
                />
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-ink-900/50 text-center py-8">No strings match that.</p>
            )}
          </div>
        )}

        {orphans.length > 0 && (
          <div className="mt-5 pt-4 border-t border-sand">
            <p className="text-xs text-ink-900/50 mb-2">
              {orphans.length} key{orphans.length === 1 ? "" : "s"} this language has that English doesn't. Usually a
              typo in a key name — nothing ever asks for them, so they are invisible in the app.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {orphans.map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 text-2xs font-mono bg-paper border border-sand rounded-full pl-2.5 pr-1.5 py-1 text-ink-900/60"
                >
                  {key}
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => dropOrphan(key)}
                    aria-label={`Remove ${key}`}
                    className="text-ink-900/30 hover:text-sunset-dark disabled:opacity-30"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────

function Field({ label, hint, wide, children }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-ink-900/60 mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="text-2xs text-ink-900/40 mt-1 block font-mono">{hint}</span>}
    </label>
  );
}

function Loading({ label }) {
  return (
    <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}
