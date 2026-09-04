import { useId, useState } from "react";

// A label for a control whose icon isn't self-explanatory. Deliberately
// small: no portal, no collision detection, no positioning library — those
// buy correctness at the edges of the viewport, and every tooltip in this
// app sits on a toolbar in the middle of a page.
//
// It opens on focus as well as hover. A tooltip that only answers a mouse is
// invisible to half the people who need it most, and `title` alone is both
// slow to appear and unstyleable.

export default function Tooltip({ label, placement = "top", children, className = "" }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!label) return children;

  const position =
    placement === "bottom"
      ? "top-full mt-2"
      : placement === "left"
        ? "right-full mr-2 top-1/2 -translate-y-1/2"
        : placement === "right"
          ? "left-full ml-2 top-1/2 -translate-y-1/2"
          : "bottom-full mb-2";
  const centred = placement === "top" || placement === "bottom" ? "left-1/2 -translate-x-1/2" : "";

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          id={id}
          // theme-ink pins this to the light palette: the tooltip is a dark
          // chip in both themes, so its text has to stay the fixed pale one
          // rather than inverting with everything else.
          className={`theme-ink absolute z-50 ${position} ${centred} pointer-events-none whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-2xs font-medium text-paper shadow-lift animate-fade-in`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
