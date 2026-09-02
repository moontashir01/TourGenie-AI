// The catalogue, under one set of routes.
//
// Seven collections needed the same six operations, and writing that seven
// times is how the endpoints drift apart. Each resource declares what makes
// it searchable and what it is called; everything else — paging, soft delete,
// restore, referential guards, bulk actions and the audit trail — is shared.
//
// Before this, only attractions, hotels and transport had any admin screen at
// all: destinations, countries, flights and airports could only be changed by
// editing a seed file and re-running the seed.
import Destination from "../models/Destination.js";
import Country from "../models/Country.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import TransportOption from "../models/TransportOption.js";
import FlightOption from "../models/FlightOption.js";
import Airport from "../models/Airport.js";
import HotelRate from "../models/HotelRate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseListQuery, paginate } from "../utils/adminList.js";
import { recordAudit, diffFields } from "../services/auditLog.js";
import { referencesTo, blockers, softDelete, restore } from "../services/catalogueGuards.js";

const RESOURCES = {
  destinations: {
    Model: Destination,
    kind: "destination",
    singular: "Destination",
    searchFields: ["name", "slug", "country", "division", "summary"],
    allowedSort: ["created_at", "name", "country", "popularity", "avg_daily_cost"],
    defaultSort: "name",
    filters: { country_code: (v) => String(v).toUpperCase(), type: (v) => v },
    label: (d) => `${d.name} (${d.country})`,
    summary: (d) => ({ name: d.name, slug: d.slug, country_code: d.country_code, is_active: d.is_active }),
  },
  countries: {
    Model: Country,
    kind: "country",
    singular: "Country",
    searchFields: ["name", "code", "capital", "currency"],
    allowedSort: ["created_at", "name", "code"],
    defaultSort: "name",
    label: (c) => `${c.name} (${c.code})`,
    summary: (c) => ({ name: c.name, code: c.code, currency: c.currency, is_core: c.is_core }),
  },
  attractions: {
    Model: Attraction,
    kind: "attraction",
    singular: "Attraction",
    searchFields: ["name", "city", "category", "description"],
    allowedSort: ["created_at", "name", "city", "entry_fee", "rating"],
    defaultSort: "name",
    filters: { city: (v) => v, category: (v) => v },
    label: (a) => `${a.name} (${a.city})`,
    summary: (a) => ({ name: a.name, city: a.city, entry_fee: a.entry_fee, is_active: a.is_active }),
  },
  hotels: {
    Model: Hotel,
    kind: "hotel",
    singular: "Hotel",
    searchFields: ["name", "city", "area"],
    allowedSort: ["created_at", "name", "city", "price_per_night", "rating"],
    defaultSort: "city",
    filters: { city: (v) => v },
    label: (h) => `${h.name} (${h.city})`,
    summary: (h) => ({ name: h.name, city: h.city, price_per_night: h.price_per_night, is_active: h.is_active }),
  },
  transport: {
    Model: TransportOption,
    kind: "transport",
    singular: "TransportOption",
    searchFields: ["operator", "from_city", "to_city", "service_class"],
    allowedSort: ["created_at", "operator", "from_city", "to_city", "fare"],
    defaultSort: "from_city",
    filters: { mode: (v) => v },
    label: (t) => `${t.operator} ${t.from_city}→${t.to_city}`,
    summary: (t) => ({ operator: t.operator, fare: t.fare, mode: t.mode, is_active: t.is_active }),
  },
  flights: {
    Model: FlightOption,
    kind: "flight",
    singular: "FlightOption",
    searchFields: ["airline", "flight_number", "from_city", "to_city", "from_iata", "to_iata"],
    allowedSort: ["created_at", "airline", "depart_time", "total_fare_bdt"],
    defaultSort: "airline",
    filters: { cabin: (v) => v },
    label: (f) => `${f.flight_number} ${f.from_iata}→${f.to_iata}`,
    summary: (f) => ({ flight_number: f.flight_number, total_fare_bdt: f.total_fare_bdt, is_active: f.is_active }),
  },
  airports: {
    Model: Airport,
    kind: "airport",
    singular: "Airport",
    searchFields: ["iata", "name", "city", "country"],
    allowedSort: ["created_at", "iata", "name", "city"],
    defaultSort: "iata",
    filters: { country_code: (v) => String(v).toUpperCase() },
    label: (a) => `${a.iata} — ${a.name}`,
    summary: (a) => ({ iata: a.iata, name: a.name, city: a.city, is_active: a.is_active }),
  },
};

