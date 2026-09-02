// One query contract for every admin list.
//
// The admin endpoints each returned their whole collection — `User.find()`,
// `Trip.find()`, every post, every review — with no limit, search or sort.
// That is fine at eight users and is the first thing to break at eight
// hundred, and it pushed work into the browser that belongs in a query.
//
//   GET /api/admin/<resource>?q=&page=1&limit=25&sort=-created_at&<filters>
//   { rows, page, limit, total, pages }

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turns the query string into the pieces a Mongoose query needs.
 *
 * @param {object} query    req.query
 * @param {object} options
 *   searchFields — fields `q` matches against, case-insensitively
 *   allowedSort  — sortable field names; anything else is ignored rather than
 *                  passed through, so the query string can't ask the database
 *                  to sort by something unindexed
 *   defaultSort  — e.g. "-created_at"
 */
export function parseListQuery(query = {}, { searchFields = [], allowedSort = [], defaultSort = "-created_at" } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));

  const filter = {};
  const term = String(query.q || "").trim();
  if (term && searchFields.length) {
    const rx = new RegExp(escapeRegex(term), "i");
    filter.$or = searchFields.map((field) => ({ [field]: rx }));
  }

  const requested = String(query.sort || defaultSort);
  const field = requested.startsWith("-") ? requested.slice(1) : requested;
  const direction = requested.startsWith("-") ? -1 : 1;
  const sortField = allowedSort.includes(field) ? field : defaultSort.replace(/^-/, "");
  const sort = { [sortField]: allowedSort.includes(field) ? direction : defaultSort.startsWith("-") ? -1 : 1 };

  return { filter, sort, skip: (page - 1) * limit, limit, page, term };
}

/**
 * Runs the count and the page in parallel and returns the envelope every
 * admin list answers with.
 *
 * `decorate` builds the query (populate, select) so callers keep control of
 * what each row carries.
 */
export async function paginate(Model, { filter, sort, skip, limit, page }, decorate = (q) => q) {
  const [rows, total] = await Promise.all([
    decorate(Model.find(filter).sort(sort).skip(skip).limit(limit)).lean(),
    Model.countDocuments(filter),
  ]);

  return { rows, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
