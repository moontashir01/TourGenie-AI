import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import usePresence from "../../hooks/usePresence";

// Transient confirmation. Until now a successful save either wrote a line of
// text into the form and left it there, or said nothing at all — so the two
// most common outcomes in the app, "that worked" and "nothing happened yet",
// looked identical.
//
// Anchored top-right, not bottom-right: the chat dock already owns the
// bottom-right corner, and a toast that lands under the launcher is a toast
// nobody reads. On mobile it spans the top instead, where there is no
// competing furniture.

const TONES = {
  success: { icon: Check, ring: "border-teal/40", chip: "bg-teal-light text-teal-dark" },
  error: { icon: TriangleAlert, ring: "border-sunset/40", chip: "bg-sunset-light text-sunset-dark" },
  info: { icon: Info, ring: "border-sand", chip: "bg-sand text-ink-600" },
};

function ToastItem({ toast, onRemove }) {
  const [open, setOpen] = useState(true);
  const { mounted, exiting } = usePresence(open);
  const timer = useRef(null);
  const tone = TONES[toast.tone] || TONES.info;
  const Icon = tone.icon;

  // Hovering pauses the countdown. A toast carrying a booking reference that
  // expires while it is being read is worse than no toast.
  useEffect(() => {
    if (toast.duration === 0) return undefined;
    timer.current = setTimeout(() => setOpen(false), toast.duration);
    return () => clearTimeout(timer.current);
  }, [toast.duration]);

  // The item, not the provider, decides when it is really gone — it is the
  // only thing that knows its exit animation has finished.
  useEffect(() => {
    if (!mounted) onRemove(toast.id);
  }, [mounted, onRemove, toast.id]);

  if (!mounted) return null;

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={() => {
        if (toast.duration === 0) return;
        timer.current = setTimeout(() => setOpen(false), toast.duration);
      }}
      className={`pointer-events-auto flex items-start gap-3 w-full sm:w-80 bg-surface border ${tone.ring} rounded-xl shadow-lift p-3.5 ${
        exiting ? "animate-fade-out" : "animate-slide-down"
      }`}
    >
      <span className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${tone.chip}`}>
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold text-ink-900">{toast.title}</p>}
        {toast.message && <p className="text-sm text-ink-600 mt-0.5 leading-relaxed">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-ink-900/30 hover:text-ink-900 hover:bg-sand/50 transition-colors duration-fast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastViewport({ toasts, onRemove }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      // aria-live on the container, not the toast: the region has to exist
      // before the message arrives or a screen reader announces nothing.
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-[60] top-4 inset-x-4 sm:inset-x-auto sm:right-5 sm:top-5 flex flex-col items-end gap-2 pointer-events-none print:hidden"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}
