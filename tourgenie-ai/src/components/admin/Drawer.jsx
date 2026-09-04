import { Loader2 } from "lucide-react";
import Overlay, { OverlayHeader } from "../ui/Overlay";

// A side panel for the detail views. A drawer rather than a route because
// admin work is a stream of lookups: you open a traveller, read it, close it
// and carry on down the list you were already scrolling.
//
// The scrim, the Escape key, the scroll lock and the focus handling all moved
// to Overlay — this drawer used to own the first three and none of the
// fourth, and it was the only one of the twelve overlays that even tried.
// What is left here is the shape of the panel's contents.
export default function Drawer({ open, title, subtitle, loading, onClose, children }) {
  return (
    <Overlay open={open} onClose={onClose} variant="drawer" size="xl" label={title}>
      <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} sticky />
      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center gap-2 text-ink-900/50 text-sm py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          children
        )}
      </div>
    </Overlay>
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
      <dt className="text-2xs text-ink-900/45">{label}</dt>
      <dd className="text-sm text-ink-900 break-words">{children ?? "—"}</dd>
    </div>
  );
}
