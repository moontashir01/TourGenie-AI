// How often one account may hit the admin API.
//
// The portal's lists are paginated now, but nothing stopped a caller asking
// for page one four hundred times a second, and `GET /admin/exports/users`
// walks a whole collection through a cursor on every call. An export loop is
// the cheapest denial of service in the app, so reads and exports get
// separate budgets: reads are generous enough that no honest admin meets
// them, exports are counted in single figures.
//
// In-process and per-instance on purpose. There is one API process on
// free-tier hosting and no Redis, so a limiter needing shared state would be
// a dependency that buys nothing here. Run this on two instances and the
// ceiling doubles — it loosens, it does not break.

const buckets = new Map();

// Fixed windows, not a sliding log: one counter and one timestamp per key
// instead of an array of request times. A burst can straddle a boundary and
// spend two windows' worth in quick succession; that is an acceptable trade
// for a limiter that costs nothing to keep.
function take(key, max, windowMs) {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || entry.reset <= now) {
    entry = { count: 0, reset: now + windowMs };
    buckets.set(key, entry);
  }
  entry.count += 1;
  return entry;
}

// Expired windows are replaced on the next request from the same key, so this
// sweep exists only to stop the Map growing from keys nobody comes back to.
// Unreffed: a limiter must never be the reason the process won't exit.
const SWEEP_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) if (entry.reset <= now) buckets.delete(key);
}, SWEEP_MS).unref?.();

// Keyed by account where there is one. The admin limiters all sit behind
// `protect`; the sign-in limiters run before anyone is identified, so they
// fall back to the address the request came from.
const defaultKey = (req) => String(req.user?._id || req.ip);

/**
 * @param {object} options
 *   name     — namespaces the counter, so a request counted against the read
 *              budget is also counted against the export budget rather than
 *              the two sharing one number
 *   max      — requests allowed per window
 *   windowMs — the window
 *   message  — what the caller is told at the limit; a full sentence, because
 *              it reaches the same error banner as everything else
 *   key      — how to identify the caller, when the account/IP default is
 *              not the right unit
 */
export function rateLimit({ name, max, windowMs, message, key = defaultKey }) {
  return (req, res, next) => {
    const entry = take(`${name}:${key(req)}`, max, windowMs);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.reset / 1000)));

    if (entry.count > max) {
      const retry_after = Math.max(1, Math.ceil((entry.reset - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retry_after));
      // `retry_after` at the top level as well as in the sentence: the client
      // reads it off the error body the same way it does for the password
      // reset cooldown.
      return res.status(429).json({ message, retry_after });
    }
    next();
  };
}

// Every admin request. High enough that a screen opening six lists at once,
// a page of typing into the search box and a full sweep of the catalogue tabs
// all pass without noticing it.
export const adminReadLimiter = rateLimit({
  name: "admin",
  max: 300,
  windowMs: 60 * 1000,
  message: "Too many admin requests in the last minute. Wait a moment and try again.",
});

// Exports read entire collections. Ten in ten minutes is more than a person
// downloads and far less than a loop wants.
export const adminExportLimiter = rateLimit({
  name: "export",
  max: 10,
  windowMs: 10 * 60 * 1000,
  message: "That's ten exports in ten minutes. Wait a few minutes before downloading another.",
});

/**
 * A limiter that counts only what it is told to.
 *
 * The password prompt needs guessing protection, not load protection, and
 * counting attempts would lock an admin out for doing six legitimate
 * deletions in a row. So the window counts wrong answers: `guard` reads the
 * standing count without adding to it, and the handler calls `penalise` when
 * the password comes back wrong.
 */
export function failureLimit({ name, max, windowMs, message, key = defaultKey }) {
  const keyFor = (req) => `${name}:${key(req)}`;

  return {
    guard: (req, res, next) => {
      const entry = buckets.get(keyFor(req));
      if (entry && entry.reset > Date.now() && entry.count >= max) {
        const retry_after = Math.max(1, Math.ceil((entry.reset - Date.now()) / 1000));
        res.setHeader("Retry-After", String(retry_after));
        return res.status(429).json({ message, retry_after });
      }
      next();
    },
    penalise: (req) => take(keyFor(req), max, windowMs),
  };
}

// Five wrong passwords in fifteen minutes, per account. Correct ones are
// free.
export const reauthLimiter = failureLimit({
  name: "reauth",
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: "Too many incorrect password confirmations. Try again in a few minutes.",
});


// ── Sign-in and account creation ──────────────────────────────────────
//
// Everything above protects the admin API. The front door had nothing at
// all: POST /auth/login would answer an unlimited number of guesses at a
// password, and POST /auth/register would create an unlimited number of
// accounts.
//
// Deliberately keyed on the address and not on the email being tried. A
// per-account counter is the obvious shape and the wrong one — it hands
// anyone who knows a traveller's email address the ability to lock them out
// of their own account by failing to log in as them. Guessing gets slower;
// nobody else's sign-in does.

// Ten wrong passwords from one address in a quarter of an hour. Correct
// ones cost nothing, so a household behind one address never meets this by
// signing in.
export const loginFailureLimiter = failureLimit({
  name: "login",
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: "Too many failed sign-in attempts from this device. Try again in a few minutes.",
});

// New accounts and reset emails. /auth/forgot-password already limits per
// address; this is the other half — one address asking about a hundred
// different mailboxes.
export const authWriteLimiter = rateLimit({
  name: "auth-write",
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: "Too many requests from this device. Wait a few minutes and try again.",
});
