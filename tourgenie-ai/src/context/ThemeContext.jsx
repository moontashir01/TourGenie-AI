import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authApi, getToken } from "../lib/api";
import { useAuth } from "./AuthContext";

// Light, dark, or whatever the operating system is set to.
//
// The choice is stored three ways, deliberately:
//   localStorage — read by the inline script in index.html before React
//                  mounts, so a dark-mode visitor never sees a white flash;
//   this context — what the UI renders from;
//   preferences.theme on the account — so the choice follows the traveller
//                  to another browser. That is the field the User model has
//                  carried since the start with nothing to write it.
const ThemeContext = createContext(null);

const STORAGE_KEY = "tourgenie_theme";
const MODES = ["light", "dark", "system"];

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

/** The class on <html> is what every themed colour actually keys off. */
function paint(resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  // No stored choice means "follow the system" — the same default the User
  // model uses.
  const [theme, setThemeState] = useState(() => readStored() || "system");
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // An explicit local choice outranks the saved account preference: it is
  // the more recent thing the person did, on this device.
  const hasLocalChoice = useRef(Boolean(readStored()));

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    paint(resolved);
  }, [resolved]);

  // Only matters while following the system, but the listener is cheap and
  // unconditional avoids a re-subscribe on every mode change.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Adopt the account's saved theme on login, unless this device has already
  // been told otherwise.
  useEffect(() => {
    const saved = user?.preferences?.theme;
    if (!saved || hasLocalChoice.current || !MODES.includes(saved)) return;
    setThemeState(saved);
  }, [user?.preferences?.theme]);

  const setTheme = useCallback((next) => {
    if (!MODES.includes(next)) return;
    hasLocalChoice.current = true;
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing — the theme still applies for this session.
    }
    // Fire-and-forget: the theme is already applied locally, and a failed
    // sync shouldn't put an error in front of someone who just clicked a
    // toggle.
    if (getToken()) {
      authApi.updateMe({ preferences: { theme: next } }).catch(() => {});
    }
  }, []);

  // What the one-click toggle does: land on the opposite of what's on screen,
  // which is what people expect even when the current mode is "system".
  const toggleTheme = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  const value = useMemo(
    () => ({ theme, resolved, isDark: resolved === "dark", setTheme, toggleTheme }),
    [theme, resolved, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
