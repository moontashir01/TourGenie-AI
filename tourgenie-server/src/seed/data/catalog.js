import { destinations as legacyDestinations } from "./destinations.js";
import { attractions as legacyAttractions } from "./attractions.js";
import { hotels as legacyHotels } from "./hotels.js";
import { transportOptions as legacyTransportOptions } from "./transport.js";
import { airports as legacyAirports, flightOptions as legacyFlightOptions } from "./aviation.js";
import { routes as legacyRoutes } from "./routes.js";
import { namedServices as legacyNamedServices } from "./nearbyServices.js";
import { itineraryTemplates as legacyItineraryTemplates } from "./itineraryTemplates.js";
import { countryPacks } from "./countries/index.js";

const packedDestinations = countryPacks.flatMap((pack) => pack.destinations || []);
const fromPacks = (key) => countryPacks.flatMap((pack) => pack[key] || []);
function mergeByKey(legacy, packed, key) {
  const rows = new Map(legacy.map((row) => [key(row), row]));
  for (const row of packed) rows.set(key(row), row);
  return [...rows.values()];
}

// Legacy rows remain available for compatibility; a country pack replaces a
// row only when it supplies the same stable key. This preserves existing
// hotel/template records while deepening each catalogue.
export const destinations = mergeByKey(legacyDestinations, packedDestinations, (row) => row.slug);

export const attractions = mergeByKey(legacyAttractions, fromPacks("attractions"), (row) => row.slug);

export const hotels = mergeByKey(legacyHotels, fromPacks("hotels"), (row) => row.slug);

export const transportOptions = mergeByKey(
  legacyTransportOptions,
  fromPacks("transportOptions"),
  (row) => row.code,
);

export const airports = mergeByKey(legacyAirports, fromPacks("airports"), (row) => row.iata);

export const flightOptions = mergeByKey(
  legacyFlightOptions,
  fromPacks("flightOptions"),
  (row) => `${row.flight_number}|${row.from_iata}|${row.to_iata}`,
);

export const routes = mergeByKey(
  legacyRoutes,
  fromPacks("routes"),
  (row) => `${row.from?.name}|${row.to?.name}|${row.mode}|${row.variant || "fastest"}`,
);

export const namedServices = mergeByKey(
  legacyNamedServices,
  fromPacks("namedServices"),
  (row) => `${row.destination_slug}|${row.name}`,
);

export const itineraryTemplates = mergeByKey(
  legacyItineraryTemplates,
  fromPacks("itineraryTemplates"),
  (row) => row.code,
);

export const countryClimateProfiles = Object.assign(
  {},
  ...countryPacks.map((pack) => pack.climateProfiles || {}),
);

export const countryDestinationClimate = Object.assign(
  {},
  ...countryPacks.map((pack) => pack.destinationClimate || {}),
);

export default {
  destinations,
  attractions,
  hotels,
  transportOptions,
  airports,
  flightOptions,
  routes,
  namedServices,
  itineraryTemplates,
  countryClimateProfiles,
  countryDestinationClimate,
};
