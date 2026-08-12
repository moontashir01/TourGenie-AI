// Monthly climate normals, expressed as regional profiles rather than one
// hand-written table per destination — Bangladesh's climate varies by zone
// (coastal, hill, north-east, north-west) far more than it varies between
// cities inside a zone.
//
// Each destination maps to a profile and may carry a temperature offset for
// elevation: Sajek at ~1,800 ft runs several degrees below the hill-tract
// average at the same latitude.
//
// Figures are representative monthly normals — mean daily min/max in °C,
// mean relative humidity in %, mean monthly rainfall in mm, and mean number
// of days with measurable rain.

import { countryPacks } from "./countries/index.js";

const packedClimateProfiles = Object.assign(
  {},
  ...countryPacks.map((pack) => pack.climateProfiles || {}),
);
const packedDestinationClimate = Object.assign(
  {},
  ...countryPacks.map((pack) => pack.destinationClimate || {}),
);

// [temp_min, temp_max, humidity_pct, rain_mm, rain_days] for months 1–12
export const climateProfiles = {
  "bd-plains": {
    label: "Central Bangladesh plains",
    months: [
      [12.7, 25.4, 68, 7, 1], [15.6, 28.6, 62, 25, 2], [20.4, 32.9, 60, 58, 4],
      [23.5, 34.1, 68, 133, 8], [24.6, 33.3, 76, 262, 12], [25.6, 32.0, 82, 359, 16],
      [25.8, 31.4, 84, 435, 19], [25.9, 31.6, 84, 349, 18], [25.6, 31.6, 83, 285, 14],
      [23.7, 31.3, 78, 170, 8], [18.9, 29.4, 72, 34, 2], [14.0, 26.1, 70, 8, 1],
    ],
  },
  "bd-southeast-coast": {
    label: "South-east coast (Bay of Bengal)",
    months: [
      [14.5, 26.6, 72, 5, 1], [17.0, 28.5, 74, 20, 1], [21.0, 30.5, 76, 45, 3],
      [24.0, 32.0, 78, 105, 6], [25.0, 32.0, 81, 290, 13], [25.0, 30.5, 87, 780, 22],
      [24.8, 29.8, 89, 900, 25], [25.0, 30.0, 88, 690, 23], [25.2, 30.8, 86, 400, 16],
      [24.0, 31.5, 81, 205, 8], [20.0, 30.0, 76, 60, 2], [15.5, 27.5, 73, 10, 1],
    ],
  },
  "bd-hill-tracts": {
    label: "Chittagong Hill Tracts",
    months: [
      [10.0, 24.0, 70, 6, 1], [13.0, 27.0, 66, 22, 2], [17.0, 30.0, 65, 55, 4],
      [21.0, 32.0, 72, 140, 8], [23.0, 31.0, 80, 320, 14], [24.0, 30.0, 87, 520, 19],
      [24.0, 29.0, 89, 600, 22], [24.0, 29.0, 88, 480, 20], [24.0, 30.0, 86, 330, 15],
      [22.0, 30.0, 80, 180, 8], [16.0, 28.0, 73, 40, 2], [11.0, 25.0, 71, 8, 1],
    ],
  },
  "bd-northeast": {
    label: "Sylhet basin (wettest region)",
    months: [
      [12.0, 25.0, 72, 10, 1], [14.0, 28.0, 66, 45, 3], [18.0, 30.0, 68, 155, 8],
      [21.0, 31.0, 76, 350, 14], [23.0, 31.0, 81, 570, 19], [25.0, 31.0, 86, 800, 23],
      [25.0, 31.0, 87, 720, 24], [25.0, 32.0, 85, 520, 21], [25.0, 32.0, 84, 400, 17],
      [22.0, 31.0, 80, 200, 9], [17.0, 29.0, 74, 30, 2], [13.0, 26.0, 74, 12, 1],
    ],
  },
  "bd-southwest-coast": {
    label: "South-west coast and delta",
    months: [
      [12.0, 26.0, 72, 8, 1], [15.0, 29.0, 68, 25, 2], [20.0, 32.0, 68, 50, 3],
      [24.0, 34.0, 72, 105, 6], [25.0, 33.0, 78, 235, 11], [26.0, 32.0, 84, 380, 17],
      [26.0, 31.0, 86, 400, 20], [26.0, 31.0, 86, 350, 19], [26.0, 31.0, 84, 300, 15],
      [24.0, 32.0, 79, 170, 7], [19.0, 30.0, 73, 35, 2], [14.0, 27.0, 72, 8, 1],
    ],
  },
  "bd-northwest": {
    label: "North-west (hottest summers, driest winters)",
    months: [
      [10.0, 24.0, 70, 6, 1], [13.0, 28.0, 62, 15, 1], [19.0, 33.0, 54, 25, 2],
      [24.0, 36.0, 58, 65, 4], [25.0, 35.0, 70, 165, 9], [26.0, 33.0, 80, 290, 14],
      [26.0, 32.0, 84, 340, 18], [26.0, 32.0, 84, 300, 17], [26.0, 32.0, 83, 270, 13],
      [23.0, 31.0, 78, 130, 6], [17.0, 29.0, 71, 15, 1], [11.0, 25.0, 71, 5, 1],
    ],
  },
  "np-kathmandu": {
    label: "Kathmandu valley",
    months: [
      [2.0, 19.0, 62, 15, 1], [4.0, 21.0, 55, 20, 2], [8.0, 25.0, 48, 35, 3],
      [12.0, 28.0, 50, 60, 5], [16.0, 29.0, 63, 120, 9], [19.0, 29.0, 76, 240, 14],
      [20.0, 28.0, 84, 375, 21], [20.0, 28.0, 84, 345, 20], [19.0, 28.0, 81, 200, 12],
      [14.0, 27.0, 70, 55, 3], [8.0, 23.0, 65, 8, 1], [3.0, 20.0, 64, 3, 0],
    ],
  },
  "th-bangkok": {
    label: "Central Thailand",
    months: [
      [22.0, 32.0, 68, 10, 1], [24.0, 33.0, 70, 20, 2], [25.0, 34.0, 70, 40, 3],
      [26.0, 35.0, 71, 85, 6], [26.0, 34.0, 75, 250, 15], [25.0, 33.0, 76, 160, 16],
      [25.0, 33.0, 76, 155, 17], [25.0, 32.0, 77, 200, 19], [25.0, 32.0, 80, 340, 21],
      [24.0, 32.0, 79, 270, 17], [23.0, 32.0, 72, 50, 5], [21.0, 31.0, 67, 10, 1],
    ],
  },
  "my-kualalumpur": {
    label: "Peninsular Malaysia",
    months: [
      [23.0, 32.0, 80, 170, 12], [23.0, 33.0, 78, 165, 12], [24.0, 33.0, 80, 235, 15],
      [24.0, 33.0, 82, 280, 18], [24.0, 33.0, 82, 200, 14], [24.0, 33.0, 80, 130, 11],
      [23.0, 32.0, 80, 140, 12], [23.0, 32.0, 81, 155, 13], [23.0, 32.0, 83, 240, 17],
      [23.0, 32.0, 84, 290, 20], [23.0, 32.0, 85, 330, 21], [23.0, 32.0, 84, 240, 17],
    ],
  },
  "ae-dubai": {
    label: "Arabian Gulf desert",
    months: [
      [15.0, 24.0, 65, 18, 2], [16.0, 25.0, 65, 25, 3], [18.0, 28.0, 62, 22, 3],
      [21.0, 32.0, 55, 8, 1], [25.0, 37.0, 52, 1, 0], [27.0, 39.0, 55, 0, 0],
      [30.0, 41.0, 56, 0, 0], [30.0, 41.0, 58, 0, 0], [27.0, 38.0, 60, 0, 0],
      [23.0, 35.0, 60, 1, 0], [19.0, 30.0, 62, 3, 1], [16.0, 26.0, 65, 15, 2],
    ],
  },
  "in-kolkata": {
    label: "Lower Gangetic plain",
    months: [
      [14.0, 26.0, 66, 12, 1], [18.0, 29.0, 62, 25, 2], [22.0, 34.0, 60, 35, 3],
      [25.0, 36.0, 66, 60, 5], [26.0, 36.0, 71, 140, 9], [27.0, 34.0, 80, 290, 14],
      [26.0, 32.0, 84, 395, 19], [26.0, 32.0, 85, 350, 18], [26.0, 32.0, 84, 290, 14],
      [24.0, 32.0, 78, 150, 7], [19.0, 30.0, 70, 20, 1], [14.0, 27.0, 68, 7, 1],
    ],
  },
  "sg-singapore": {
    label: "Equatorial Singapore",
    months: [
      [24.0, 30.0, 84, 240, 15], [25.0, 32.0, 82, 160, 11], [25.0, 32.0, 83, 155, 14],
      [25.0, 32.0, 84, 180, 15], [26.0, 32.0, 84, 170, 15], [26.0, 32.0, 83, 135, 13],
      [25.0, 31.0, 83, 155, 13], [25.0, 31.0, 84, 165, 14], [25.0, 31.0, 84, 155, 13],
      [25.0, 32.0, 84, 190, 16], [24.0, 31.0, 86, 255, 19], [24.0, 30.0, 86, 285, 19],
    ],
  },
  "mv-maldives": {
    label: "Maldives atolls",
    months: [
      [25.0, 30.0, 78, 115, 6], [25.0, 30.0, 77, 40, 4], [26.0, 31.0, 77, 35, 5],
      [26.0, 31.0, 79, 110, 9], [26.0, 31.0, 82, 220, 15], [26.0, 30.0, 83, 175, 13],
      [25.0, 30.0, 82, 150, 12], [25.0, 30.0, 83, 175, 13], [25.0, 30.0, 84, 200, 15],
      [25.0, 30.0, 83, 195, 15], [25.0, 30.0, 83, 200, 13], [25.0, 30.0, 81, 215, 11],
    ],
  },
  ...packedClimateProfiles,
};

