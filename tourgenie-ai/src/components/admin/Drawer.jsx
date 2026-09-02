import { useEffect } from "react";
import { X, Loader2 } from "lucide-react";

// A side panel for the detail views. A drawer rather than a route because
// admin work is a stream of lookups: you open a traveller, read it, close it
// and carry on down the list you were already scrolling.
export default function Drawer({ open, title, subtitle, loading, onClose, children }) {
  // Escape closes it, and the page behind it stops scrolling while it is up.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-2xl bg-paper border-l border-sand shadow-lift overflow-y-auto animate-fade-up"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 bg-paper/95 backdrop-blur border-b border-sand">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-ink-900 truncate">{title}</h2>
            {subtitle && <p className="text-sm text-ink-900/55 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-900/40 hover:text-ink-900 hover:bg-sand/50 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            children
          )}
        </div>
      </aside>
    </div>
  );
}

/** A titled block inside a drawer, with an optional count in the heading. */
export function DrawerSection({ title, count, empty, children }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-900/45 mb-2">
        {title}
        {count !== undefined && <span className="ml-1.5 text-ink-900/30">{count}</span>}
      </h3>
      {count === 0 ? <p className="text-sm text-ink-900/40">{empty}</p> : children}
    </section>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-900/45">{label}</dt>
      <dd className="text-sm text-ink-900 break-words">{children ?? "—"}</dd>
    </div>
  );
}
