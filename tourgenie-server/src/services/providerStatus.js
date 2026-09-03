// Which external providers are configured, and whether the last call worked.
//
// Every provider in this app is an enrichment path: with no keys at all the
// database answers everything and the UI labels the result as seeded. That
// makes provider failure quiet by design — a fare lookup falls back and
// nobody is told. The System health panel is where it stops being quiet, so
// each provider entry point records its outcome here.
//
// In-process and deliberately not persisted: it describes this server
// process, and a restart genuinely has nothing to report yet.

// key → { ok, at, detail }
const lastCall = new Map();

export const PROVIDERS = [
  { key: "groq", label: "Groq", env: "GROQ_API_KEY", purpose: "AI itinerary generation and chat (FR-04, FR-05)" },
  { key: "claude", label: "Claude", env: "ANTHROPIC_API_KEY", purpose: "AI fallback after Groq" },
  { key: "openai", label: "OpenAI", env: "OPENAI_API_KEY", purpose: "AI fallback after Claude" },
  { key: "travelpayouts", label: "Travelpayouts", env: "TRAVELPAYOUTS_API_KEY", purpose: "Real flight fares (FR-05)" },
  { key: "ignav", label: "Ignav", env: "IGNAV_API_KEY", purpose: "Flight fares, tried after Travelpayouts" },
  { key: "stayapi", label: "StayAPI", env: "STAYAPI_KEY", purpose: "Live hotel rates (FR-07)" },
  { key: "openweather", label: "OpenWeather", env: "OPENWEATHER_API_KEY", purpose: "Forecasts — seeded forecasts are used instead" },
  { key: "openrouteservice", label: "OpenRouteService", env: "OPENROUTESERVICE_API_KEY", purpose: "Routing — seeded routes are used instead" },
  { key: "cloudinary", label: "Cloudinary", env: "CLOUDINARY_API_KEY", purpose: "Image hosting — not wired up" },
  { key: "mail", label: "Outgoing email", env: "MAIL_PASS", purpose: "Password reset codes (FR-02)" },
];

/**
 * Records the outcome of one provider call. Called from the provider
 * services themselves; `detail` is the short reason a failure gives, which
 * is what makes the health panel worth reading.
 */
export function recordProviderCall(key, ok, detail = "") {
  lastCall.set(key, { ok: Boolean(ok), at: new Date(), detail: String(detail).slice(0, 200) });
}

/** Wraps a provider call so success and failure are both recorded. */
export async function trackProvider(key, run) {
  try {
    const result = await run();
    recordProviderCall(key, true, "");
    return result;
  } catch (err) {
    recordProviderCall(key, false, err.message);
    throw err;
  }
}

export function getProviderStatuses() {
  return PROVIDERS.map((provider) => ({
    ...provider,
    configured: Boolean(process.env[provider.env]),
    // null means "configured but not called since this server started" —
    // which is different from "failing", and the panel says so.
    last_call: lastCall.get(provider.key) || null,
  }));
}

export default { PROVIDERS, recordProviderCall, trackProvider, getProviderStatuses };
