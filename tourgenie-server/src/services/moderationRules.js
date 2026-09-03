// FR-23 — what lands in the moderation queue, and why.
//
// `moderation_status` has been on CommunityPost and Review since the schema
// was written, defaulting to "approved", and nothing ever set it. That made
// moderation reactive scrolling: a moderator found bad content by reading the
// feed. These rules turn it into a work queue — a post that trips one of them
// starts as `pending`, invisible to everyone but its author, until a
// moderator approves it.
//
// The rules are deliberately few and cheap. Each one names the thing it is
// actually worried about; anything subtler than this belongs to a human.

// Naked links are how spam arrives. Matches bare domains too ("buy at
// cheaptrips.xyz"), which is what a spammer writes once http:// is filtered.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|xyz|top|ru|io|shop|link)\b)/i;

// Not a profanity filter — a short list of the words that make a post worth a
// second pair of eyes before it reaches the feed.
const WATCHED = [
  "scam", "fraud", "fake", "cheat", "whatsapp me", "telegram me", "dm me",
  "click here", "free money", "investment", "crypto", "casino", "porn",
];

// A brand-new account's first post is the cheapest thing for a spammer to
// make, so it waits — but only while the account really is brand new.
const NEW_ACCOUNT_HOURS = 24;

export const RULES = {
  links: "Contains a link",
  watched_words: "Contains a watched word",
  new_account: "First post from an account under a day old",
  reported: "Reported by a traveller",
  forced: "All new content is held for review",
};

/**
 * Decides whether a new post or review goes straight to the feed.
 *
 * The caller supplies the facts rather than this doing its own queries, so
 * the rules stay testable and the query count stays visible at the call site.
 *
 * @param {object} input
 *   text          — the post body or review comment
 *   accountAgeMs  — how long the author has had an account
 *   priorApproved — how many approved posts/reviews they already have
 *   force         — the community.require_moderation app setting
 * @returns {{ status: "pending"|"approved", matched: string[] }}
 */
export function screenContent({ text = "", accountAgeMs = Infinity, priorApproved = 0, force = false }) {
  const matched = [];
  const body = String(text);

  if (force) matched.push("forced");
  if (LINK.test(body)) matched.push("links");

  const lower = body.toLowerCase();
  if (WATCHED.some((word) => lower.includes(word))) matched.push("watched_words");

  // Both halves have to hold: an account opened this morning that has
  // already had three posts approved is a keen traveller, not a bot.
  if (priorApproved === 0 && accountAgeMs < NEW_ACCOUNT_HOURS * 3600_000) matched.push("new_account");

  return { status: matched.length ? "pending" : "approved", matched };
}

/** The matched rule names as a sentence for the audit trail and the queue. */
export function describeRules(matched = []) {
  return matched.map((key) => RULES[key] || key).join("; ");
}

export default { RULES, screenContent, describeRules };
