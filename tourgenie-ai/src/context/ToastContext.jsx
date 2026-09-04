import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ToastViewport from "../components/ui/Toast";

// Holds the live toast stack. The provider only owns the list — each toast
// times itself out and reports back when its exit animation is done, because
// the item is the only thing that knows when that is.

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4500;
// Four is about the most anyone reads. Past that the oldest is dropped
// rather than queued: a stale confirmation arriving late is noise.
const MAX_VISIBLE = 4;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const remove = useCallback((id) => {
    setToasts((prev) => (prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : prev));
  }, []);

  const push = useCallback((toast) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((prev) => [...prev, { id, tone: "info", duration: DEFAULT_DURATION, ...toast }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(
    () => ({
      push,
      remove,
      success: (title, message) => push({ tone: "success", title, message }),
      // Errors hold longer — they usually name something the traveller has
      // to go and fix, and 4.5s is not enough to read and act on that.
      error: (title, message) => push({ tone: "error", title, message, duration: 8000 }),
      info: (title, message) => push({ tone: "info", title, message }),
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a ToastProvider");
  return context;
}