export const RESOURCE_NAMES = Object.keys(RESOURCES);

function resolve(req, res) {
  const config = RESOURCES[req.params.resource];
  if (!config) {
    res.status(404).json({ message: `Unknown catalogue: ${req.params.resource}` });
    return null;
  }
  return config;
}

// Fields a client must never set directly, whatever it sends.
const PROTECTED = ["_id", "deleted_at", "deleted_by", "created_at", "updated_at", "__v"];

function clean(body) {
  const out = { ...body };
  for (const field of [...PROTECTED, "reason"]) delete out[field];
  return out;
}

export const listResource = asyncHandler(async (req, res) => {
  const config = resolve(req, res);
  if (!config) return;

  const options = parseListQuery(req.query, config);

  // Deleted rows are hidden unless asked for, which is what makes the delete
  // reversible rather than merely invisible.
  if (req.query.deleted === "only") options.filter.deleted_at = { $ne: null };
  else if (req.query.deleted !== "all") options.filter.deleted_at = null;

  if (req.query.active === "true") options.filter.is_active = true;
  if (req.query.active === "false") options.filter.is_active = false;

  for (const [key, coerce] of Object.entries(config.filters || {})) {
    if (req.query[key]) options.filter[key] = coerce(req.query[key]);
  }

  res.json(await paginate(config.Model, options));
});

export const createResource = asyncHandler(async (req, res) => {
  const config = resolve(req, res);
  if (!config) return;

  const doc = await config.Model.create({ ...clean(req.body), source_kind: "admin" });
  await recordAudit(req, {
    action: `${config.kind}.create`,
    entity_type: config.singular,
    entity_id: doc._id,
    entity_label: config.label(doc),
    after: config.summary(doc),
  });
  res.status(201).json({ row: doc });
});

export const updateResource = asyncHandler(async (req, res) => {
  const config = resolve(req, res);
  if (!config) return;

  const before = await config.Model.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: `${config.singular} not found` });

  const payload = clean(req.body);
  const doc = await config.Model.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });

  await recordAudit(req, {
    action: `${config.kind}.update`,
    entity_type: config.singular,
    entity_id: doc._id,
    entity_label: config.label(doc),
    ...diffFields(before, doc.toObject(), Object.keys(payload)),
    reason: req.body?.reason,
  });

  res.json({ row: doc });
});

// What points at this record — read before offering to delete it.
export const getReferences = asyncHandler(async (req, res) => {
  const config = resolve(req, res);
  if (!config) return;

  const doc = await config.Model.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: `${config.singular} not found` });

  const references = await referencesTo(config.kind, doc);
  res.json({
    label: config.label(doc),
    references,
    blocked_from_hard_delete: blockers(references).length > 0,
  });
});

/**
 * Soft by default. `?hard=true` removes the row for good and is refused while
 * anything would be left pointing at nothing — the case that produced 2,895
 * stranded documents before any of this existed.
 */
export const deleteResource = asyncHandler(async (req, res) => {
  const config = resolve(req, res);
  if (!config) return;

  const doc = await config.Model.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: `${config.singular} not found` });

  const hard = req.query.hard === "true";
  const references = await referencesTo(config.kind, doc);
  const blocking = blockers(references);

  if (hard && blocking.length) {
    return res.status(409).json({
      message: `Still referenced by ${blocking.map((b) => `${b.count} ${b.label}`).join(", ")}. Deactivate it instead.`,
      references,
    });
  }

  if (hard) {
    await config.Model.deleteOne({ _id: doc._id });
  } else {
    await softDelete(doc, req.user._id);
  }

  await recordAudit(req, {
    action: hard ? `${config.kind}.hard_delete` : `${config.kind}.delete`,
    entity_type: config.singular,
    entity_id: doc._id,
    entity_label: config.label(doc),
    before: config.summary(doc),
    reason: req.body?.reason,
  });

  res.json({
    message: hard ? `${config.singular} removed permanently` : `${config.singular} deleted — it can be restored`,
    references,
  });
});

