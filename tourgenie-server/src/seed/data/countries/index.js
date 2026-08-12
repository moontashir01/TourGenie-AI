import { thailandPack } from "./thailand.js";

// Bangladesh remains in the original seed files. Thailand is the first
// international country pack with full destination coverage.
export const countryPacks = [thailandPack];

export const expandedCountryCodes = new Set(countryPacks.map((pack) => pack.countryCode));

export default countryPacks;
