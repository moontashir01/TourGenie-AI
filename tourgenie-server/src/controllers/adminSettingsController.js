// Phase 5 — the three collections that are configuration rather than
// catalogue: app settings, notification rules, and the UI string tables.
//
// All three are read at runtime and none of them had a screen. Changing the
// maximum passengers per booking, the copy of a departure reminder, or a
// mistranslated button meant editing a seed file and re-running the seed —
// which on a shared database also rewrites everything else.
import AppSetting from "../models/AppSetting.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import Translation from "../models/Translation.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit, diffFields } from "../services/auditLog.js";

// ── app settings ─────────────────────────────────────────────────────

export const listSettings = asyncHandler(async (req, res) => {
  const settings = await AppSetting.find().sort({ group: 1, key: 1 }).lean();

  // Grouped the way the screen renders them, so the client isn't sorting
  // configuration into sections it would have to keep in step with the seed.
  const groups = new Map();
  for (const setting of settings) {
    const key = setting.group || "general";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(setting);
  }

  res.json({
    groups: [...groups.entries()].map(([group, rows]) => ({ group, rows })),
    total: settings.length,
  });
});

/**
 * Coerces what the form sent into what the setting says it holds.
 *
 * The value is Mixed, so nothing else stops "10" being stored where the
 * booking code expects 10 — and `booking.max_passengers` as a string
 * compares wrong rather than failing loudly.
 */
function coerce(type, value) {
  switch (type) {
    case "boolean":
      return { ok: true, value: value === true || value === "true" };
    case "number": {
      const number = Number(value);
      return Number.isFinite(number)
        ? { ok: true, value: number }
        : { ok: false, message: "That setting holds a number" };
    }
    case "array":
      if (Array.isArray(value)) return { ok: true, value };
      // The form sends one line per entry.
      return {
        ok: true,
        value: String(value)
          .split(/[\n,]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      };
    case "json":
      if (typeof value === "object" && value !== null) return { ok: true, value };
      try {
        return { ok: true, value: JSON.parse(String(value)) };
      } catch {
        return { ok: false, message: "That setting holds JSON, and this isn't valid JSON" };
      }
    default:
      return { ok: true, value: String(value) };
  }
}

export const updateSetting = asyncHandler(async (req, res) => {
  const setting = await AppSetting.findOne({ key: req.params.key });
  if (!setting) return res.status(404).json({ message: "No such setting" });

  // Some settings describe what the app *is* rather than how it behaves —
  // booking.mock_only is a statement about there being no payment gateway,
  // and turning it off would not add one.
  if (!setting.is_editable) {
    return res.status(409).json({ message: "That setting is fixed and can't be changed from here" });
  }

  const parsed = coerce(setting.type, req.body?.value);
  if (!parsed.ok) return res.status(400).json({ message: parsed.message });

  const was = setting.value;
  setting.value = parsed.value;
  await setting.save();

  await recordAudit(req, {
    action: "setting.update",
    entity_type: "AppSetting",
    entity_id: setting._id,
    entity_label: setting.key,
    before: { value: was },
    after: { value: setting.value },
    reason: req.body?.reason,
  });

  res.json({ setting });
});

// ── notification templates ───────────────────────────────────────────
//
// notificationEngine reads the active templates on every sweep, so an edit
// here changes the next notification anyone receives. That is the point, and
// it is also why the copy fields are worth an audit entry.

const TEMPLATE_FIELDS = [
  "code", "type", "label", "title_template", "message_template",
  "severity", "icon", "action_url", "is_active", "trigger",
];

const pick = (body) =>
  Object.fromEntries(TEMPLATE_FIELDS.filter((field) => body?.[field] !== undefined).map((f) => [f, body[f]]));

export const listNotificationTemplates = asyncHandler(async (req, res) => {
  const templates = await NotificationTemplate.find().sort({ type: 1, code: 1 }).lean();
  res.json({
    templates,
    // The placeholders the engine substitutes, so the form can list them
    // rather than an admin guessing at the syntax.
    placeholders: ["{{destination}}", "{{trip_name}}", "{{hours}}", "{{days}}", "{{temp}}", "{{condition}}", "{{amount}}"],
    events: NotificationTemplate.schema.path("trigger.event").enumValues,
  });
});

export const updateNotificationTemplate = asyncHandler(async (req, res) => {
  const before = await NotificationTemplate.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: "Template not found" });

  const payload = pick(req.body);
  const template = await NotificationTemplate.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });

  await recordAudit(req, {
    action: "notification_template.update",
    entity_type: "NotificationTemplate",
    entity_id: template._id,
    entity_label: template.code,
    ...diffFields(before, template.toObject(), Object.keys(payload)),
    reason: req.body?.reason,
  });

  res.json({ template });
});

export const createNotificationTemplate = asyncHandler(async (req, res) => {
  const payload = pick(req.body);
  if (!payload.code || !payload.title_template || !payload.message_template) {
    return res.status(400).json({ message: "A template needs a code, a title and a message" });
  }

  let template;
  try {
    template = await NotificationTemplate.create(payload);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "A template with that code already exists" });
    throw err;
  }

  await recordAudit(req, {
    action: "notification_template.create",
    entity_type: "NotificationTemplate",
    entity_id: template._id,
    entity_label: template.code,
    after: { code: template.code, event: template.trigger?.event, is_active: template.is_active },
  });

  res.status(201).json({ template });
});

