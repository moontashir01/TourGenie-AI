import { useEffect, useRef, useState } from "react";

// Keeps a node mounted through its own exit animation.
//
// This is the piece every overlay in the app was missing. A dialog rendered
// as `{open && <Dialog/>}` can animate in and can never animate out — the
// moment the flag flips the node is gone, so the closing half of every
// interaction is an instant cut. That asymmetry is most of why the app's
// panels feel abrupt: they arrive politely and vanish.
//
// Caller renders while `mounted` and swaps to the -out animation while
// `exiting`.
const FALLBACK_EXIT_MS = 120;

// The timeout has to agree with the CSS or the node is either cut off
// mid-fade or left hanging after it. Reading --tg-dur-fast keeps that one
// number in index.css instead of two that drift apart.
function exitMs() {
  if (typeof window === "undefined") return FALLBACK_EXIT_MS;
  // The reduced-motion guard flattens the animation to nothing, so waiting
  // out its nominal duration would just be dead time before the unmount.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--tg-dur-fast").trim();
  if (raw.endsWith("ms")) return parseFloat(raw) || FALLBACK_EXIT_MS;
  if (raw.endsWith("s")) return parseFloat(raw) * 1000 || FALLBACK_EXIT_MS;
  return FALLBACK_EXIT_MS;
}

export default function usePresence(open) {
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);

    if (open) {
      // Re-opening during the exit has to cancel it, otherwise the pending
      // timer unmounts a dialog the user has just asked for again.
      setMounted(true);
      setExiting(false);
      return undefined;
    }

    if (!mounted) return undefined;

    setExiting(true);
    timer.current = setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, exitMs());

    return () => clearTimeout(timer.current);
  }, [open, mounted]);

  return { mounted, exiting };
}
