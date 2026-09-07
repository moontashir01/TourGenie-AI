import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { tripsApi, getToken } from "../lib/api";
import { useAuth } from "./AuthContext";

// Tracks which trip the traveler is currently looking at, so pages like
// Itinerary and Budget (reached via sidebar links, not URL params) know
// which trip's data to fetch.
//
// It also loads that trip's summary once, centrally. Six of the sidebar
// destinations only mean anything in the context of a trip, and the nav
// needs to say which one — fetching it here keeps that to a single request
// instead of one per component that wants to name the trip.
const TripContext = createContext(null);

export function TripProvider({ children }) {
  const { user, loading: loadingUser } = useAuth();
  const [currentTripId, setCurrentTripIdState] = useState(
    () => localStorage.getItem("tourgenie_current_trip") || null
  );
  const [currentTrip, setCurrentTrip] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [tripError, setTripError] = useState(false);

  const setCurrentTripId = useCallback((id) => {
    if (id) localStorage.setItem("tourgenie_current_trip", id);
    else localStorage.removeItem("tourgenie_current_trip");
    setCurrentTripIdState(id);
    if (!id) setCurrentTrip(null);
  }, []);

  // Which account this provider is currently holding a trip for. Logging out
  // clears the stored id but not this component's state, so without a reset
  // the next person to sign in on the same browser was shown the previous
  // one's trip in the sidebar until a request happened to 404. Signing in
  // also has to re-run the load: `currentTripId` doesn't change across it, so
  // nothing else would.
  const account = useRef(undefined);
  useEffect(() => {
    const next = user?.id ?? null;
    if (loadingUser || account.current === next) return;
    const first = account.current === undefined;
    account.current = next;
    if (first) return; // boot: the id restored from localStorage stands
    setCurrentTrip(null);
    setTripError(false);
    setCurrentTripIdState(localStorage.getItem("tourgenie_current_trip") || null);
  }, [user?.id, loadingUser]);

  // Resolves to the loaded trip so a page that has just changed something can
  // reuse this fetch for its own copy instead of asking for the same document
  // a second time. Resolves to null when there is nothing to load or the load
  // failed — callers check before using it.
  const loadTrip = useCallback(() => {
    if (!currentTripId || !getToken()) {
      setCurrentTrip(null);
      return Promise.resolve(null);
    }
    setLoadingTrip(true);
    setTripError(false);
    return tripsApi
      .get(currentTripId)
      .then(({ trip }) => {
        setCurrentTrip(trip);
        setTripError(false);
        return trip;
      })
      .catch((err) => {
        setCurrentTrip(null);
        // A trip id left in localStorage after the trip was deleted made
        // every trip-scoped page render "Trip not found" with no way back.
        // Clearing it turns that into an ordinary "pick a trip" state.
        if (err.status === 404) {
          setCurrentTripId(null);
          return null;
        }
        // Anything else (server restarting, network blip) is temporary. The
        // id is still valid, so say so rather than claiming no trip is open.
        setTripError(true);
        return null;
      })
      .finally(() => setLoadingTrip(false));
  }, [currentTripId, setCurrentTripId]);

  // `user?.id` is in here on purpose: signing in has to trigger the fetch
  // that was skipped while there was no token.
  useEffect(() => {
    if (loadingUser) return;
    loadTrip();
  }, [loadTrip, loadingUser, user?.id]);

  return (
    <TripContext.Provider
      value={{ currentTripId, setCurrentTripId, currentTrip, loadingTrip, tripError, refreshCurrentTrip: loadTrip }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useCurrentTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useCurrentTrip must be used inside TripProvider");
  return ctx;
}
