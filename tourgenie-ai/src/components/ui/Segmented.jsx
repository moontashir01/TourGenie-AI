import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Two-to-four exclusive choices — the view switchers and filter rows the app
// currently draws as a strip of buttons that each toggle their own
// background. Recolouring one button while another goes plain reads as two
// unrelated events; a single thumb sliding between them reads as one
// selection moving, which is what actually happened.
//
// The thumb is measured rather than computed from a fraction, because the
// segments are label-width, not equal-width — "This month" and "All" are not
// the same size, and a 1/n thumb would sit wrong on every one of them.

export default function Segmented({ options = [], value, onChange, size = "md", className = "", label }) {
  const listRef = useRef(null);
  const itemRefs = useRef(new Map());
  const [thumb, setThumb] = useState(null);

  const measure = useCallback(() => {
    const active = itemRefs.current.get(value);
    if (!active) {
      setThumb(null);
      return;
    }
    setThumb({ left: active.offsetLeft, width: active.offsetWidth });
  }, [value]);

  // Layout effect, not effect: measuring after paint would show the thumb in
  // its old place for a frame on first render.
  useLayoutEffect(measure, [measure, options]);

  // Fonts landing late and the container resizing both move the segments
  // under the thumb.
  useEffect(() => {
    const node = listRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const pad = size === "sm" ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2";

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={`relative inline-flex items-center gap-1 p-1 bg-paper border border-sand rounded-full ${className}`}
    >
      {/* The moving part. Transform-only, so it never triggers layout, and
          hidden until the first measurement lands. */}
      {thumb && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-surface shadow-soft transition duration-base ease-tg-out"
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            ref={(node) => {
              if (node) itemRefs.current.set(option.value, node);
              else itemRefs.current.delete(option.value);
            }}
            onClick={() => onChange?.(option.value)}
            className={`relative z-10 inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors duration-fast ${pad} ${
              selected ? "text-ink-900" : "text-ink-900/50 hover:text-ink-900/75"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