export const deleteNotificationTemplate = asyncHandler(async (req, res) => {
  const template = await NotificationTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });

  await NotificationTemplate.deleteOne({ _id: template._id });
  await recordAudit(req, {
    action: "notification_template.delete",
    entity_type: "NotificationTemplate",
    entity_id: template._id,
    entity_label: template.code,
    before: { code: template.code, title: template.title_template },
    reason: req.body?.reason,
  });

  res.json({ message: "Template removed — notifications already sent are unaffected" });
});

// ── translations ─────────────────────────────────────────────────────
//
// `strings` is a nested object ("common.save"), because that is the shape
// useLanguage().t() walks. An editor wants one flat list of dotted keys, so
// it is flattened on the way out and rebuilt on the way in.

function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

function setPath(target, path, value) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
    node = node[part];
  }
  node[parts.at(-1)] = value;
}

/** A null value removes the key — how an orphan key gets cleaned up. */
function deletePath(target, path) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof node?.[part] !== "object" || node[part] === null) return;
    node = node[part];
  }
  delete node[parts.at(-1)];
}

/** How much of English this language actually covers. */
function completeness(englishKeys, langStrings) {
  if (!englishKeys.length) return 100;
  const flat = flatten(langStrings);
  const filled = englishKeys.filter((key) => typeof flat[key] === "string" && flat[key].trim()).length;
  return Math.round((filled / englishKeys.length) * 100);
}

export const listTranslations = asyncHandler(async (req, res) => {
  const languages = await Translation.find()
    .select("lang label native_label direction locale flag is_default is_active completeness_pct updated_at")
    .sort({ is_default: -1, lang: 1 })
    .lean();
  res.json({ languages });
});

/**
 * One language, flattened, with the English text beside each key — a
 * translator needs the source string in front of them, and a missing key is
 * invisible without it.
 */
export const getTranslation = asyncHandler(async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  const [row, english] = await Promise.all([
    Translation.findOne({ lang }).lean(),
    Translation.findOne({ lang: "en" }).select("strings").lean(),
  ]);
  if (!row) return res.status(404).json({ message: "Language not found" });

  const source = flatten(english?.strings || {});
  const target = flatten(row.strings || {});
  const keys = Object.keys(source).length ? Object.keys(source) : Object.keys(target);

  res.json({
    language: { ...row, strings: undefined },
    entries: keys.map((key) => ({
      key,
      english: typeof source[key] === "string" ? source[key] : "",
      value: typeof target[key] === "string" ? target[key] : "",
      missing: !(typeof target[key] === "string" && target[key].trim()),
    })),
    // Keys this language has that English doesn't — usually a typo in a key
    // name, and invisible until something looks for it.
    orphans: Object.keys(target).filter((key) => !(key in source)),
    completeness_pct: row.completeness_pct,
  });
});

export const updateTranslation = asyncHandler(async (req, res) => {
  const lang = String(req.params.lang).toLowerCase();
  const row = await Translation.findOne({ lang });
  if (!row) return res.status(404).json({ message: "Language not found" });

  // Only the keys being changed are sent, as a flat { "common.save": "…" }
  // map — sending the whole table back would make two people editing at once
  // silently overwrite each other.
  const changes = req.body?.strings && typeof req.body.strings === "object" ? req.body.strings : {};
  const meta = {};
  for (const field of ["label", "native_label", "direction", "locale", "flag", "is_active"]) {
    if (req.body?.[field] !== undefined) meta[field] = req.body[field];
  }

  const strings = JSON.parse(JSON.stringify(row.strings || {}));
  for (const [key, value] of Object.entries(changes)) {
    // null means "drop this key", which is the only way to clear an orphan —
    // a key this language has that English doesn't, usually a typo, and
    // invisible to the app because nothing ever asks for it.
    if (value === null) deletePath(strings, key);
    else setPath(strings, key, String(value));
  }

  const english = lang === "en" ? { strings } : await Translation.findOne({ lang: "en" }).select("strings").lean();
  Object.assign(row, meta);
  row.strings = strings;
  row.completeness_pct = completeness(Object.keys(flatten(english?.strings || {})), strings);
  // Mixed fields don't track their own mutations.
  row.markModified("strings");
  await row.save();

  await recordAudit(req, {
    action: "translation.update",
    entity_type: "Translation",
    entity_id: row._id,
    entity_label: `${row.lang} — ${row.label}`,
    // The keys, not the prose: a diff of 200 strings is not a trail anyone
    // reads, and the keys are what says what was touched.
    after: {
      keys: Object.keys(changes).slice(0, 40),
      keys_changed: Object.keys(changes).length,
      ...meta,
      completeness_pct: row.completeness_pct,
    },
    reason: req.body?.reason,
  });

  res.json({
    language: { ...row.toObject(), strings: undefined },
    completeness_pct: row.completeness_pct,
    updated: Object.keys(changes).length,
  });
});
