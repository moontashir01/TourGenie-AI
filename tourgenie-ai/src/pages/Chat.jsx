import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import AppShell from "../components/AppShell";
import { chatApi } from "../lib/api";
import { useCurrentTrip } from "../context/TripContext";

const GREETING = {
  role: "assistant",
  content:
    "Hello. I can adjust your itinerary, answer questions about the destination, weather, budget or transport, and rework the plan in plain language. Try one of the chips below, or just tell me what you'd like to change.",
};

export default function Chat() {
  const { currentTripId } = useCurrentTrip();
  const [messages, setMessages] = useState([GREETING]);
  const [sessionId, setSessionId] = useState(null);
  const [quickActions, setQuickActions] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    chatApi.quickActions().then((res) => setQuickActions(res.quick_actions || [])).catch(() => setQuickActions([]));
  }, []);

  useEffect(() => {
    setMessages([GREETING]);
    setSessionId(null);
    if (!currentTripId) return;
    chatApi
      .session(currentTripId)
      .then((res) => {
        if (res.session?.messages?.length) {
          setMessages(res.session.messages);
          setSessionId(res.session._id);
        }
      })
      .catch(() => {});
  }, [currentTripId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(msg) {
    const trimmed = msg.trim();
    if (!trimmed || sending) return;
    setError("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setText("");
    setSending(true);
    try {
      const res = await chatApi.send(trimmed, currentTripId, sessionId);
      setSessionId(res.session_id);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.reply,
          intent_code: res.intent_code,
          source: res.source,
          applied_changes: res.applied_changes,
        },
      ]);
    } catch (err) {
      setError(err.message || "Couldn't reach the assistant");
      setMessages((m) => m.slice(0, -1)); // drop the optimistic user bubble, it never got a reply
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell title="AI Chat Assistant" subtitle="Edit your itinerary or ask travel questions in plain language.">
      {!currentTripId && (
        <div className="max-w-2xl mx-auto mb-4 flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            No trip selected — I can still answer general questions, but itinerary edits need a trip.{" "}
            <Link to="/dashboard" className="font-semibold underline">Pick one from your dashboard</Link>.
          </span>
        </div>
      )}

      <div className="max-w-2xl mx-auto bg-white border border-sand rounded-2xl flex flex-col h-[65vh]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-teal text-white rounded-br-sm"
                    : "bg-paper text-ink-900 rounded-bl-sm border border-sand"
                }`}
              >
                {m.role === "assistant" && (
                  <Sparkles className="w-3.5 h-3.5 text-sunset inline mr-1.5 -mt-0.5" />
                )}
                {m.content}
                {m.applied_changes && (
                  <div className="mt-2 pt-2 border-t border-sand/70 flex items-center gap-1.5 text-xs text-teal-dark font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {[
                      m.applied_changes.items_added > 0 && `${m.applied_changes.items_added} added`,
                      m.applied_changes.items_removed > 0 && `${m.applied_changes.items_removed} removed`,
                      m.applied_changes.items_updated > 0 && `${m.applied_changes.items_updated} updated`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Itinerary updated"}
                    {m.applied_changes.cost_delta !== 0 && (
                      <span className={m.applied_changes.cost_delta < 0 ? "text-teal-dark" : "text-sunset-dark"}>
                        ({m.applied_changes.cost_delta > 0 ? "+" : ""}৳{m.applied_changes.cost_delta.toLocaleString()})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-paper border border-sand rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-ink-900/50 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 pb-2 flex items-start gap-2 text-sunset-dark text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {quickActions.length > 0 && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {quickActions.map((c) => (
              <button
                key={c.code}
                onClick={() => send(c.label)}
                disabled={sending}
                className="text-xs font-medium text-teal-dark bg-teal-light hover:bg-teal hover:text-white disabled:opacity-50 px-3 py-1.5 rounded-full transition-colors"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-center gap-2 border-t border-sand p-4"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            type="text"
            placeholder="Ask the AI to change your plan…"
            disabled={sending}
            className="flex-1 text-sm bg-paper border border-sand rounded-full px-4 py-2.5 focus:outline-none focus:border-teal disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="w-10 h-10 shrink-0 rounded-full bg-sunset hover:bg-sunset-dark disabled:opacity-50 text-ink-900 flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
