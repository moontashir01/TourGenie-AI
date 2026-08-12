import { createContext, useContext, useState } from "react";

// Tracks which trip the traveler is currently looking at, so pages like
// Itinerary and Budget (reached via sidebar links, not URL params) know
// which trip's data to fetch.
const TripContext = createContext(null);

export function TripProvider({ children }) {
  const [currentTripId, setCurrentTripIdState] = useState(
    () => localStorage.getItem("tourgenie_current_trip") || null
  );

  function setCurrentTripId(id) {
    if (id) localStorage.setItem("tourgenie_current_trip", id);
    else localStorage.removeItem("tourgenie_current_trip");
    setCurrentTripIdState(id);
  }

  return (
    <TripContext.Provider value={{ currentTripId, setCurrentTripId }}>
      {children}
    </TripContext.Provider>
  );
}

export function useCurrentTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useCurrentTrip must be used inside TripProvider");
  return ctx;
}
