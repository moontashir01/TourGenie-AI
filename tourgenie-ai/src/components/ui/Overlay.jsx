import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import usePresence from "../../hooks/usePresence";

// One overlay for every dialog, drawer, sheet and palette in the app.
//
// There were twelve hand-rolled `fixed inset-0` stacks before this, and no
// two agreed: two of them handled Escape, one portalled, none trapped focus
// or gave it back afterwards, and the scrim was black/50 in some places and
// ink-900/40 in others — ink-900 inverts in dark mode, so that second one
// turned the scrim pale exactly where a scrim is meant to be dark. All of
// that is decided once, here.
//
// What this owns, in order of how badly it was missing:
//
//   focus   — the panel takes focus on open, Tab cycles inside it, and the
//             element that opened it gets focus back on close. Without that
//             last part a keyboard user is dropped at the top of the
//             document every time they dismiss a dialog.
//   exit    — via usePresence, so closing animates instead of cutting.
//   scroll  — ref-counted, because admin stacks a confirm dialog on top of
//             an open drawer, and a naive lock/restore pair lets the inner
//             one unlock the page while the outer is still up.
//   escape  — everywhere, not just in the two that remembered.

const VARIANTS = {
  // Centred dialog.
  modal: {
    position: "items-center justify-center p-4",
    panel: "w-full card shadow-lift",
    enter: "animate-scale-in",
    exit: "animate-scale-out",
  },
  // Same motion, parked below the top edge — the command palette's shape.
  palette: {
    position: "items-start justify-center pt-[12vh] px-4",
    panel: "w-full card shadow-lift overflow-hidden",
    enter: "animate-scale-in",
    exit: "animate-scale-out",
  },
  // Full-height side panel, on the inline-end edge. Under RTL that is the
  // left, so the mirrored keyframes are picked in the component below rather
  // than here — a transform can't express "the end edge", and animating the
  // wrong way is worse than not animating.
  drawer: {
    position: "justify-end",
    panel: "h-full w-full bg-paper border-l border-sand shadow-lift overflow-y-auto",
    enter: "animate-drawer-in",
    exit: "animate-drawer-out",
  },
  // Mirror of `drawer`, for panels anchored to the inline-*start* edge — the
  // mobile navigation being the one that matters.
  "drawer-left": {
    position: "justify-start",
    panel: "h-full w-full bg-paper border-r border-sand shadow-lift overflow-y-auto",
    enter: "animate-drawer-left-in",
    exit: "animate-drawer-left-out",
  },
  // A sheet on a phone, a centred dialog on a laptop — which is the right
  // answer for anything with a form in it. A centred modal on a 375px screen
  // wastes both margins and puts the submit button in the middle of nowhere.
  // The breakpoint switches the animation too, so the panel always arrives
  // from the edge it is anchored to.
  adaptive: {
    position: "items-end sm:items-center justify-center p-0 sm:p-4",
    panel:
      "w-full bg-paper rounded-t-2xl sm:rounded-2xl sm:border sm:border-sand shadow-lift max-h-[92vh] overflow-y-auto",
    enter: "animate-sheet-in sm:animate-scale-in",
    exit: "animate-sheet-out sm:animate-scale-out",
  },
  // The mobile form of both of the above.
  sheet: {
    position: "items-end",
    panel: "w-full bg-paper border-t border-sand rounded-t-2xl shadow-lift max-h-[88vh] overflow-y-auto",
    enter: "animate-sheet-in",
    exit: "animate-sheet-out",
  },
};

const SIZES = {
  // 18rem is w-72 — the mobile navigation's width, kept exact so migrating
  // it onto this component didn't quietly resize it.
  xs: "max-w-[18rem]",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-4xl",
};

// The adaptive variant is edge-to-edge below sm, so its cap only applies
// above the breakpoint. Written out rather than built from a template —
// Tailwind scans for literal class names and would never see `sm:${size}`.
const SM_SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  full: "sm:max-w-4xl",
};

// The two drawers are described by physical edge but meant as logical ones:
// `drawer` is the inline-end side and `drawer-left` the inline-start, so under
// RTL they swap. CSS can't do this on its own — `justify-end` and the border
// side would flip with `dir`, but a translateX keyframe would not, and a panel
// that sits on the left while sliding in from the right is worse than one that
// doesn't animate. LanguageContext writes `dir` on <html>, which is what this
// reads.
const RTL_MIRROR = { drawer: "drawer-left", "drawer-left": "drawer" };

