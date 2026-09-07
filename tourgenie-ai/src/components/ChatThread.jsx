import { useEffect, useRef } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";

// The message list, shared by the floating dock and the full-page /chat view
// so the two can never drift apart in how a reply renders.

// The assistant's replies carry structure — a headline, a costed breakdown,
// an assumptions note. Not full markdown: just the line breaks and the two
// emphasis marks the replies actually use, so a stray asterisk in a place
// name can never turn into markup.
export function RichText({ text }) {
  return String(text || "").split("\n").map((line, i) => {
    if (line.trim() === "") return <div key={i} className="h-2" />;

    const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
    return (
      <p key={i} className="min-w-0">
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="font-display text-[15px] text-ink-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("_") && part.endsWith("_")) {
            return (
              <em key={j} className="text-ink-600 not-italic text-sm">
                {part.slice(1, -1)}
              </em>
            );
          }
          return <span key={j}>{part}</span>;
        })}
      </p>
    );
  });
}

function AppliedChanges({ changes }) {
  const summary =
    [
      changes.items_added > 0 && `${changes.items_added} added`,
      changes.items_removed > 0 && `${changes.items_removed} removed`,
      changes.items_updated > 0 && `${changes.items_updated} updated`,
    ]
      .filter(Boolean)
      .join(" · ") || "Itinerary updated";

  return (
    <div className="mt-2 pt-2 border-t border-sand/70 flex flex-wrap items-center gap-1.5 text-xs text-teal-dark font-medium">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      {summary}
      {changes.cost_delta !== 0 && (
        <span className={changes.cost_delta < 0 ? "text-teal-dark" : "text-sunset-dark"}>
          ({changes.cost_delta > 0 ? "+" : ""}৳{Number(changes.cost_delta || 0).toLocaleString()})
        </span>
      )}
    </div>
  );
}

function Avatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sunset to-sunset-dark flex items-center justify-center shrink-0 shadow-soft">
      <Sparkles className="w-3.5 h-3.5 text-paper-fixed" />
    </div>
  );
}

export default function ChatThread({ messages, sending, className = "" }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  return (
    <div ref={scrollRef} className={`overflow-y-auto bg-paper-texture ${className}`}>
      {messages.map((m, i) => (
        // Keyed by index, so only a newly appended message mounts and
        // animates — the ones already on screen sit still while it arrives.
        <div
          key={i}
          className={`flex items-end gap-2 animate-fade-up ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {m.role !== "user" && <Avatar />}
          <div
            className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft space-y-0.5 ${
              m.role === "user"
                ? "bg-gradient-to-br from-teal to-teal-dark text-paper-fixed rounded-br-sm"
                : "bg-surface text-ink-900 rounded-bl-sm border border-sand"
            }`}
          >
            <RichText text={m.content} />
            {m.applied_changes && <AppliedChanges changes={m.applied_changes} />}
          </div>
        </div>
      ))}

      {sending && (
        <div className="flex items-end gap-2 justify-start animate-fade-in">
          <Avatar />
          <div className="card rounded-bl-sm px-4 py-3 shadow-soft flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-dot-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-dot-bounce [animation-delay:0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-dot-bounce [animation-delay:0.3s]" />
          </div>
        </div>
      )}
    </div>
  );
}
