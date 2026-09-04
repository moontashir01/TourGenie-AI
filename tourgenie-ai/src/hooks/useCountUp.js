import { useEffect, useRef, useState } from "react";
import useReducedMotion from "./useReducedMotion";

// Tweens a number to its new value. Used by the stat tiles and the budget
// totals — a figure that slides up reads as the app computing something,
// where the same figure appearing instantly reads as it having been there
// all along.
//
// Two rules keep it from being a gimmick:
//   - it only runs on a real change, so a re-render for an unrelated reason
//     doesn't re-animate a number that hasn't moved;
//   - it never runs under reduced motion, where a number flickering through
//     forty intermediate values is exactly the effect being asked about.
export default function useCountUp(target, { duration = 700 } = {}) {
  const reduced = useReducedMotion();
  const numeric = typeof target === "number" && Number.isFinite(target);
  const [display, setDisplay] = useState(numeric ? target : 0);
  const from = useRef(numeric ? target : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (!numeric) return undefined;
    if (reduced || from.current === target) {
      from.current = target;
      setDisplay(target);
      return undefined;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = target - origin;

    function step(now) {
      const progress = Math.min(1, (now - start) / duration);
      // Cubic ease-out, matching --tg-ease-out's shape: most of the distance
      // early, so the number reads before it has finished settling.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(origin + delta * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        from.current = target;
      }
    }

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, numeric, reduced, duration]);

  return numeric ? display : target;
}
