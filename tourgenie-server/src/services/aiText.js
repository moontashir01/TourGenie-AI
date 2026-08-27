// Plain-prose completions, as opposed to aiPlanner.js which asks the same
// providers for JSON and parses it.
//
// This exists so the chat assistant can sound natural without ever letting a
// model invent a number. The caller assembles the facts from MongoDB, hands
// them over as a brief, and gets back wording. If no provider is configured,
// or one is configured and fails, this returns null and the caller falls
// back to its own deterministic phrasing — the answer is never lost, only
// its polish.
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const TIMEOUT_MS = Number(process.env.AI_TEXT_TIMEOUT_MS || 12000);

async function postJson(url, headers, body) {
  // A chat reply that takes 40 seconds is worse than one written by the
  // fallback, so the request is capped rather than left to hang.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function groqText(system, user) {
  const data = await postJson(
    "https://api.groq.com/openai/v1/chat/completions",
    { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    {
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_completion_tokens: 700,
      reasoning_effort: "low",
    }
  );
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function openaiText(system, user) {
  const data = await postJson(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 700,
    }
  );
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function claudeText(system, user) {
  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: user }],
    }
  );
  return data.content?.find((b) => b.type === "text")?.text?.trim() || null;
}

const PROVIDERS = [
  { name: "groq", envKey: "GROQ_API_KEY", call: groqText },
  { name: "claude", envKey: "ANTHROPIC_API_KEY", call: claudeText },
  { name: "openai", envKey: "OPENAI_API_KEY", call: openaiText },
];

export function hasTextProvider() {
  return PROVIDERS.some((p) => process.env[p.envKey]);
}

/**
 * @returns {Promise<{text: string, provider: string}|null>} null when no
 *          provider is configured or every one of them failed.
 */
export async function askForText(system, user) {
  for (const provider of PROVIDERS) {
    if (!process.env[provider.envKey]) continue;
    try {
      const text = await provider.call(system, user);
      if (text) return { text, provider: provider.name };
    } catch (err) {
      console.warn(`${provider.name} text completion failed: ${err.message}`);
    }
  }
  return null;
}

export default { askForText, hasTextProvider };