function resolveVariant(variant) {
  if (typeof document === "undefined") return variant;
  if (document.documentElement.dir !== "rtl") return variant;
  return RTL_MIRROR[variant] || variant;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// Ref-counted so nested overlays don't unlock the page out from under each
// other, and the scrollbar's width is paid back as padding — otherwise the
// whole layout jumps sideways the instant a dialog opens.
let lockCount = 0;
let restoreStyles = null;

function lockScroll() {
  if (lockCount === 0) {
    const gap = window.innerWidth - document.documentElement.clientWidth;
    restoreStyles = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && restoreStyles) {
    document.body.style.overflow = restoreStyles.overflow;
    document.body.style.paddingRight = restoreStyles.paddingRight;
    restoreStyles = null;
  }
}

export default function Overlay({
  open,
  onClose,
  variant = "modal",
  size = "lg",
  label,
  closeOnBackdrop = true,
  // A dialog mid-submit shouldn't be dismissable — the request is already in
  // flight, and closing loses what was typed for nothing.
  dismissable = true,
  initialFocus,
  className = "",
  // Lands on the full-screen container rather than the panel — the mobile
  // navigation needs `md:hidden` to cover the scrim as well as itself.
  containerClassName = "",
  children,
}) {
  const { mounted, exiting } = usePresence(open);
  const panelRef = useRef(null);
  const returnFocusTo = useRef(null);

  const close = useCallback(() => {
    if (dismissable) onClose?.();
  }, [dismissable, onClose]);

  // Remember who opened this, before the panel takes focus off them.
  useEffect(() => {
    if (!mounted) return undefined;
    returnFocusTo.current = document.activeElement;
    lockScroll();
    return () => {
      unlockScroll();
      // Only restore if focus fell to nowhere. If closing deliberately moved
      // focus somewhere else, don't yank it back.
      const active = document.activeElement;
      if (!active || active === document.body) returnFocusTo.current?.focus?.();
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || exiting) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;

    const target = initialFocus?.current || panel.querySelector(FOCUSABLE) || panel;
    // A panel with nothing focusable in it still has to hold focus itself,
    // or the next Tab escapes to the page behind the scrim.
    if (target === panel) panel.setAttribute("tabindex", "-1");
    target.focus?.({ preventScroll: true });
    return undefined;
  }, [mounted, exiting, initialFocus]);

  useEffect(() => {
    if (!mounted) return undefined;

    function onKey(event) {
      if (event.key === "Escape") {
        // Capture phase + stopPropagation: with a confirm dialog over a
        // drawer, one Escape should close the top one only.
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [mounted, close]);

  if (!mounted) return null;

  const resolved = resolveVariant(variant);
  const spec = VARIANTS[resolved] || VARIANTS.modal;
  // Drawers and sheets fill their axis; only the centred forms take a cap.
  const width =
    resolved === "drawer" || resolved === "drawer-left"
      ? SIZES[size] || SIZES.xl
      : resolved === "adaptive"
        ? SM_SIZES[size] || SM_SIZES.lg
        : resolved === "sheet"
          ? ""
          : SIZES[size] || SIZES.lg;

  return createPortal(
    // print:hidden — a scrim is chrome, and it has no business on paper.
    <div
      className={`fixed inset-0 z-50 flex print:hidden ${spec.position} ${containerClassName}`}
      data-overlay={variant}
    >
      {/* black, not ink-900: ink-900 is near-white in dark mode, which would
          make the scrim a wash instead of a dimmer. */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${
          exiting ? "animate-fade-out" : "animate-fade-in"
        }`}
        onClick={closeOnBackdrop ? close : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // focus:outline-none on the panel only: when it has nothing focusable
        // inside it the panel takes focus itself, and a 2px ring around a
        // whole dialog is noise, not a focus indicator. Every control inside
        // still gets the global one.
        className={`relative focus:outline-none ${spec.panel} ${width} ${
          exiting ? spec.exit : spec.enter
        } ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** The title / subtitle / close row every drawer and modal was rebuilding. */
export function OverlayHeader({ title, subtitle, onClose, sticky = false, children }) {
  return (
    <header
      className={`flex items-start justify-between gap-4 px-6 py-4 border-b border-sand ${
        sticky ? "sticky top-0 z-10 bg-paper/95 backdrop-blur" : ""
      }`}
    >
      <div className="min-w-0">
        <h2 className="font-display text-xl text-ink-900 truncate">{title}</h2>
        {subtitle && <p className="text-sm text-ink-900/55 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-900/40 hover:text-ink-900 hover:bg-sand/50 transition-colors duration-fast"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
