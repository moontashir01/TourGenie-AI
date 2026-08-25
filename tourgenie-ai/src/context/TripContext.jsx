import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { tripsApi, getToken } from "../lib/api";

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
  const [currentTripId, setCurrentTripIdState] = useState(
    () => localStorage.getItem("tourgenie_current_trip") || null
  );
  const [currentTrip, setCurrentTrip] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(false);

  const setCurrentTripId = useCallback((id) => {
    if (id) localStorage.setItem("tourgenie_current_trip", id);
    else localStorage.removeItem("tourgenie_current_trip");
    setCurrentTripIdState(id);
    if (!id) setCurrentTrip(null);
  }, []);

  const loadTrip = useCallback(() => {
    if (!currentTripId || !getToken()) {
      setCurrentTrip(null);
      return;
    }
    setLoadingTrip(true);
    tripsApi
      .get(currentTripId)
      .then(({ trip }) => setCurrentTrip(trip))
      .catch((err) => {
        setCurrentTrip(null);
        // A trip id left in localStorage after the trip was deleted made
        // every trip-scoped page render "Trip not found" with no way back.
        // Clearing it turns that into an ordinary "pick a trip" state.
        if (err.status === 404) setCurrentTripId(null);
      })
      .finally(() => setLoadingTrip(false));
  }, [currentTripId, setCurrentTripId]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  return (
    <TripContext.Provider
      value={{ currentTripId, setCurrentTripId, currentTrip, loadingTrip, refreshCurrentTrip: loadTrip }}
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
