import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { chatApi, getToken } from "../lib/api";
import { useCurrentTrip } from "./TripContext";

// The assistant used to live only at /chat, so asking it to change something
// meant leaving whatever page you were looking at. The dock in AppShell can be
// opened from anywhere — but AppShell is rendered per-page, so it unmounts on
// every navigation. Keeping the conversation here, above the router, is what
// lets the thread survive moving between Itinerary, Budget and Hotels.
const ChatContext = createContext(null);

export const GREETING = {
  role: "assistant",
  content:
    "Hello. I can adjust your itinerary, answer questions about the destination, weather, budget or transport, and rework the plan in plain language. Try one of the chips below, or just tell me what you'd like to change.",
};

export function ChatProvider({ children }) {
  const { currentTripId } = useCurrentTrip();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [sessionId, setSessionId] = useState(null);
  const [quickActions, setQuickActions] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Bumped whenever the assistant rewrites the itinerary. Pages that show
  // itinerary data watch this and refetch — the server deletes and recreates
  // every item on an edit, so the ids change and patching in place won't work.
  const [itineraryVersion, setItineraryVersion] = useState(0);
  // Lets the dock show a dot when a reply arrives while it's closed.
  const [unseen, setUnseen] = useState(false);

  const loadedFor = useRef(undefined);
  // Read inside send() without making it a dependency, so opening the dock
  // doesn't rebuild the callback mid-conversation.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    if (open) setUnseen(false);
  }, [open]);

  useEffect(() => {
    if (!getToken()) return;
    chatApi
      .quickActions()
      .then((res) => setQuickActions(res.quick_actions || []))
      .catch(() => setQuickActions([]));
  }, []);

  // Each trip has its own thread. Switching trips swaps the conversation
  // rather than carrying the previous trip's context across.
  useEffect(() => {
    if (loadedFor.current === currentTripId) return;
    loadedFor.current = currentTripId;

    setMessages([GREETING]);
    setSessionId(null);
    setError("");

    if (!currentTripId || !getToken()) return;

    chatApi
      .session(currentTripId)
      .then((res) => {
        if (res.session?.messages?.length) {
          setMessages(res.session.messages);
          setSessionId(res.session._id);
        }
      })
      .catch(() => {});
  }, [currentTripId]);

  const send = useCallback(
    async (msg) => {
      const trimmed = (msg || "").trim();
      if (!trimmed || sending) return;

      setError("");
      setMessages((m) => [...m, { role: "user", content: trimmed }]);
      setSending(true);

      try {
        const res = await chatApi.send(trimmed, currentTripId, sessionId);
        setSessionId(res.session_id);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: res.reply,
            intent_code: res.intent_code,
            source: res.source,
            applied_changes: res.applied_changes,
          },
        ]);
        if (res.applied_changes) setItineraryVersion((v) => v + 1);
        // A reply that lands while the dock is shut gets a dot on the button.
        if (!openRef.current) setUnseen(true);
        return res;
      } catch (err) {
        setError(err.message || "Couldn't reach the assistant");
        // Drop the optimistic user bubble — it never got a reply.
        setMessages((m) => m.slice(0, -1));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [currentTripId, sessionId, sending]
  );

  const value = useMemo(
    () => ({
      open, setOpen,
      messages, sessionId, quickActions,
      sending, error, setError,
      send,
      itineraryVersion,
      unseen, setUnseen,
    }),
    [open, messages, sessionId, quickActions, sending, error, send, itineraryVersion, unseen]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}
