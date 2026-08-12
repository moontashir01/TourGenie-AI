// FR-15 — Smart Packing Assistant rules.
//
// The generator loads every active template, keeps the ones whose
// `conditions` match the trip (weather from the forecast rows, destination
// type, interests, duration), and merges their items into a PackingList.
// `always_include` templates skip matching entirely — they're the baseline.

export const packingTemplates = [
  // ─────────────────────── Baseline (always) ───────────────────────
  {
    code: "base-documents", label: "Essential documents", category: "documents", priority: 100, always_include: true,
    description: "Carried on every trip regardless of destination or season.",
    items: [
      { name: "National ID / NID card", qty_rule: "per_traveler", essential: true },
      { name: "Booking confirmations (printed or offline copy)", qty_rule: "fixed", essential: true, note: "Mobile signal is unreliable at hill and island destinations." },
      { name: "Cash in small notes", qty_rule: "fixed", essential: true, note: "Many local vendors, boats and entry gates take cash only." },
      { name: "Debit / credit card", qty_rule: "per_traveler", essential: false },
      { name: "Emergency contact list", qty_rule: "fixed", essential: true },
    ],
  },
  {
    code: "base-toiletries", label: "Basic toiletries", category: "toiletries", priority: 90, always_include: true,
    items: [
      { name: "Toothbrush & toothpaste", qty_rule: "per_traveler", essential: true },
      { name: "Soap / body wash", qty_rule: "fixed", essential: true },
      { name: "Shampoo", qty_rule: "fixed", essential: false },
      { name: "Towel (quick-dry)", qty_rule: "per_traveler", essential: true },
      { name: "Hand sanitiser", qty_rule: "fixed", essential: false },
      { name: "Tissue / wet wipes", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "base-electronics", label: "Electronics", category: "electronics", priority: 85, always_include: true,
    items: [
      { name: "Phone charger", qty_rule: "per_traveler", essential: true },
      { name: "Power bank", qty_rule: "fixed", essential: true, note: "Load-shedding and generator-only power are common outside the cities." },
      { name: "Universal adapter / multi-plug", qty_rule: "fixed", essential: false },
      { name: "Earphones", qty_rule: "per_traveler", essential: false },
    ],
  },
  {
    code: "base-health", label: "Basic medical kit", category: "health", priority: 88, always_include: true,
    items: [
      { name: "Personal prescription medicine", qty_rule: "per_traveler", essential: true },
      { name: "Paracetamol", qty_rule: "fixed", essential: true },
      { name: "Antacid", qty_rule: "fixed", essential: false },
      { name: "Oral saline (ORS)", qty_rule: "fixed", essential: true, note: "Heat and unfamiliar food — the single most useful thing in the kit." },
      { name: "Antiseptic cream & plasters", qty_rule: "fixed", essential: false },
      { name: "Motion-sickness tablets", qty_rule: "fixed", essential: false, note: "Hill roads and river launches." },
    ],
  },
  {
    code: "base-clothing", label: "Everyday clothing", category: "clothing", priority: 80, always_include: true,
    items: [
      { name: "T-shirt / top", qty_rule: "per_day", essential: true },
      { name: "Trousers / pants", qty_rule: "per_2_days", essential: true },
      { name: "Underwear", qty_rule: "per_day", essential: true },
      { name: "Socks", qty_rule: "per_day", essential: false },
      { name: "Sleepwear", qty_rule: "fixed", qty: 1, essential: false },
      { name: "Comfortable walking shoes", qty_rule: "per_traveler", essential: true },
    ],
  },

  // ─────────────────────── Weather-driven ───────────────────────
  {
    code: "rain-gear", label: "Rain gear", category: "gear", priority: 70,
    description: "Applied when any day of the trip forecasts rain.",
    conditions: { packing_hints: ["rain"], weather_conditions: ["light-rain", "rain", "heavy-rain", "thunderstorm"] },
    items: [
      { name: "Rain jacket or poncho", qty_rule: "per_traveler", essential: true },
      { name: "Compact umbrella", qty_rule: "fixed", essential: true },
      { name: "Dry bag / waterproof phone pouch", qty_rule: "fixed", essential: true, note: "Essential on boat legs." },
      { name: "Quick-dry sandals", qty_rule: "per_traveler", essential: false },
      { name: "Extra plastic bags for wet clothes", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "heavy-monsoon", label: "Heavy monsoon kit", category: "gear", priority: 75,
    description: "For trips where most days forecast heavy rain.",
    conditions: { packing_hints: ["heavy-rain"], weather_conditions: ["heavy-rain", "thunderstorm"] },
    items: [
      { name: "Waterproof trekking shoes", qty_rule: "per_traveler", essential: true },
      { name: "Waterproof backpack cover", qty_rule: "per_traveler", essential: true },
      { name: "Extra change of clothes (sealed)", qty_rule: "per_traveler", essential: true },
      { name: "Microfibre towel", qty_rule: "per_traveler", essential: false },
    ],
  },
  {
    code: "hot-weather", label: "Hot weather", category: "clothing", priority: 65,
    description: "Applied when the trip's maximum temperature is 32 °C or above.",
    conditions: { min_temp_c: 32, packing_hints: ["hot"] },
    items: [
      { name: "Light cotton / linen clothing", qty_rule: "per_day", essential: true },
      { name: "Wide-brim hat or cap", qty_rule: "per_traveler", essential: true },
      { name: "Sunglasses", qty_rule: "per_traveler", essential: false },
      { name: "Refillable water bottle", qty_rule: "per_traveler", essential: true },
      { name: "Cooling towel", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "sun-protection", label: "Sun protection", category: "toiletries", priority: 64,
    conditions: { packing_hints: ["sunny", "hot"], weather_conditions: ["clear", "partly-cloudy"] },
    items: [
      { name: "Sunscreen SPF 50+", qty_rule: "fixed", essential: true },
      { name: "Lip balm with SPF", qty_rule: "fixed", essential: false },
      { name: "Aloe vera gel (after-sun)", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "cold-weather", label: "Cold weather layers", category: "clothing", priority: 68,
    description: "Applied when the trip's minimum temperature is 15 °C or below — winter nights, and hill destinations year-round.",
    conditions: { max_temp_c: 15, packing_hints: ["cold"] },
    items: [
      { name: "Warm jacket or fleece", qty_rule: "per_traveler", essential: true },
      { name: "Full-sleeve layers", qty_rule: "per_2_days", essential: true },
      { name: "Woollen cap / muffler", qty_rule: "per_traveler", essential: false },
      { name: "Thick socks", qty_rule: "per_2_days", essential: false },
    ],
  },
  {
    code: "humid-weather", label: "Humidity kit", category: "toiletries", priority: 55,
    conditions: { packing_hints: ["humid"] },
    items: [
      { name: "Extra changes of clothing", qty_rule: "per_2_days", essential: false, note: "Clothes take much longer to dry in high humidity." },
      { name: "Anti-fungal powder", qty_rule: "fixed", essential: false },
      { name: "Deodorant", qty_rule: "per_traveler", essential: false },
    ],
  },

  // ─────────────────────── Destination-driven ───────────────────────
  {
    code: "beach-kit", label: "Beach kit", category: "gear", priority: 60,
    conditions: { destination_types: ["beach", "island"], interests: ["beach"] },
    items: [
      { name: "Swimwear", qty_rule: "per_traveler", essential: true },
      { name: "Beach towel", qty_rule: "per_traveler", essential: false },
      { name: "Flip-flops / sandals", qty_rule: "per_traveler", essential: true },
      { name: "Waterproof phone pouch", qty_rule: "per_traveler", essential: false },
      { name: "Sand-proof bag", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "island-extras", label: "Island stay extras", category: "misc", priority: 62,
    description: "Islands and remote coasts — limited shops, limited power, limited signal.",
    conditions: { destination_types: ["island"] },
    items: [
      { name: "Extra power bank", qty_rule: "fixed", essential: true, note: "Generator power often runs only part of the day." },
      { name: "Torch / headlamp", qty_rule: "per_traveler", essential: true },
      { name: "Snacks and drinking water", qty_rule: "fixed", essential: false },
      { name: "Cash — more than you expect to need", qty_rule: "fixed", essential: true, note: "ATMs are scarce or absent." },
      { name: "Seasickness tablets", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "hill-kit", label: "Hill destination kit", category: "gear", priority: 61,
    conditions: { destination_types: ["hill"], interests: ["hills"] },
    items: [
      { name: "Warm layer for early mornings", qty_rule: "per_traveler", essential: true, note: "Hill mornings run well below the daytime figure." },
      { name: "Grip-soled shoes", qty_rule: "per_traveler", essential: true },
      { name: "Torch / headlamp", qty_rule: "per_traveler", essential: true },
      { name: "Power bank", qty_rule: "fixed", essential: true },
      { name: "Motion-sickness tablets", qty_rule: "fixed", essential: false, note: "The hill roads are relentlessly winding." },
    ],
  },
  {
    code: "forest-wildlife", label: "Forest & wildlife kit", category: "gear", priority: 59,
    conditions: { destination_types: ["forest", "nature"], interests: ["wildlife"] },
    items: [
      { name: "Insect repellent", qty_rule: "fixed", essential: true },
      { name: "Long-sleeve shirt and full trousers", qty_rule: "per_2_days", essential: true, note: "Cover up against mosquitoes and leeches." },
      { name: "Binoculars", qty_rule: "fixed", essential: false },
      { name: "Neutral-coloured clothing", qty_rule: "fixed", essential: false, note: "Bright colours push wildlife away." },
      { name: "Closed shoes", qty_rule: "per_traveler", essential: true },
    ],
  },
  {
    code: "heritage-sites", label: "Heritage site visits", category: "clothing", priority: 52,
    conditions: { destination_types: ["heritage"], interests: ["history", "religious"] },
    items: [
      { name: "Modest clothing covering shoulders and knees", qty_rule: "fixed", essential: true, note: "Required at mosques, temples and several palace sites." },
      { name: "Easily removable shoes", qty_rule: "per_traveler", essential: false, note: "Most religious sites require shoes off." },
      { name: "Scarf / shawl", qty_rule: "fixed", essential: false },
    ],
  },

  // ─────────────────────── Activity-driven ───────────────────────
  {
    code: "trekking-kit", label: "Trekking kit", category: "gear", priority: 72,
    conditions: { interests: ["trekking", "adventure"] },
    items: [
      { name: "Trekking shoes with ankle support", qty_rule: "per_traveler", essential: true },
      { name: "Daypack (20–30 L)", qty_rule: "per_traveler", essential: true },
      { name: "Water bottle (2 L capacity)", qty_rule: "per_traveler", essential: true },
      { name: "Energy bars / dry food", qty_rule: "fixed", essential: false },
      { name: "Blister plasters", qty_rule: "fixed", essential: false },
      { name: "Walking stick", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "photography-kit", label: "Photography kit", category: "electronics", priority: 50,
    conditions: { interests: ["photography"] },
    items: [
      { name: "Camera and lenses", qty_rule: "fixed", essential: true },
      { name: "Spare batteries", qty_rule: "fixed", essential: true },
      { name: "Memory cards", qty_rule: "fixed", essential: true },
      { name: "Lens cleaning cloth", qty_rule: "fixed", essential: false },
      { name: "Tripod", qty_rule: "fixed", essential: false, note: "Worth carrying for sunrise at Konglak or Nilgiri." },
    ],
  },
  {
    code: "snorkelling-kit", label: "Snorkelling & water activities", category: "gear", priority: 54,
    conditions: { interests: ["adventure", "beach"], destination_types: ["island"] },
    items: [
      { name: "Snorkel mask (or hire locally)", qty_rule: "fixed", essential: false },
      { name: "Rash guard / swim shirt", qty_rule: "per_traveler", essential: false },
      { name: "Reef-safe sunscreen", qty_rule: "fixed", essential: true },
      { name: "Waterproof action camera", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "boat-journey", label: "Boat & launch journeys", category: "misc", priority: 53,
    conditions: { interests: ["boating"] },
    items: [
      { name: "Seasickness tablets", qty_rule: "fixed", essential: true },
      { name: "Light blanket or shawl", qty_rule: "per_traveler", essential: false, note: "River nights get cold on deck." },
      { name: "Dry bag for electronics", qty_rule: "fixed", essential: true },
      { name: "Snacks for the crossing", qty_rule: "fixed", essential: false },
    ],
  },

  // ─────────────────────── Trip shape ───────────────────────
  {
    code: "international-docs", label: "International travel documents", category: "documents", priority: 99,
    conditions: { international_only: true },
    items: [
      { name: "Passport (6+ months validity)", qty_rule: "per_traveler", essential: true },
      { name: "Visa or visa-on-arrival paperwork", qty_rule: "per_traveler", essential: true },
      { name: "Return ticket printout", qty_rule: "per_traveler", essential: true },
      { name: "Travel insurance policy", qty_rule: "per_traveler", essential: true },
      { name: "Foreign currency / forex card", qty_rule: "fixed", essential: true },
      { name: "Vaccination certificate", qty_rule: "per_traveler", essential: false },
      { name: "Photocopies of passport and visa", qty_rule: "per_traveler", essential: true, note: "Keep separate from the originals." },
    ],
  },
  {
    code: "long-trip", label: "Longer trip additions", category: "misc", priority: 40,
    conditions: { min_days: 5 },
    items: [
      { name: "Laundry detergent sachets", qty_rule: "fixed", essential: false },
      { name: "Extra toiletries refill", qty_rule: "fixed", essential: false },
      { name: "Sewing kit / safety pins", qty_rule: "fixed", essential: false },
      { name: "Spare bag for dirty laundry", qty_rule: "fixed", essential: false },
    ],
  },
  {
    code: "short-trip", label: "Short trip — travel light", category: "misc", priority: 38,
    conditions: { max_days: 2 },
    items: [
      { name: "Single carry-on bag", qty_rule: "fixed", essential: false, note: "Two days doesn't need checked luggage." },
      { name: "Travel-size toiletries", qty_rule: "fixed", essential: false },
    ],
  },
];

export default packingTemplates;
