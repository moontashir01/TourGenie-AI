import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Send, Loader2, X, Sparkles, AlertCircle, Maximize2 } from "lucide-react";
import ChatThread from "./ChatThread";
import { useChat } from "../context/ChatContext";
import { useCurrentTrip } from "../context/TripContext";

// FR-05 — the assistant, reachable from every page instead of only /chat.
// The conversation itself lives in ChatContext so it survives navigation;
// this is just the panel and the button that opens it.
export default function ChatDock() {
  const { open, setOpen, messages, quickActions, sending, error, send, unseen } = useChat();
  const { currentTripId } = useCurrentTrip();
  const { pathname } = useLocation();
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  // /chat is the same conversation at full size — showing the dock there too
  // would render the thread twice on one screen.
  const hidden = pathname === "/chat";

  // Esc closes, matching the command palette and the mobile nav.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function submit(e) {
    e?.preventDefault();
    const value = text;
    setText("");
    try {
      await send(value);
    } catch {
      setText(value); // put it back so the message isn't lost
    }
  }

  if (hidden) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-sunset to-sunset-dark text-white shadow-lift hover:shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center justify-center print:hidden"
      >
        <Sparkles className="w-5 h-5" />
        {unseen && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-teal ring-2 ring-white" />
        )}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop only below sm — on a phone the panel is effectively a sheet. */}
      <div
        className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm sm:hidden"
        onClick={() => setOpen(false)}
      />
      <div className="fixed z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[min(26rem,calc(100vw-2.5rem))] print:hidden">
        <div className="card shadow-lift flex flex-col overflow-hidden h-[70vh] sm:h-[min(34rem,calc(100vh-6rem))] rounded-b-none sm:rounded-b-2xl animate-pop-in">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-sand bg-white/80 backdrop-blur">
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-sunset to-sunset-dark flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm text-ink-900 leading-tight">AI Travel Assistant</p>
              <p className="text-[11px] text-ink-900/45 truncate">
                {currentTripId ? "Editing your open trip" : "General travel questions"}
              </p>
            </div>
            <Link
              to="/chat"
              onClick={() => setOpen(false)}
              title="Open full screen"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-900/40 hover:text-teal-dark hover:bg-teal-light/50 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-900/40 hover:text-ink-900 hover:bg-paper transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {!currentTripId && (
            <div className="flex items-start gap-2 bg-sunset/10 border-b border-sunset/25 text-sunset-dark text-xs px-4 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                No trip open — I can still answer questions, but itinerary edits need one.{" "}
                <Link to="/dashboard" onClick={() => setOpen(false)} className="font-semibold underline">
                  Pick a trip
                </Link>
                .
              </span>
            </div>
          )}

          <ChatThread messages={messages} sending={sending} className="flex-1 p-4 space-y-3" />

          {error && (
            <div className="px-4 pb-2 flex items-start gap-2 text-sunset-dark text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {quickActions.length > 0 && (
            <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto">
              {quickActions.map((c) => (
                <button
                  key={c.code}
                  onClick={() => send(c.label).catch(() => {})}
                  disabled={sending}
                  className="text-[11px] font-medium whitespace-nowrap text-teal-dark bg-teal-light hover:bg-teal hover:text-white disabled:opacity-50 px-2.5 py-1.5 rounded-full transition-colors"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-sand p-3">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              type="text"
              placeholder="Ask me to change your plan…"
              disabled={sending}
              className="flex-1 text-sm bg-paper border border-sand rounded-full px-4 py-2.5 focus:outline-none focus:border-teal disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send message"
              className="w-10 h-10 shrink-0 rounded-full bg-sunset hover:bg-sunset-dark disabled:opacity-50 text-ink-900 flex items-center justify-center transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
