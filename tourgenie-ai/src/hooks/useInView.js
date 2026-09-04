import { useEffect, useRef, useState } from "react";

// Tells a section when it has scrolled into view, so it can animate in once
// instead of having already finished animating somewhere above the fold.
//
// It starts `true` in three cases, all of which are the same decision: if the
// reveal cannot run properly, the content must be visible anyway. A landing
// page that hides its own copy behind an observer that never fires is worse
// than a landing page with no animation at all.
export default function useInView({ threshold = 0.15, rootMargin = "0px 0px -10% 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (inView) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Once only. A section that re-hides itself on the way back up turns
        // a scroll into a flicker.
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold, rootMargin]);

  return { ref, inView };
}
