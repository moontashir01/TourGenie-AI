// FR-13 — Nearby Services, replacing the OSM Overpass API.
//
// Two sources feed this collection:
//   1. `namedServices` below — real, recognisable places, hand-entered.
//   2. `generateAreaServices()` — descriptive coverage rows ("ATM Booth —
//      Laboni Point") clustered around each destination so every category
//      returns something everywhere, not just in the cities we listed by
//      hand. These are labelled `source: "generated"` and named by function
//      and location rather than given invented business names.

export const namedServices = [
  // ─────────────────────────── Cox's Bazar ───────────────────────────
  { name: "Poushee Restaurant", category: "restaurant", subcategory: "Bangladeshi", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Kolatoli", lat_lng: { lat: 21.4249, lng: 91.9781 }, address: "Kolatoli Main Road", opening_hours: "07:00 - 23:00", rating: 4.3, price_level: 2, tags: ["halal", "seafood", "family"] },
  { name: "Mermaid Café", category: "cafe", subcategory: "Beach café", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Marine Drive", lat_lng: { lat: 21.3489, lng: 92.0192 }, address: "Marine Drive, Pechar Dwip", opening_hours: "08:00 - 22:00", rating: 4.5, price_level: 3, tags: ["seaview", "coffee", "wifi"] },
  { name: "Jhaubon Restaurant", category: "restaurant", subcategory: "Seafood", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Sugandha", lat_lng: { lat: 21.4207, lng: 91.9748 }, address: "Sugandha Beach Point", opening_hours: "11:00 - 00:00", rating: 4.1, price_level: 2, tags: ["seafood", "halal", "grilled-fish"] },
  { name: "Cox's Bazar Sadar Hospital", category: "hospital", subcategory: "Government hospital", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Hospital Road", lat_lng: { lat: 21.4419, lng: 91.9789 }, address: "Hospital Road, Cox's Bazar", opening_hours: "24 hours", is_24h: true, phone: "+880 341-63324", rating: 3.6, tags: ["emergency", "government"] },
  { name: "Cox's Bazar Specialized Hospital", category: "hospital", subcategory: "Private hospital", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Kolatoli", lat_lng: { lat: 21.4293, lng: 91.9822 }, address: "Kolatoli Road", opening_hours: "24 hours", is_24h: true, rating: 4.0, tags: ["emergency", "private", "card-accepted"] },
  { name: "Lazz Pharma — Kolatoli", category: "pharmacy", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Kolatoli", lat_lng: { lat: 21.4262, lng: 91.9794 }, address: "Kolatoli Circle", opening_hours: "08:00 - 23:00", rating: 4.2, tags: ["card-accepted"] },
  { name: "Dutch-Bangla Bank ATM — Kolatoli", category: "atm", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Kolatoli", lat_lng: { lat: 21.4255, lng: 91.9801 }, address: "Kolatoli Main Road", opening_hours: "24 hours", is_24h: true, tags: ["visa", "mastercard"] },
  { name: "BRAC Bank ATM — Laboni", category: "atm", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Laboni", lat_lng: { lat: 21.4288, lng: 91.9762 }, address: "Motel Road, Laboni Point", opening_hours: "24 hours", is_24h: true, tags: ["visa", "mastercard"] },
  { name: "Padma Oil Filling Station", category: "fuel", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Bus Terminal", lat_lng: { lat: 21.4467, lng: 91.9903 }, address: "Bus Terminal Road", opening_hours: "24 hours", is_24h: true, tags: ["octane", "diesel", "cng"] },
  { name: "Cox's Bazar Tourist Police Booth", category: "police", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Laboni", lat_lng: { lat: 21.4279, lng: 91.9755 }, address: "Laboni Beach Point", opening_hours: "24 hours", is_24h: true, phone: "+880 1769-690055", tags: ["tourist-police", "emergency"] },
  { name: "Beach Public Toilet — Laboni", category: "toilet", city: "Cox's Bazar", destination_slug: "coxs-bazar", area: "Laboni", lat_lng: { lat: 21.4283, lng: 91.9759 }, address: "Laboni Beach entrance", opening_hours: "06:00 - 22:00", tags: ["paid"] },

  // ───────────────────────────── Dhaka ─────────────────────────────
  { name: "Star Kabab & Restaurant", category: "restaurant", subcategory: "Bangladeshi", city: "Dhaka", destination_slug: "dhaka", area: "Dhanmondi", lat_lng: { lat: 23.7461, lng: 90.3742 }, address: "Satmasjid Road, Dhanmondi", opening_hours: "07:00 - 01:00", rating: 4.2, price_level: 2, tags: ["halal", "kebab", "late-night"] },
  { name: "Haji Biryani", category: "restaurant", subcategory: "Biryani", city: "Dhaka", destination_slug: "dhaka", area: "Nazira Bazar", lat_lng: { lat: 23.7172, lng: 90.4103 }, address: "Kazi Alauddin Road, Nazira Bazar", opening_hours: "12:00 - 22:00", rating: 4.4, price_level: 1, tags: ["halal", "biryani", "old-dhaka", "cash-only"] },
  { name: "North End Coffee Roasters", category: "cafe", city: "Dhaka", destination_slug: "dhaka", area: "Gulshan", lat_lng: { lat: 23.7925, lng: 90.4147 }, address: "Gulshan Avenue, Gulshan-2", opening_hours: "08:00 - 22:00", rating: 4.5, price_level: 3, tags: ["coffee", "wifi", "card-accepted"] },
  { name: "Square Hospital", category: "hospital", subcategory: "Private hospital", city: "Dhaka", destination_slug: "dhaka", area: "Panthapath", lat_lng: { lat: 23.7522, lng: 90.3839 }, address: "18/F West Panthapath", opening_hours: "24 hours", is_24h: true, phone: "+880 2-8144466", rating: 4.4, tags: ["emergency", "international-standard", "card-accepted"] },
  { name: "Dhaka Medical College Hospital", category: "hospital", subcategory: "Government hospital", city: "Dhaka", destination_slug: "dhaka", area: "Shahbagh", lat_lng: { lat: 23.7264, lng: 90.3972 }, address: "Secretariat Road, Shahbagh", opening_hours: "24 hours", is_24h: true, rating: 3.5, tags: ["emergency", "government"] },
  { name: "Lazz Pharma — Dhanmondi", category: "pharmacy", city: "Dhaka", destination_slug: "dhaka", area: "Dhanmondi", lat_lng: { lat: 23.7489, lng: 90.3756 }, address: "Road 27, Dhanmondi", opening_hours: "24 hours", is_24h: true, rating: 4.3, tags: ["24h", "card-accepted"] },
  { name: "Standard Chartered ATM — Gulshan", category: "atm", city: "Dhaka", destination_slug: "dhaka", area: "Gulshan", lat_lng: { lat: 23.7936, lng: 90.4152 }, address: "Gulshan Avenue", opening_hours: "24 hours", is_24h: true, tags: ["visa", "mastercard", "international-cards"] },
  { name: "Jamuna Future Park", category: "shopping", subcategory: "Shopping mall", city: "Dhaka", destination_slug: "dhaka", area: "Bashundhara", lat_lng: { lat: 23.8133, lng: 90.4258 }, address: "Ka-244, Kuril, Progoti Sarani", opening_hours: "10:00 - 20:00", rating: 4.3, price_level: 3, tags: ["mall", "food-court", "cinema", "card-accepted"] },
  { name: "New Market", category: "shopping", subcategory: "Market", city: "Dhaka", destination_slug: "dhaka", area: "Azimpur", lat_lng: { lat: 23.7331, lng: 90.3847 }, address: "Mirpur Road, New Market", opening_hours: "10:00 - 21:00", rating: 4.0, price_level: 1, tags: ["market", "bargaining", "cash-only"] },
  { name: "Padma Filling Station — Mohakhali", category: "fuel", city: "Dhaka", destination_slug: "dhaka", area: "Mohakhali", lat_lng: { lat: 23.7806, lng: 90.4028 }, address: "Mohakhali Flyover Road", opening_hours: "24 hours", is_24h: true, tags: ["octane", "diesel", "cng"] },
  { name: "Baitul Mukarram National Mosque", category: "mosque", city: "Dhaka", destination_slug: "dhaka", area: "Paltan", lat_lng: { lat: 23.7275, lng: 90.4125 }, address: "Topkhana Road, Paltan", opening_hours: "Open for all prayer times", rating: 4.7, tags: ["national-mosque", "wudu-facility"] },
  { name: "Kamalapur Railway Station", category: "bus_stop", subcategory: "Railway station", city: "Dhaka", destination_slug: "dhaka", area: "Kamalapur", lat_lng: { lat: 23.7317, lng: 90.4264 }, address: "Kamalapur, Dhaka", opening_hours: "24 hours", is_24h: true, rating: 3.8, tags: ["railway", "ticket-counter"] },

  // ────────────────────────── Sylhet region ──────────────────────────
  { name: "Panshi Restaurant", category: "restaurant", subcategory: "Sylheti", city: "Sylhet", destination_slug: "sylhet", area: "Zindabazar", lat_lng: { lat: 24.8961, lng: 91.8697 }, address: "Jallarpar Road, Zindabazar", opening_hours: "07:00 - 23:30", rating: 4.4, price_level: 2, tags: ["halal", "sylheti", "family"] },
  { name: "Pach Bhai Restaurant", category: "restaurant", subcategory: "Bangladeshi", city: "Sylhet", destination_slug: "sylhet", area: "Zindabazar", lat_lng: { lat: 24.8955, lng: 91.8703 }, address: "Zindabazar, Sylhet", opening_hours: "07:00 - 23:00", rating: 4.3, price_level: 2, tags: ["halal", "local-favourite"] },
  { name: "Mount Adora Hospital", category: "hospital", subcategory: "Private hospital", city: "Sylhet", destination_slug: "sylhet", area: "Akhalia", lat_lng: { lat: 24.9089, lng: 91.8542 }, address: "Nayasarak, Sylhet", opening_hours: "24 hours", is_24h: true, rating: 4.1, tags: ["emergency", "private"] },
  { name: "Islami Bank ATM — Zindabazar", category: "atm", city: "Sylhet", destination_slug: "sylhet", area: "Zindabazar", lat_lng: { lat: 24.8949, lng: 91.8689 }, address: "Zindabazar Point", opening_hours: "24 hours", is_24h: true, tags: ["visa", "mastercard"] },
  { name: "Nilkantha Tea Cabin", category: "cafe", subcategory: "Tea house", city: "Srimangal", destination_slug: "srimangal", area: "Ramnagar", lat_lng: { lat: 24.3358, lng: 91.7278 }, address: "Ramnagar, Srimangal", opening_hours: "08:00 - 20:00", rating: 4.6, price_level: 1, tags: ["seven-layer-tea", "local-speciality", "cash-only"] },
  { name: "Kutum Bari Restaurant", category: "restaurant", subcategory: "Bangladeshi", city: "Srimangal", destination_slug: "srimangal", area: "Station Road", lat_lng: { lat: 24.3092, lng: 91.7301 }, address: "Station Road, Srimangal", opening_hours: "08:00 - 22:30", rating: 4.2, price_level: 2, tags: ["halal", "fish-curry", "family"] },
  { name: "Srimangal Upazila Health Complex", category: "hospital", subcategory: "Government hospital", city: "Srimangal", destination_slug: "srimangal", area: "Hospital Road", lat_lng: { lat: 24.3125, lng: 91.7256 }, address: "Hospital Road, Srimangal", opening_hours: "24 hours", is_24h: true, rating: 3.4, tags: ["emergency", "government"] },
  { name: "Srimangal Railway Station", category: "bus_stop", subcategory: "Railway station", city: "Srimangal", destination_slug: "srimangal", area: "Station Road", lat_lng: { lat: 24.3081, lng: 91.7269 }, address: "Station Road, Srimangal", opening_hours: "05:00 - 23:00", rating: 3.9, tags: ["railway", "ticket-counter"] },

  // ───────────────────── Chattogram & hill tracts ─────────────────────
  { name: "Mezban Haile Aish", category: "restaurant", subcategory: "Chittagonian", city: "Chattogram", destination_slug: "chattogram", area: "GEC Circle", lat_lng: { lat: 22.3592, lng: 91.8214 }, address: "GEC Circle, Chattogram", opening_hours: "11:00 - 23:00", rating: 4.5, price_level: 2, tags: ["halal", "mezban-beef", "local-speciality"] },
  { name: "Chittagong Medical College Hospital", category: "hospital", subcategory: "Government hospital", city: "Chattogram", destination_slug: "chattogram", area: "Panchlaish", lat_lng: { lat: 22.3608, lng: 91.8322 }, address: "K.B. Fazlul Kader Road, Panchlaish", opening_hours: "24 hours", is_24h: true, rating: 3.6, tags: ["emergency", "government"] },
  { name: "Evercare Hospital Chattogram", category: "hospital", subcategory: "Private hospital", city: "Chattogram", destination_slug: "chattogram", area: "Pahartali", lat_lng: { lat: 22.3711, lng: 91.7889 }, address: "Foy's Lake Road, Pahartali", opening_hours: "24 hours", is_24h: true, rating: 4.3, tags: ["emergency", "international-standard", "card-accepted"] },
  { name: "Sanmar Ocean City", category: "shopping", subcategory: "Shopping mall", city: "Chattogram", destination_slug: "chattogram", area: "GEC", lat_lng: { lat: 22.3603, lng: 91.8236 }, address: "GEC Circle, Chattogram", opening_hours: "10:00 - 21:00", rating: 4.2, price_level: 3, tags: ["mall", "food-court", "card-accepted"] },
  { name: "Sajek Community Health Post", category: "hospital", subcategory: "Health post", city: "Sajek Valley", destination_slug: "sajek-valley", area: "Ruilui Para", lat_lng: { lat: 23.3822, lng: 92.2948 }, address: "Ruilui Para, Sajek", opening_hours: "09:00 - 17:00", rating: 3.0, tags: ["basic-care", "limited-hours"] },
  { name: "Sajek Ruilui Bazar", category: "shopping", subcategory: "Local market", city: "Sajek Valley", destination_slug: "sajek-valley", area: "Ruilui Para", lat_lng: { lat: 23.3817, lng: 92.2939 }, address: "Ruilui Para centre", opening_hours: "07:00 - 20:00", rating: 3.8, price_level: 1, tags: ["local-produce", "handicraft", "cash-only"] },
  { name: "Mon Ghor Restaurant", category: "restaurant", subcategory: "Local", city: "Sajek Valley", destination_slug: "sajek-valley", area: "Ruilui Para", lat_lng: { lat: 23.3828, lng: 92.2955 }, address: "Ruilui Para, Sajek", opening_hours: "07:00 - 22:00", rating: 4.0, price_level: 2, tags: ["bamboo-chicken", "local-speciality", "cash-only"] },
  { name: "Bandarban Sadar Hospital", category: "hospital", subcategory: "Government hospital", city: "Bandarban", destination_slug: "bandarban", area: "Bandarban town", lat_lng: { lat: 22.1978, lng: 92.2175 }, address: "Hospital Road, Bandarban", opening_hours: "24 hours", is_24h: true, rating: 3.4, tags: ["emergency", "government"] },
  { name: "Meghdut Restaurant", category: "restaurant", subcategory: "Bangladeshi", city: "Bandarban", destination_slug: "bandarban", area: "Bandarban town", lat_lng: { lat: 22.1961, lng: 92.2192 }, address: "Main Road, Bandarban", opening_hours: "07:00 - 22:00", rating: 3.9, price_level: 2, tags: ["halal", "local"] },
  { name: "Rangamati General Hospital", category: "hospital", subcategory: "Government hospital", city: "Rangamati", destination_slug: "rangamati", area: "Rangamati town", lat_lng: { lat: 22.6547, lng: 92.1719 }, address: "Hospital Road, Rangamati", opening_hours: "24 hours", is_24h: true, rating: 3.5, tags: ["emergency", "government"] },
  { name: "Peda Ting Ting Restaurant", category: "restaurant", subcategory: "Chakma cuisine", city: "Rangamati", destination_slug: "rangamati", area: "Kaptai Lake", lat_lng: { lat: 22.6289, lng: 92.2011 }, address: "Island on Kaptai Lake, Rangamati", opening_hours: "10:00 - 19:00", rating: 4.3, price_level: 2, tags: ["indigenous-cuisine", "island", "boat-access", "bamboo-chicken"] },

  // ──────────────────────── Khulna & the south ────────────────────────
  { name: "Khulna Medical College Hospital", category: "hospital", subcategory: "Government hospital", city: "Khulna", destination_slug: "khulna", area: "Boyra", lat_lng: { lat: 22.8244, lng: 89.5322 }, address: "KMCH Road, Boyra, Khulna", opening_hours: "24 hours", is_24h: true, rating: 3.6, tags: ["emergency", "government"] },
  { name: "Ahsan Restaurant", category: "restaurant", subcategory: "Bangladeshi", city: "Khulna", destination_slug: "khulna", area: "Shibbari", lat_lng: { lat: 22.8156, lng: 89.5589 }, address: "Shibbari Circle, Khulna", opening_hours: "07:00 - 23:00", rating: 4.0, price_level: 2, tags: ["halal", "chui-jhal", "local-speciality"] },
  { name: "Barishal Sher-e-Bangla Medical College Hospital", category: "hospital", subcategory: "Government hospital", city: "Barishal", destination_slug: "barishal", area: "Band Road", lat_lng: { lat: 22.6944, lng: 90.3583 }, address: "Band Road, Barishal", opening_hours: "24 hours", is_24h: true, rating: 3.5, tags: ["emergency", "government"] },
  { name: "Barishal Launch Terminal", category: "bus_stop", subcategory: "Launch terminal", city: "Barishal", destination_slug: "barishal", area: "Band Road", lat_lng: { lat: 22.6919, lng: 90.3697 }, address: "Band Road, Barishal", opening_hours: "24 hours", is_24h: true, rating: 3.7, tags: ["launch", "ticket-counter"] },
  { name: "Kuakata Beach Food Court", category: "restaurant", subcategory: "Seafood", city: "Kuakata", destination_slug: "kuakata", area: "Beach Road", lat_lng: { lat: 21.8181, lng: 90.1214 }, address: "Kuakata Beach Road", opening_hours: "07:00 - 23:00", rating: 3.9, price_level: 1, tags: ["seafood", "grilled-fish", "cash-only"] },
  { name: "Kuakata Tourist Police Camp", category: "police", city: "Kuakata", destination_slug: "kuakata", area: "Beach Road", lat_lng: { lat: 21.8175, lng: 90.1201 }, address: "Kuakata Beach Point", opening_hours: "24 hours", is_24h: true, tags: ["tourist-police", "emergency"] },

  // ───────────────────────── International ─────────────────────────
  { name: "Bumrungrad International Hospital", category: "hospital", subcategory: "International hospital", city: "Bangkok", destination_slug: "bangkok", area: "Sukhumvit", lat_lng: { lat: 13.7469, lng: 100.5528 }, address: "33 Sukhumvit 3, Watthana", opening_hours: "24 hours", is_24h: true, rating: 4.7, tags: ["international-standard", "english-speaking", "card-accepted"] },
  { name: "Siam Paragon", category: "shopping", subcategory: "Shopping mall", city: "Bangkok", destination_slug: "bangkok", area: "Siam", lat_lng: { lat: 13.7462, lng: 100.5347 }, address: "991 Rama I Rd, Pathum Wan", opening_hours: "10:00 - 22:00", rating: 4.5, price_level: 3, tags: ["mall", "food-court", "bts-access", "card-accepted"] },
];

// ── Coverage generator ───────────────────────────────────────────────
//
// Places one descriptive row per category near a destination centre, so
// FR-13 returns useful results everywhere rather than only in the cities
// listed above. Offsets are small (roughly 200 m – 1.5 km) and deterministic,
// so reseeding produces identical coordinates.

const COVERAGE = [
  { category: "restaurant", suffix: "Local Restaurant Area", hours: "08:00 - 22:30", price_level: 2, rating: 3.8, tags: ["local"] },
  { category: "pharmacy", suffix: "Pharmacy", hours: "08:00 - 22:00", rating: 3.9, tags: [] },
  { category: "atm", suffix: "ATM", hours: "24 hours", is_24h: true, rating: 3.7, tags: ["international-cards"] },
  { category: "fuel", suffix: "Fuel Station", hours: "24 hours", is_24h: true, rating: 3.6, tags: [] },
  { category: "toilet", suffix: "Public Restroom", hours: "06:00 - 22:00", rating: 3.0, tags: [] },
  { category: "police", suffix: "Visitor Assistance Point", hours: "24 hours", is_24h: true, rating: 3.8, tags: ["emergency"] },
  { category: "bus_stop", suffix: "Public Transit Stop", hours: "05:00 - 23:00", rating: 3.5, tags: ["public-transport"] },
  { category: "bank", suffix: "Bank Branch", hours: "09:00 - 16:00", rating: 3.8, tags: ["foreign-exchange"] },
];

// Fixed offsets in degrees — deterministic, and small enough to land within
// the destination's built-up area (1° latitude ≈ 111 km).
const OFFSETS = [
  [0.004, 0.003], [-0.005, 0.004], [0.006, -0.002], [-0.003, -0.006],
  [0.008, 0.005], [-0.007, 0.002], [0.002, 0.008], [-0.004, -0.003],
];

export function generateAreaServices(destination) {
  const { lat, lng } = destination.lat_lng || {};
  if (typeof lat !== "number" || typeof lng !== "number") return [];

  return COVERAGE.map((c, i) => {
    const [dLat, dLng] = OFFSETS[i % OFFSETS.length];
    return {
      name: `${destination.name} ${c.suffix}`,
      category: c.category,
      subcategory: "",
      city: destination.name,
      destination_slug: destination.slug,
      area: destination.name,
      address: `Near ${destination.name} centre`,
      lat_lng: { lat: +(lat + dLat).toFixed(6), lng: +(lng + dLng).toFixed(6) },
      opening_hours: c.hours,
      is_24h: Boolean(c.is_24h),
      rating: c.rating,
      price_level: c.price_level || 0,
      tags: c.tags,
      source: "generated",
    };
  });
}

export default { namedServices, generateAreaServices };
