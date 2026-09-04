import { useEffect, useState } from "react";

// The JS half of the prefers-reduced-motion guard in index.css. That guard
// flattens CSS animations, but it cannot reach animation driven from
// JavaScript — a number counting up, a scroll-reveal observer, a chart
// tweening its bars. Those have to ask, and skip straight to the end state.
//
// The listener matters: the setting is changed while the app is open (macOS
// and Windows both expose it as a live OS toggle), and a value read once at
// mount would leave a motion-sensitive user animating until they reload.
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
