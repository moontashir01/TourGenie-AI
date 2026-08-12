import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import AppShell from "../components/AppShell";
import { chatMessages, quickChips } from "../data/mockData";

export default function Chat() {
  const [messages, setMessages] = useState(chatMessages);
  const [text, setText] = useState("");

  function send(msg) {
    if (!msg.trim()) return;
    setMessages((m) => [
      ...m,
      { from: "user", text: msg },
      { from: "ai", text: "Got it — updating your itinerary now. This is a demo response; real replies come from the Claude API." },
    ]);
    setText("");
  }

  return (
    <AppShell title="AI Chat Assistant" subtitle="Edit your itinerary or ask travel questions in plain language.">
      <div className="max-w-2xl mx-auto bg-white border border-sand rounded-2xl flex flex-col h-[65vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.from === "user"
                    ? "bg-teal text-white rounded-br-sm"
                    : "bg-paper text-ink-900 rounded-bl-sm border border-sand"
                }`}
              >
                {m.from === "ai" && (
                  <Sparkles className="w-3.5 h-3.5 text-sunset inline mr-1.5 -mt-0.5" />
                )}
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-3 flex flex-wrap gap-2">
          {quickChips.map((c) => (
            <button
              key={c}
              onClick={() => send(c)}
              className="text-xs font-medium text-teal-dark bg-teal-light hover:bg-teal hover:text-white px-3 py-1.5 rounded-full transition-colors"
            >
              {c}
            </button>
          ))}
        </div>

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
            className="flex-1 text-sm bg-paper border border-sand rounded-full px-4 py-2.5 focus:outline-none focus:border-teal"
          />
          <button
            type="submit"
            className="w-10 h-10 shrink-0 rounded-full bg-sunset hover:bg-sunset-dark text-ink-900 flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
