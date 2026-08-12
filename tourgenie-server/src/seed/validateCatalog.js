import {
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
} from "./data/catalog.js";
import { countries } from "./data/countries.js";
import { pathToFileURL } from "node:url";

export const CORE_COUNTRIES = ["BD", "TH"];
const EXPANDED_COUNTRIES = new Set(CORE_COUNTRIES.filter((code) => code !== "BD"));

function duplicates(rows, key) {
  const seen = new Set();
  const duplicate = new Set();
  for (const row of rows) {
    const value = key(row);
    if (value == null || value === "") continue;
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
}

function hasCoordinates(value) {
  return Number.isFinite(value?.lat) && Number.isFinite(value?.lng);
}

export function validateCatalog({ throwOnError = true } = {}) {
  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);

  const destinationSlugs = new Set(destinations.map((row) => row.slug));
  const destinationNames = new Set(destinations.map((row) => row.name.toLowerCase()));
  const attractionSlugs = new Set(attractions.map((row) => row.slug).filter(Boolean));
  const airportCodes = new Set(airports.map((row) => row.iata));
  const countryByCode = new Map(countries.map((country) => [country.code, country]));

  const uniqueChecks = [
    ["destination slug", destinations, (row) => row.slug],
    ["attraction slug", attractions, (row) => row.slug],
    ["hotel slug", hotels, (row) => row.slug],
    ["transport code", transportOptions, (row) => row.code],
    ["airport IATA", airports, (row) => row.iata],
    ["itinerary code", itineraryTemplates, (row) => row.code],
    ["route key", routes, (row) => `${row.from?.name}|${row.to?.name}|${row.mode}|${row.variant || "default"}`],
  ];
  for (const [label, rows, key] of uniqueChecks) {
    for (const value of duplicates(rows, key)) fail(`duplicate ${label}: "${value}"`);
  }

  for (const destination of destinations) {
    if (!destination.slug || !destination.name || !destination.type) {
      fail(`destination is missing a required slug/name/type: ${JSON.stringify(destination)}`);
    }
    if (!hasCoordinates(destination.lat_lng)) fail(`destination "${destination.slug}" has invalid coordinates`);
    if (EXPANDED_COUNTRIES.has(destination.country_code)) {
      for (const field of ["country", "timezone", "currency"]) {
        if (!destination[field]) fail(`destination "${destination.slug}" is missing ${field}`);
      }
    }
    const country = countryByCode.get(destination.country_code || "BD");
    if (!country) fail(`destination "${destination.slug}" references unknown country code ${destination.country_code}`);
    else if (destination.country && destination.country !== country.name) {
      fail(`destination "${destination.slug}" country name does not match ${country.code}`);
    }
    if (destination.nearest_airport && !airportCodes.has(destination.nearest_airport)) {
      fail(`destination "${destination.slug}" references unknown airport ${destination.nearest_airport}`);
    }
  }

  const childCollections = [
    ["attraction", attractions],
    ["hotel", hotels],
    ["nearby service", namedServices],
    ["itinerary template", itineraryTemplates],
  ];
  for (const [label, rows] of childCollections) {
    for (const row of rows) {
      if (!destinationSlugs.has(row.destination_slug)) {
        fail(`${label} "${row.slug || row.code || row.name}" references unknown destination "${row.destination_slug}"`);
      }
    }
  }

  for (const airport of airports) {
    if (!hasCoordinates(airport.lat_lng)) fail(`airport ${airport.iata} has invalid coordinates`);
    if (airport.destination_slug && !destinationSlugs.has(airport.destination_slug)) {
      fail(`airport ${airport.iata} references unknown destination "${airport.destination_slug}"`);
    }
  }

  for (const flight of flightOptions) {
    if (!airportCodes.has(flight.from_iata)) fail(`flight ${flight.flight_number} has unknown origin ${flight.from_iata}`);
    if (!airportCodes.has(flight.to_iata)) fail(`flight ${flight.flight_number} has unknown destination ${flight.to_iata}`);
    if (!Number.isFinite(flight.total_fare_bdt)) fail(`flight ${flight.flight_number} has no BDT total fare`);
  }

  const unresolvedLegacyTransportNames = new Set(["hatiya", "teknaf"]);
  for (const option of transportOptions) {
    for (const [side, name] of [["origin", option.from_city], ["destination", option.to_city]]) {
      if (!destinationNames.has(String(name).toLowerCase()) && !unresolvedLegacyTransportNames.has(String(name).toLowerCase())) {
        fail(`transport ${option.code || option.operator} has unknown ${side} city "${name}"`);
      }
    }
  }

  for (const route of routes) {
    for (const [side, endpoint] of [["origin", route.from], ["destination", route.to]]) {
      if (!endpoint?.name || !hasCoordinates(endpoint.lat_lng)) {
        fail(`route ${route.from?.name || "?"} → ${route.to?.name || "?"} has invalid ${side}`);
      }
      if (endpoint?.slug && !destinationSlugs.has(endpoint.slug) && !attractionSlugs.has(endpoint.slug)) {
        // Teknaf is an intentional legacy city endpoint that predates the
        // destination catalogue.
        if (endpoint.slug !== "teknaf") fail(`route endpoint references unknown slug "${endpoint.slug}"`);
      }
    }
    if (!Array.isArray(route.geometry) || route.geometry.length < 2) {
      fail(`route ${route.from?.name} → ${route.to?.name} needs at least two geometry points`);
    }
  }

  for (const template of itineraryTemplates) {
    if (template.days?.length !== template.duration_days) {
      fail(`itinerary "${template.code}" duration is ${template.duration_days} but contains ${template.days?.length || 0} days`);
    }
    for (const day of template.days || []) {
      for (const item of day.items || []) {
        if (item.attraction_slug && !attractionSlugs.has(item.attraction_slug)) {
          fail(`itinerary "${template.code}" references unknown attraction "${item.attraction_slug}"`);
        }
      }
    }
  }

  const countryCounts = Object.fromEntries(
    CORE_COUNTRIES.map((code) => [code, destinations.filter((row) => (row.country_code || "BD") === code).length]),
  );
  const coreCountryRows = countries.filter((country) => country.is_core);
  if (coreCountryRows.length !== CORE_COUNTRIES.length) {
    fail(`country reference must contain ${CORE_COUNTRIES.length} core rows; found ${coreCountryRows.length}`);
  }
  for (const code of CORE_COUNTRIES) {
    const country = countryByCode.get(code);
    if (!country?.is_core) fail(`${code} is missing from the core country reference`);
    if (country?.primary_airport && !airportCodes.has(country.primary_airport)) {
      fail(`${code} references unknown primary airport ${country.primary_airport}`);
    }
  }
  if (countryCounts.BD < 20) fail(`Bangladesh catalogue unexpectedly has only ${countryCounts.BD} destinations`);
  for (const code of EXPANDED_COUNTRIES) {
    if (countryCounts[code] !== 5) fail(`${code} must contain 5 core destinations; found ${countryCounts[code]}`);
  }

  for (const destination of destinations.filter((row) => EXPANDED_COUNTRIES.has(row.country_code))) {
    const attractionCount = attractions.filter((row) => row.destination_slug === destination.slug).length;
    const hotelCount = hotels.filter((row) => row.destination_slug === destination.slug).length;
    const serviceCount = namedServices.filter((row) => row.destination_slug === destination.slug).length;
    const templateCount = itineraryTemplates.filter((row) => row.destination_slug === destination.slug).length;
    if (attractionCount < 4) fail(`${destination.slug} needs at least 4 attractions; found ${attractionCount}`);
    if (hotelCount < 2) fail(`${destination.slug} needs at least 2 hotels; found ${hotelCount}`);
    if (serviceCount < 2) fail(`${destination.slug} needs at least 2 named services; found ${serviceCount}`);
    if (templateCount < 1) fail(`${destination.slug} needs an itinerary template`);

    const climate = countryDestinationClimate[destination.slug];
    if (!climate) fail(`${destination.slug} has no climate mapping`);
    else if (!countryClimateProfiles[climate.profile]) {
      fail(`${destination.slug} references unknown climate profile "${climate.profile}"`);
    }
  }

  for (const name of duplicates(destinations, (row) => row.name.toLowerCase())) {
    warn(`destination name is not globally unique: "${name}"; prefer slug/ID resolution`);
  }

  const summary = {
    countries: new Set(destinations.map((row) => row.country_code || "BD")).size,
    countryReferenceRows: countries.length,
    coreCountryCounts: countryCounts,
    destinations: destinations.length,
    attractions: attractions.length,
    hotels: hotels.length,
    transportOptions: transportOptions.length,
    airports: airports.length,
    flightOptions: flightOptions.length,
    routes: routes.length,
    namedServices: namedServices.length,
    itineraryTemplates: itineraryTemplates.length,
  };

  if (throwOnError && errors.length) {
    const error = new Error(`Seed catalogue validation failed with ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    error.validationWarnings = warnings;
    throw error;
  }

  return { errors, warnings, summary };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = validateCatalog();
    console.log("Seed catalogue is valid.");
    console.log(JSON.stringify(result.summary, null, 2));
    for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
