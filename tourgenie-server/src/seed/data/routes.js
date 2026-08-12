// FR-06 — precomputed routes, replacing the OpenRouteService call.
//
// `geometry.coordinates` is a simplified [lng, lat] polyline — enough points
// to draw a recognisable line on the map without storing full-precision
// road geometry. Distances and durations are realistic road figures for the
// corridor; durations assume normal (not festival-period) traffic.

const P = (lat, lng) => [lng, lat]; // GeoJSON is [lng, lat] — this keeps the
// literals below readable as lat/lng while storing them the right way round.

export const routes = [
  // ─────────────── Dhaka → Cox's Bazar (N1 corridor) ───────────────
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Cox's Bazar", kind: "city", slug: "coxs-bazar", lat_lng: { lat: 21.4272, lng: 91.9704 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 414, duration_min: 540,
    est_fare_bdt: 1800, toll_bdt: 550, fuel_cost_bdt: 5200, carbon_kg: 28.4,
    geometry: [P(23.8103, 90.4125), P(23.7, 90.55), P(23.46, 91.18), P(23.24, 91.29), P(23.01, 91.4), P(22.68, 91.55), P(22.3569, 91.7832), P(22.05, 91.95), P(21.78, 92.08), P(21.6, 92.05), P(21.4272, 91.9704)],
    legs: [
      { sequence: 1, instruction: "Leave Dhaka via the Kanchpur Bridge onto the N1", road: "N1", distance_km: 25, duration_min: 55, via: "Kanchpur" },
      { sequence: 2, instruction: "Continue on the N1 through Daudkandi to Cumilla", road: "N1", distance_km: 72, duration_min: 85, via: "Cumilla" },
      { sequence: 3, instruction: "Continue on the N1 to Feni", road: "N1", distance_km: 63, duration_min: 75, via: "Feni" },
      { sequence: 4, instruction: "Continue on the N1 to Chattogram", road: "N1", distance_km: 104, duration_min: 115, via: "Chattogram" },
      { sequence: 5, instruction: "Take the N1 south through Chakaria", road: "N1", distance_km: 108, duration_min: 130, via: "Chakaria" },
      { sequence: 6, instruction: "Continue to Cox's Bazar and the Kolatoli hotel zone", road: "N1", distance_km: 42, duration_min: 80, via: "Ramu" },
    ],
    notes: "The Chattogram bypass saves roughly 40 minutes over routing through the city centre.",
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Cox's Bazar", kind: "city", slug: "coxs-bazar", lat_lng: { lat: 21.4272, lng: 91.9704 } },
    mode: "train", profile: "rail", variant: "cheapest",
    distance_km: 550, duration_min: 525,
    est_fare_bdt: 1150, carbon_kg: 19.3,
    geometry: [P(23.8103, 90.4125), P(23.62, 90.72), P(23.46, 91.18), P(23.01, 91.4), P(22.3569, 91.7832), P(22.1, 92.0), P(21.78, 92.08), P(21.4272, 91.9704)],
    legs: [
      { sequence: 1, instruction: "Depart Kamalapur on the Cox's Bazar Express", road: "Dhaka–Chattogram line", distance_km: 320, duration_min: 320, via: "Cumilla" },
      { sequence: 2, instruction: "Continue on the Dohazari–Cox's Bazar line", road: "Dohazari line", distance_km: 230, duration_min: 205, via: "Chakaria" },
    ],
    notes: "Longer track distance than the road, but no traffic — reliably the most predictable option.",
  },

  // ─────────────── Dhaka → other divisional cities ───────────────
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Chattogram", kind: "city", slug: "chattogram", lat_lng: { lat: 22.3569, lng: 91.7832 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 264, duration_min: 330,
    est_fare_bdt: 900, toll_bdt: 350, fuel_cost_bdt: 3300, carbon_kg: 18.1,
    geometry: [P(23.8103, 90.4125), P(23.7, 90.55), P(23.46, 91.18), P(23.01, 91.4), P(22.68, 91.55), P(22.3569, 91.7832)],
    legs: [
      { sequence: 1, instruction: "Take the N1 east out of Dhaka", road: "N1", distance_km: 97, duration_min: 130, via: "Cumilla" },
      { sequence: 2, instruction: "Continue on the N1 through Feni", road: "N1", distance_km: 63, duration_min: 75, via: "Feni" },
      { sequence: 3, instruction: "Continue on the N1 into Chattogram", road: "N1", distance_km: 104, duration_min: 125, via: "Mirsharai" },
    ],
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Sylhet", kind: "city", slug: "sylhet", lat_lng: { lat: 24.8949, lng: 91.8687 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 240, duration_min: 330,
    est_fare_bdt: 700, toll_bdt: 120, fuel_cost_bdt: 3000, carbon_kg: 16.5,
    geometry: [P(23.8103, 90.4125), P(23.92, 90.72), P(24.05, 90.98), P(24.25, 91.12), P(24.47, 91.28), P(24.7, 91.6), P(24.8949, 91.8687)],
    legs: [
      { sequence: 1, instruction: "Take the N2 north-east via Narsingdi", road: "N2", distance_km: 55, duration_min: 80, via: "Narsingdi" },
      { sequence: 2, instruction: "Continue on the N2 through Bhairab and Sarail", road: "N2", distance_km: 90, duration_min: 115, via: "Bhairab" },
      { sequence: 3, instruction: "Continue on the N2 via Sherpur into Sylhet", road: "N2", distance_km: 95, duration_min: 135, via: "Sherpur" },
    ],
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Srimangal", kind: "city", slug: "srimangal", lat_lng: { lat: 24.3065, lng: 91.7296 } },
    mode: "train", profile: "rail", variant: "fastest", is_default: true,
    distance_km: 196, duration_min: 290,
    est_fare_bdt: 500, carbon_kg: 6.9,
    geometry: [P(23.8103, 90.4125), P(23.95, 90.7), P(24.05, 90.98), P(24.15, 91.25), P(24.25, 91.55), P(24.3065, 91.7296)],
    legs: [
      { sequence: 1, instruction: "Depart Kamalapur on the Parabat Express", road: "Dhaka–Sylhet line", distance_km: 110, duration_min: 160, via: "Bhairab" },
      { sequence: 2, instruction: "Continue via Shayestaganj to Srimangal", road: "Dhaka–Sylhet line", distance_km: 86, duration_min: 130, via: "Shayestaganj" },
    ],
    notes: "The train is the standard way to reach Srimangal — the station is a short rickshaw ride from the tea estates.",
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Khulna", kind: "city", slug: "khulna", lat_lng: { lat: 22.8456, lng: 89.5403 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 210, duration_min: 240,
    est_fare_bdt: 750, toll_bdt: 750, fuel_cost_bdt: 2650, carbon_kg: 14.4,
    geometry: [P(23.8103, 90.4125), P(23.65, 90.32), P(23.42, 90.26), P(23.25, 90.1), P(23.05, 89.85), P(22.95, 89.68), P(22.8456, 89.5403)],
    legs: [
      { sequence: 1, instruction: "Head south-west out of Dhaka to the Padma Bridge", road: "N8", distance_km: 40, duration_min: 55, via: "Mawa" },
      { sequence: 2, instruction: "Cross the Padma Bridge", road: "Padma Bridge", distance_km: 6.15, duration_min: 8, via: "Padma Bridge" },
      { sequence: 3, instruction: "Continue on the N8 / N7 via Faridpur and Jashore", road: "N7", distance_km: 164, duration_min: 177, via: "Jashore" },
    ],
    notes: "The Padma Bridge cut this journey from around 8 hours to roughly 4.",
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Barishal", kind: "city", slug: "barishal", lat_lng: { lat: 22.701, lng: 90.3535 } },
    mode: "launch", profile: "waterway", variant: "scenic", is_default: true,
    distance_km: 178, duration_min: 510,
    est_fare_bdt: 1400, carbon_kg: 11.2,
    geometry: [P(23.7104, 90.4074), P(23.55, 90.5), P(23.3, 90.62), P(23.22, 90.65), P(22.98, 90.55), P(22.85, 90.42), P(22.701, 90.3535)],
    legs: [
      { sequence: 1, instruction: "Depart Sadarghat on the overnight launch down the Buriganga", road: "Buriganga", distance_km: 45, duration_min: 120, via: "Munshiganj" },
      { sequence: 2, instruction: "Continue down the Meghna past Chandpur", road: "Meghna", distance_km: 78, duration_min: 220, via: "Chandpur" },
      { sequence: 3, instruction: "Enter the Kirtankhola river into Barishal", road: "Kirtankhola", distance_km: 55, duration_min: 170, via: "Hizla" },
    ],
    notes: "The journey is the attraction — book a cabin on the upper deck. Sunset leaving Dhaka, sunrise arriving Barishal.",
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Barishal", kind: "city", slug: "barishal", lat_lng: { lat: 22.701, lng: 90.3535 } },
    mode: "driving", profile: "driving-car", variant: "fastest",
    distance_km: 168, duration_min: 210,
    est_fare_bdt: 700, toll_bdt: 750, fuel_cost_bdt: 2100, carbon_kg: 11.5,
    geometry: [P(23.8103, 90.4125), P(23.65, 90.32), P(23.42, 90.26), P(23.15, 90.2), P(22.92, 90.28), P(22.701, 90.3535)],
    legs: [
      { sequence: 1, instruction: "Take the N8 south to the Padma Bridge", road: "N8", distance_km: 40, duration_min: 55, via: "Mawa" },
      { sequence: 2, instruction: "Cross the bridge and continue on the N8", road: "Padma Bridge / N8", distance_km: 128, duration_min: 155, via: "Madaripur" },
    ],
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Kuakata", kind: "city", slug: "kuakata", lat_lng: { lat: 21.8168, lng: 90.1206 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 283, duration_min: 420,
    est_fare_bdt: 900, toll_bdt: 850, fuel_cost_bdt: 3550, carbon_kg: 19.4,
    geometry: [P(23.8103, 90.4125), P(23.65, 90.32), P(23.42, 90.26), P(23.15, 90.2), P(22.92, 90.28), P(22.701, 90.3535), P(22.35, 90.32), P(22.05, 90.2), P(21.8168, 90.1206)],
    legs: [
      { sequence: 1, instruction: "Take the N8 to the Padma Bridge and on to Barishal", road: "N8", distance_km: 168, duration_min: 210, via: "Barishal" },
      { sequence: 2, instruction: "Continue south through Patuakhali", road: "N8 / R870", distance_km: 115, duration_min: 210, via: "Patuakhali" },
    ],
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Rajshahi", kind: "city", slug: "rajshahi", lat_lng: { lat: 24.3745, lng: 88.6042 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 256, duration_min: 360,
    est_fare_bdt: 800, toll_bdt: 200, fuel_cost_bdt: 3200, carbon_kg: 17.6,
    geometry: [P(23.8103, 90.4125), P(24.0, 90.15), P(24.25, 89.75), P(24.45, 89.7), P(24.42, 89.2), P(24.4, 88.9), P(24.3745, 88.6042)],
    legs: [
      { sequence: 1, instruction: "Take the N5 north-west towards Tangail", road: "N5", distance_km: 95, duration_min: 130, via: "Tangail" },
      { sequence: 2, instruction: "Cross the Bangabandhu Bridge into Sirajganj", road: "Bangabandhu Bridge", distance_km: 30, duration_min: 45, via: "Sirajganj" },
      { sequence: 3, instruction: "Continue on the N6 via Natore into Rajshahi", road: "N6", distance_km: 131, duration_min: 185, via: "Natore" },
    ],
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Khagrachari", kind: "city", slug: "khagrachari", lat_lng: { lat: 23.1193, lng: 91.9847 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 275, duration_min: 480,
    est_fare_bdt: 1000, toll_bdt: 300, fuel_cost_bdt: 3450, carbon_kg: 18.9,
    geometry: [P(23.8103, 90.4125), P(23.7, 90.55), P(23.46, 91.18), P(23.24, 91.29), P(23.01, 91.4), P(23.05, 91.7), P(23.1193, 91.9847)],
    legs: [
      { sequence: 1, instruction: "Take the N1 to Cumilla", road: "N1", distance_km: 97, duration_min: 130, via: "Cumilla" },
      { sequence: 2, instruction: "Continue on the N1 to Feni", road: "N1", distance_km: 63, duration_min: 75, via: "Feni" },
      { sequence: 3, instruction: "Take the R160 east into the hill tracts", road: "R160", distance_km: 115, duration_min: 275, via: "Matiranga" },
    ],
    notes: "The final hill section is slow and winding — allow more time than the distance suggests.",
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Bandarban", kind: "city", slug: "bandarban", lat_lng: { lat: 22.1953, lng: 92.2184 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 332, duration_min: 510,
    est_fare_bdt: 1100, toll_bdt: 400, fuel_cost_bdt: 4150, carbon_kg: 22.8,
    geometry: [P(23.8103, 90.4125), P(23.46, 91.18), P(23.01, 91.4), P(22.68, 91.55), P(22.3569, 91.7832), P(22.28, 92.0), P(22.1953, 92.2184)],
    legs: [
      { sequence: 1, instruction: "Take the N1 to Chattogram", road: "N1", distance_km: 264, duration_min: 330, via: "Chattogram" },
      { sequence: 2, instruction: "Take the Chattogram–Bandarban road via Keranihat", road: "R170", distance_km: 68, duration_min: 180, via: "Keranihat" },
    ],
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Rangamati", kind: "city", slug: "rangamati", lat_lng: { lat: 22.6533, lng: 92.1751 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 310, duration_min: 480,
    est_fare_bdt: 1050, toll_bdt: 400, fuel_cost_bdt: 3900, carbon_kg: 21.3,
    geometry: [P(23.8103, 90.4125), P(23.46, 91.18), P(23.01, 91.4), P(22.68, 91.55), P(22.3569, 91.7832), P(22.5, 92.0), P(22.6533, 92.1751)],
    legs: [
      { sequence: 1, instruction: "Take the N1 to Chattogram", road: "N1", distance_km: 264, duration_min: 330, via: "Chattogram" },
      { sequence: 2, instruction: "Take the Chattogram–Rangamati road", road: "N106", distance_km: 46, duration_min: 150, via: "Kaptai junction" },
    ],
  },

  // ─────────────── Regional connections ───────────────
  {
    from: { name: "Chattogram", kind: "city", slug: "chattogram", lat_lng: { lat: 22.3569, lng: 91.7832 } },
    to: { name: "Cox's Bazar", kind: "city", slug: "coxs-bazar", lat_lng: { lat: 21.4272, lng: 91.9704 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 152, duration_min: 210,
    est_fare_bdt: 400, toll_bdt: 100, fuel_cost_bdt: 1900, carbon_kg: 10.4,
    geometry: [P(22.3569, 91.7832), P(22.15, 91.9), P(21.95, 91.98), P(21.78, 92.08), P(21.6, 92.05), P(21.4272, 91.9704)],
    legs: [
      { sequence: 1, instruction: "Head south on the N1 from Chattogram", road: "N1", distance_km: 78, duration_min: 95, via: "Lohagara" },
      { sequence: 2, instruction: "Continue through Chakaria and Ramu", road: "N1", distance_km: 74, duration_min: 115, via: "Chakaria" },
    ],
  },
  {
    from: { name: "Khagrachari", kind: "city", slug: "khagrachari", lat_lng: { lat: 23.1193, lng: 91.9847 } },
    to: { name: "Sajek Valley", kind: "city", slug: "sajek-valley", lat_lng: { lat: 23.3819, lng: 92.2942 } },
    mode: "driving", profile: "driving-car", variant: "scenic", is_default: true,
    distance_km: 70, duration_min: 150,
    est_fare_bdt: 400, fuel_cost_bdt: 900, carbon_kg: 4.8,
    geometry: [P(23.1193, 91.9847), P(23.18, 92.05), P(23.2167, 92.0833), P(23.28, 92.16), P(23.33, 92.24), P(23.3819, 92.2942)],
    legs: [
      { sequence: 1, instruction: "Drive from Khagrachari town to the Dighinala convoy point", road: "R160", distance_km: 25, duration_min: 45, via: "Dighinala" },
      { sequence: 2, instruction: "Join the escorted convoy up the Sajek hill road", road: "Sajek Road", distance_km: 45, duration_min: 105, via: "Baghaichari" },
    ],
    notes: "Convoys leave at fixed times (typically 10:30 and 15:00) — the departure schedule, not the distance, governs this leg.",
  },
  {
    from: { name: "Cox's Bazar", kind: "city", slug: "coxs-bazar", lat_lng: { lat: 21.4272, lng: 91.9704 } },
    to: { name: "Teknaf", kind: "city", lat_lng: { lat: 20.8639, lng: 92.3058 } },
    mode: "driving", profile: "driving-car", variant: "scenic", is_default: true,
    distance_km: 84, duration_min: 120,
    est_fare_bdt: 200, fuel_cost_bdt: 1050, carbon_kg: 5.8,
    geometry: [P(21.4272, 91.9704), P(21.36, 92.0), P(21.28, 92.05), P(21.15, 92.15), P(21.0, 92.22), P(20.8639, 92.3058)],
    legs: [
      { sequence: 1, instruction: "Follow Marine Drive south along the coast", road: "Marine Drive", distance_km: 48, duration_min: 65, via: "Inani" },
      { sequence: 2, instruction: "Continue on Marine Drive to Teknaf jetty", road: "Marine Drive", distance_km: 36, duration_min: 55, via: "Shamlapur" },
    ],
    notes: "One of the most scenic drives in the country — sea on the right, hills on the left the whole way.",
  },
  {
    from: { name: "Sylhet", kind: "city", slug: "sylhet", lat_lng: { lat: 24.8949, lng: 91.8687 } },
    to: { name: "Jaflong", kind: "city", slug: "jaflong", lat_lng: { lat: 25.1667, lng: 92.0167 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 62, duration_min: 105,
    est_fare_bdt: 120, fuel_cost_bdt: 780, carbon_kg: 4.3,
    geometry: [P(24.8949, 91.8687), P(24.95, 91.92), P(25.02, 91.95), P(25.09, 91.98), P(25.1667, 92.0167)],
    legs: [
      { sequence: 1, instruction: "Take the Sylhet–Tamabil highway north-east", road: "N2", distance_km: 42, duration_min: 65, via: "Gowainghat" },
      { sequence: 2, instruction: "Continue to Jaflong Zero Point", road: "N2", distance_km: 20, duration_min: 40, via: "Tamabil" },
    ],
  },
  {
    from: { name: "Sylhet", kind: "city", slug: "sylhet", lat_lng: { lat: 24.8949, lng: 91.8687 } },
    to: { name: "Srimangal", kind: "city", slug: "srimangal", lat_lng: { lat: 24.3065, lng: 91.7296 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 78, duration_min: 120,
    est_fare_bdt: 180, fuel_cost_bdt: 980, carbon_kg: 5.4,
    geometry: [P(24.8949, 91.8687), P(24.78, 91.84), P(24.62, 91.79), P(24.48, 91.77), P(24.3065, 91.7296)],
    legs: [
      { sequence: 1, instruction: "Take the N2 south-west towards Maulvibazar", road: "N2", distance_km: 48, duration_min: 70, via: "Maulvibazar" },
      { sequence: 2, instruction: "Continue on the R210 to Srimangal", road: "R210", distance_km: 30, duration_min: 50, via: "Kamalganj" },
    ],
  },
  {
    from: { name: "Khulna", kind: "city", slug: "khulna", lat_lng: { lat: 22.8456, lng: 89.5403 } },
    to: { name: "Sundarbans", kind: "city", slug: "sundarbans", lat_lng: { lat: 22.4022, lng: 89.5875 } },
    mode: "launch", profile: "waterway", variant: "fastest", is_default: true,
    distance_km: 62, duration_min: 240,
    est_fare_bdt: 0, carbon_kg: 3.9,
    geometry: [P(22.8456, 89.5403), P(22.75, 89.56), P(22.63, 89.58), P(22.5, 89.6), P(22.4022, 89.5875)],
    legs: [
      { sequence: 1, instruction: "Depart the BIWTA ghat down the Rupsha and Pasur rivers", road: "Rupsha–Pasur", distance_km: 40, duration_min: 150, via: "Mongla" },
      { sequence: 2, instruction: "Enter the forest channel to Karamjal", road: "Pasur", distance_km: 22, duration_min: 90, via: "Karamjal" },
    ],
    notes: "Included in every cruise package — the fare shown is zero because it is priced into the package, not sold separately.",
  },
  {
    from: { name: "Khulna", kind: "city", slug: "khulna", lat_lng: { lat: 22.8456, lng: 89.5403 } },
    to: { name: "Bagerhat", kind: "city", slug: "bagerhat", lat_lng: { lat: 22.6602, lng: 89.7895 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 36, duration_min: 60,
    est_fare_bdt: 90, fuel_cost_bdt: 450, carbon_kg: 2.5,
    geometry: [P(22.8456, 89.5403), P(22.8, 89.6), P(22.74, 89.68), P(22.7, 89.74), P(22.6602, 89.7895)],
    legs: [
      { sequence: 1, instruction: "Cross the Rupsha Bridge and take the N7 east", road: "N7", distance_km: 36, duration_min: 60, via: "Rupsha" },
    ],
  },
  {
    from: { name: "Dhaka", kind: "city", slug: "dhaka", lat_lng: { lat: 23.8103, lng: 90.4125 } },
    to: { name: "Sonargaon", kind: "city", slug: "sonargaon", lat_lng: { lat: 23.6486, lng: 90.6006 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 27, duration_min: 70,
    est_fare_bdt: 80, toll_bdt: 30, fuel_cost_bdt: 340, carbon_kg: 1.9,
    geometry: [P(23.8103, 90.4125), P(23.75, 90.47), P(23.7, 90.53), P(23.6486, 90.6006)],
    legs: [
      { sequence: 1, instruction: "Take the N1 east across the Kanchpur Bridge", road: "N1", distance_km: 20, duration_min: 55, via: "Kanchpur" },
      { sequence: 2, instruction: "Turn off at Mograpara Chowrasta for Panam City", road: "R110", distance_km: 7, duration_min: 15, via: "Mograpara" },
    ],
    notes: "Leave Dhaka before 08:00 — the Kanchpur approach is the bottleneck, not the distance.",
  },

  // ─────────────── Intra-destination sightseeing loops ───────────────
  {
    from: { name: "Kolatoli, Cox's Bazar", kind: "poi", lat_lng: { lat: 21.4238, lng: 91.9789 } },
    to: { name: "Inani Beach", kind: "attraction", slug: "inani-beach", lat_lng: { lat: 21.2333, lng: 92.0472 } },
    mode: "driving", profile: "driving-car", variant: "scenic", is_default: true,
    distance_km: 32, duration_min: 50,
    est_fare_bdt: 150, fuel_cost_bdt: 400, carbon_kg: 2.2,
    geometry: [P(21.4238, 91.9789), P(21.3667, 92.0333), P(21.32, 92.04), P(21.28, 92.045), P(21.2333, 92.0472)],
    legs: [
      { sequence: 1, instruction: "Follow Marine Drive south past Himchari", road: "Marine Drive", distance_km: 12, duration_min: 20, via: "Himchari" },
      { sequence: 2, instruction: "Continue along the coast to Inani", road: "Marine Drive", distance_km: 20, duration_min: 30, via: "Ukhia" },
    ],
  },
  {
    from: { name: "Kolatoli, Cox's Bazar", kind: "poi", lat_lng: { lat: 21.4238, lng: 91.9789 } },
    to: { name: "Himchari National Park", kind: "attraction", slug: "himchari-national-park", lat_lng: { lat: 21.3667, lng: 92.0333 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 12, duration_min: 22,
    est_fare_bdt: 80, fuel_cost_bdt: 150, carbon_kg: 0.8,
    geometry: [P(21.4238, 91.9789), P(21.4, 92.0), P(21.385, 92.02), P(21.3667, 92.0333)],
    legs: [{ sequence: 1, instruction: "Take Marine Drive south to the Himchari gate", road: "Marine Drive", distance_km: 12, duration_min: 22, via: "Jhilongjha" }],
  },
  {
    from: { name: "Srimangal town", kind: "poi", lat_lng: { lat: 24.3065, lng: 91.7296 } },
    to: { name: "Lawachara National Park", kind: "attraction", slug: "lawachara", lat_lng: { lat: 24.3236, lng: 91.7869 } },
    mode: "driving", profile: "driving-car", variant: "fastest", is_default: true,
    distance_km: 8, duration_min: 20,
    est_fare_bdt: 60, fuel_cost_bdt: 100, carbon_kg: 0.6,
    geometry: [P(24.3065, 91.7296), P(24.312, 91.75), P(24.318, 91.77), P(24.3236, 91.7869)],
    legs: [{ sequence: 1, instruction: "Take the Kamalganj road east to the park gate", road: "R210", distance_km: 8, duration_min: 20, via: "Kamalganj Road" }],
  },
  {
    from: { name: "Rangamati town", kind: "poi", lat_lng: { lat: 22.6533, lng: 92.1751 } },
    to: { name: "Shuvolong Waterfall", kind: "attraction", slug: "shuvolong", lat_lng: { lat: 22.5667, lng: 92.2833 } },
    mode: "launch", profile: "waterway", variant: "scenic", is_default: true,
    distance_km: 18, duration_min: 75,
    est_fare_bdt: 2500, carbon_kg: 1.1,
    geometry: [P(22.6533, 92.1751), P(22.63, 92.2), P(22.61, 92.23), P(22.59, 92.26), P(22.5667, 92.2833)],
    legs: [{ sequence: 1, instruction: "Reserve a boat at the town jetty and cross Kaptai Lake", road: "Kaptai Lake", distance_km: 18, duration_min: 75, via: "Barkal" }],
    notes: "Fare is per boat, not per person — split it across the group.",
  },
];

export default routes;
