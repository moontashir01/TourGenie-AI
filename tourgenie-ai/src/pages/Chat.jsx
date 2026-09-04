import { useState } from "react";
import { Link } from "react-router-dom";
import { Send, Loader2, AlertCircle } from "lucide-react";
import AppShell from "../components/AppShell";
import ChatThread from "../components/ChatThread";
import { useChat } from "../context/ChatContext";
import { useCurrentTrip } from "../context/TripContext";
import { useLanguage } from "../context/LanguageContext";

// The roomy view of the same conversation the floating dock shows — both read
// from ChatContext, so a thread started in the dock continues here unchanged.
export default function Chat() {
  const { t } = useLanguage();
  const { currentTripId } = useCurrentTrip();
  const { messages, quickActions, sending, error, send } = useChat();
  const [text, setText] = useState("");

  async function submit(e) {
    e.preventDefault();
    const value = text;
    setText("");
    try {
      await send(value);
    } catch {
      setText(value); // failed to send — don't lose what was typed
    }
  }

  return (
    <AppShell
      title={t("chat.title", "AI Chat Assistant")}
      subtitle="Edit your itinerary or ask travel questions in plain language."
    >
      {!currentTripId && (
        <div className="max-w-3xl mx-auto mb-4 flex items-start gap-2 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            No trip selected — I can still answer general questions, but itinerary edits need a trip.{" "}
            <Link to="/dashboard" className="font-semibold underline">Pick one from your dashboard</Link>.
          </span>
        </div>
      )}

      <div className="max-w-3xl mx-auto card shadow-lift flex flex-col h-[calc(100vh-13rem)] overflow-hidden">
        <ChatThread messages={messages} sending={sending} className="flex-1 p-6 space-y-4" />

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
                onClick={() => send(c.label).catch(() => {})}
                disabled={sending}
                className="text-xs font-medium text-teal-dark bg-teal-light hover:bg-teal hover:text-white disabled:opacity-50 px-3 py-1.5 rounded-full transition-colors"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-sand p-4">
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
            className="w-10 h-10 shrink-0 rounded-full bg-sunset hover:bg-sunset-dark disabled:opacity-50 text-ink-fixed flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