export const restoreResource = asyncHandler(async (req, res) => {
  const config = resolve(req, res);
  if (!config) return;

  const doc = await config.Model.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: `${config.singular} not found` });
  if (!doc.deleted_at) return res.status(409).json({ message: "That record isn't deleted" });

  await restore(doc);
  await recordAudit(req, {
    action: `${config.kind}.restore`,
    entity_type: config.singular,
    entity_id: doc._id,
    entity_label: config.label(doc),
    after: config.summary(doc),
    reason: req.body?.reason,
  });

  res.json({ row: doc });
});

const BULK_ACTIONS = ["activate", "deactivate", "delete", "restore"];
const BULK_LIMIT = 100;

// One decision applied to a selection. Deliberately excludes hard delete:
// removing many rows for good should be done one at a time, having read what
// each one was holding up.
export const bulkAction = asyncHandler(async (req, res) => {
  const config = resolve(req, res);
  if (!config) return;

  const { ids, action, reason } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "Select at least one row" });
  }
  if (ids.length > BULK_LIMIT) {
    return res.status(400).json({ message: `At most ${BULK_LIMIT} rows at a time` });
  }
  if (!BULK_ACTIONS.includes(action)) {
    return res.status(400).json({ message: `Action must be one of: ${BULK_ACTIONS.join(", ")}` });
  }

  const update =
    action === "activate"
      ? { is_active: true }
      : action === "deactivate"
        ? { is_active: false }
        : action === "delete"
          ? { deleted_at: new Date(), deleted_by: req.user._id, is_active: false }
          : { deleted_at: null, deleted_by: null, is_active: true };

  const result = await config.Model.updateMany({ _id: { $in: ids } }, { $set: update });

  await recordAudit(req, {
    action: `${config.kind}.bulk_${action}`,
    entity_type: config.singular,
    entity_label: `${result.modifiedCount} rows`,
    after: { action, matched: result.matchedCount, modified: result.modifiedCount },
    reason,
  });

  res.json({ message: `${result.modifiedCount} row(s) updated`, modified: result.modifiedCount });
});

// The hotel rate cache is not a rate card an admin edits — it is one row per
// (hotel, stay, occupancy) remembered so a free-tier provider quota survives
// repeated visits. What an admin needs is to see how big it is and to drop it
// when prices have moved.
export const getRateCacheStats = asyncHandler(async (req, res) => {
  const [total, empty, oldest, newest] = await Promise.all([
    HotelRate.countDocuments(),
    HotelRate.countDocuments({ hotel_id: null }),
    HotelRate.findOne().sort({ created_at: 1 }).select("created_at").lean(),
    HotelRate.findOne().sort({ created_at: -1 }).select("created_at").lean(),
  ]);

  res.json({
    total,
    // Rows that record "this search found nothing", which stop an empty city
    // re-hitting the provider on every page load.
    empty_markers: empty,
    oldest: oldest?.created_at || null,
    newest: newest?.created_at || null,
  });
});

export const clearRateCache = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.city) filter.city = req.query.city;

  const result = await HotelRate.deleteMany(filter);
  await recordAudit(req, {
    action: "hotel_rates.clear_cache",
    entity_type: "HotelRate",
    entity_label: req.query.city ? `city: ${req.query.city}` : "all cities",
    after: { removed: result.deletedCount },
    reason: req.body?.reason,
  });

  res.json({ message: `${result.deletedCount} cached rate(s) cleared`, removed: result.deletedCount });
});