// destination slug → { profile, temp_offset_c }
// temp_offset shifts the whole profile for elevation.
export const destinationClimate = {
  dhaka: { profile: "bd-plains" },
  sonargaon: { profile: "bd-plains" },
  "coxs-bazar": { profile: "bd-southeast-coast" },
  "saint-martins": { profile: "bd-southeast-coast", temp_offset_c: 0.5 },
  chattogram: { profile: "bd-southeast-coast", temp_offset_c: -0.5 },
  "nijhum-dwip": { profile: "bd-southeast-coast" },
  "sajek-valley": { profile: "bd-hill-tracts", temp_offset_c: -3.5 },
  bandarban: { profile: "bd-hill-tracts", temp_offset_c: -1.0 },
  rangamati: { profile: "bd-hill-tracts" },
  khagrachari: { profile: "bd-hill-tracts", temp_offset_c: -0.5 },
  sylhet: { profile: "bd-northeast" },
  srimangal: { profile: "bd-northeast", temp_offset_c: -1.0 },
  jaflong: { profile: "bd-northeast", temp_offset_c: -0.5 },
  sundarbans: { profile: "bd-southwest-coast" },
  khulna: { profile: "bd-southwest-coast" },
  bagerhat: { profile: "bd-southwest-coast" },
  barishal: { profile: "bd-southwest-coast" },
  kuakata: { profile: "bd-southwest-coast" },
  rajshahi: { profile: "bd-northwest" },
  paharpur: { profile: "bd-northwest" },
  kathmandu: { profile: "np-kathmandu" },
  bangkok: { profile: "th-bangkok" },
  "kuala-lumpur": { profile: "my-kualalumpur" },
  dubai: { profile: "ae-dubai" },
  kolkata: { profile: "in-kolkata" },
  singapore: { profile: "sg-singapore" },
  male: { profile: "mv-maldives" },
  ...packedDestinationClimate,
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Travel-oriented seasons differ materially across the five core countries;
// these labels are used by the planner, not as formal meteorological seasons.
export function seasonForMonth(month, countryCode = "BD") {
  if (countryCode === "TH") {
    if ([11, 12, 1, 2].includes(month)) return "cool-dry";
    if ([3, 4, 5].includes(month)) return "hot";
    return "rainy";
  }
  if (["MY", "SG"].includes(countryCode)) {
    if ([11, 12, 1, 2, 3].includes(month)) return "northeast-monsoon";
    if ([6, 7, 8, 9].includes(month)) return "southwest-monsoon";
    return "inter-monsoon";
  }
  if (countryCode === "IN") {
    if ([12, 1, 2].includes(month)) return "winter";
    if ([3, 4, 5].includes(month)) return "summer";
    if ([6, 7, 8, 9].includes(month)) return "monsoon";
    return "post-monsoon";
  }
  if (countryCode === "NP") {
    if ([12, 1, 2].includes(month)) return "winter";
    if ([3, 4, 5].includes(month)) return "spring";
    if ([6, 7, 8, 9].includes(month)) return "monsoon";
    return "autumn";
  }
  if (countryCode !== "BD") {
    if ([12, 1, 2].includes(month)) return "winter";
    if ([3, 4, 5].includes(month)) return "spring";
    if ([6, 7, 8].includes(month)) return "summer";
    return "autumn";
  }
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "summer";
  if ([6, 7, 8, 9].includes(month)) return "monsoon";
  return "autumn";
}

// Rough condition label from the month's rain-day count.
export function dominantCondition(rainDays) {
  if (rainDays >= 18) return "heavy-rain";
  if (rainDays >= 12) return "rain";
  if (rainDays >= 6) return "light-rain";
  if (rainDays >= 3) return "partly-cloudy";
  return "clear";
}

export function travelAdvice(month, rainDays, tempMax, tempMin) {
  if (rainDays >= 18) return "Peak monsoon — expect rain most days and possible transport delays. Pack full waterproofs.";
  if (rainDays >= 12) return "Frequent rain. Outdoor plans need a flexible schedule and a backup indoor option.";
  if (tempMax >= 36) return "Very hot. Sightsee early morning and late afternoon; carry more water than you think you need.";
  if (tempMin <= 12) return "Cool to cold, especially at night and at elevation. Bring a warm layer.";
  if (rainDays <= 3 && tempMax <= 33) return "Excellent travel weather — dry, clear and comfortable. This is peak season.";
  return "Generally good travel conditions with occasional showers.";
}

export function isGoodForTravel(rainDays, tempMax) {
  return rainDays < 14 && tempMax < 38;
}

export default { climateProfiles, destinationClimate };
