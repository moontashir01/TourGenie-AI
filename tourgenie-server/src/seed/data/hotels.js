// FR-07 — the hotel database. `price_per_night` is the cheapest room in BDT;
// `room_types` carries the full rate card so a 4-person trip prices correctly.
//
// Rates are representative shoulder-season figures for demonstration — real
// pricing moves with season and occupancy.

export const hotels = [
  // ─────────────────────────── Cox's Bazar ───────────────────────────
  {
    slug: "sayeman-beach-resort", destination_slug: "coxs-bazar", name: "Sayeman Beach Resort", city: "Cox's Bazar", area: "Kolatoli",
    price_per_night: 6500, rating: 4.5, star_rating: 4, review_score: 8.6, review_count: 1420, budget_tier: "luxury",
    facilities: ["WiFi", "Pool", "Breakfast", "Restaurant", "Sea View", "Gym", "Parking"],
    lat_lng: { lat: 21.4238, lng: 91.9789 }, address: "Marine Drive Road, Kolatoli, Cox's Bazar",
    description: "One of the oldest names on the beach, rebuilt as a full resort with direct beach access and a large pool deck.",
    distance_to_landmark: { landmark: "Kolatoli Beach", km: 0.2 }, phone: "+880 1755-660011",
    room_types: [
      { name: "Deluxe Twin", capacity: 2, price_per_night: 6500, beds: "2 single", breakfast_included: true, rooms_available: 12 },
      { name: "Premium Sea View", capacity: 2, price_per_night: 9500, beds: "1 king", breakfast_included: true, rooms_available: 8 },
      { name: "Family Suite", capacity: 4, price_per_night: 14500, beds: "1 king + 2 single", breakfast_included: true, rooms_available: 4 },
    ],
    cancellation_policy: "Free cancellation up to 48 hours before check-in.",
  },
  {
    slug: "long-beach-hotel", destination_slug: "coxs-bazar", name: "Long Beach Hotel", city: "Cox's Bazar", area: "Kolatoli",
    price_per_night: 8900, rating: 4.7, star_rating: 5, review_score: 8.9, review_count: 2130, budget_tier: "luxury",
    facilities: ["WiFi", "Pool", "Spa", "Breakfast", "Restaurant", "Gym", "Rooftop", "Parking"],
    lat_lng: { lat: 21.4256, lng: 91.9781 }, address: "Hotel Motel Zone, Kolatoli, Cox's Bazar",
    description: "The town's most consistently rated five-star, with a rooftop restaurant looking straight down the beach.",
    distance_to_landmark: { landmark: "Kolatoli Beach", km: 0.1 }, phone: "+880 1730-793939",
    room_types: [
      { name: "Superior King", capacity: 2, price_per_night: 8900, beds: "1 king", breakfast_included: true, rooms_available: 15 },
      { name: "Executive Sea View", capacity: 2, price_per_night: 12500, beds: "1 king", breakfast_included: true, rooms_available: 10 },
      { name: "Presidential Suite", capacity: 4, price_per_night: 24000, beds: "1 king + sofa bed", breakfast_included: true, rooms_available: 2 },
    ],
    cancellation_policy: "Free cancellation up to 72 hours before check-in.",
  },
  {
    slug: "ocean-paradise-hotel", destination_slug: "coxs-bazar", name: "Ocean Paradise Hotel & Resort", city: "Cox's Bazar", area: "Kolatoli",
    price_per_night: 4800, rating: 4.2, star_rating: 4, review_score: 8.1, review_count: 1680, budget_tier: "mid",
    facilities: ["WiFi", "AC", "Gym", "Pool", "Restaurant", "Parking"],
    lat_lng: { lat: 21.4219, lng: 91.9772 }, address: "Kolatoli Beach Road, Cox's Bazar",
    description: "Large mid-range resort a short walk back from the sand — reliable rather than remarkable, and usually available.",
    distance_to_landmark: { landmark: "Kolatoli Beach", km: 0.5 }, phone: "+880 1755-582828",
    room_types: [
      { name: "Standard Twin", capacity: 2, price_per_night: 4800, beds: "2 single", rooms_available: 20 },
      { name: "Deluxe Double", capacity: 2, price_per_night: 6200, beds: "1 queen", breakfast_included: true, rooms_available: 14 },
      { name: "Family Room", capacity: 4, price_per_night: 9800, beds: "2 queen", breakfast_included: true, rooms_available: 6 },
    ],
    cancellation_policy: "Free cancellation up to 24 hours before check-in.",
  },
  {
    slug: "sea-crown-hotel", destination_slug: "coxs-bazar", name: "Hotel Sea Crown", city: "Cox's Bazar", area: "Laboni",
    price_per_night: 3200, rating: 3.9, star_rating: 3, review_score: 7.6, review_count: 890, budget_tier: "mid",
    facilities: ["WiFi", "AC", "Restaurant"],
    lat_lng: { lat: 21.4291, lng: 91.9758 }, address: "Motel Road, Laboni Point, Cox's Bazar",
    description: "Straightforward three-star close to Laboni point, popular with families for the price.",
    distance_to_landmark: { landmark: "Laboni Beach", km: 1.1 }, phone: "+880 1811-458000",
    room_types: [
      { name: "Standard Double", capacity: 2, price_per_night: 3200, beds: "1 queen", rooms_available: 18 },
      { name: "Deluxe Family", capacity: 4, price_per_night: 5400, beds: "2 double", rooms_available: 8 },
    ],
  },
  {
    slug: "hotel-mishuk-cox", destination_slug: "coxs-bazar", name: "Hotel Mishuk", city: "Cox's Bazar", area: "Sugandha",
    price_per_night: 1800, rating: 3.4, star_rating: 2, review_score: 7.0, review_count: 410, budget_tier: "budget",
    facilities: ["WiFi", "AC"],
    lat_lng: { lat: 21.4203, lng: 91.9741 }, address: "Sugandha Point, Cox's Bazar",
    description: "Basic budget rooms two minutes from the Sugandha food stalls — no frills, clean enough, and the cheapest AC on this stretch.",
    distance_to_landmark: { landmark: "Sugandha Beach", km: 0.3 },
    room_types: [
      { name: "Non-AC Double", capacity: 2, price_per_night: 1200, beds: "1 double", has_ac: false, rooms_available: 10 },
      { name: "AC Double", capacity: 2, price_per_night: 1800, beds: "1 double", rooms_available: 12 },
    ],
  },
  {
    slug: "royal-tulip-coxs", destination_slug: "coxs-bazar", name: "Royal Tulip Sea Pearl Beach Resort", city: "Cox's Bazar", area: "Inani",
    price_per_night: 15500, rating: 4.8, star_rating: 5, review_score: 9.1, review_count: 980, budget_tier: "luxury",
    facilities: ["WiFi", "Pool", "Spa", "Breakfast", "Restaurant", "Gym", "Private Beach", "Water Park", "Parking"],
    lat_lng: { lat: 21.2611, lng: 92.0331 }, address: "Marine Drive, Inani, Ukhia, Cox's Bazar",
    description: "The country's largest beach resort, 30 km south at Inani — effectively a self-contained stay, far from the town crowds.",
    distance_to_landmark: { landmark: "Inani Beach", km: 0.1 }, phone: "+880 9610-991199",
    room_types: [
      { name: "Deluxe Hill View", capacity: 2, price_per_night: 15500, beds: "1 king", breakfast_included: true, rooms_available: 20 },
      { name: "Premium Sea View", capacity: 2, price_per_night: 21000, beds: "1 king", breakfast_included: true, rooms_available: 12 },
      { name: "Two-Bedroom Suite", capacity: 5, price_per_night: 38000, beds: "2 king", breakfast_included: true, rooms_available: 3 },
    ],
    cancellation_policy: "Free cancellation up to 7 days before check-in; 50% charge thereafter.",
  },

  // ────────────────────────── Sajek Valley ──────────────────────────
  {
    slug: "meghpunji-resort", destination_slug: "sajek-valley", name: "Meghpunji Resort", city: "Sajek Valley", area: "Ruilui Para",
    price_per_night: 4500, rating: 4.4, star_rating: 3, review_score: 8.5, review_count: 320, budget_tier: "mid",
    facilities: ["Valley View", "Restaurant", "Bonfire", "Generator Power"],
    lat_lng: { lat: 23.3825, lng: 92.2951 }, address: "Ruilui Para, Sajek Valley",
    description: "Cottages built along the ridge line, every one facing the valley — the cloud view is the entire proposition.",
    distance_to_landmark: { landmark: "Sajek Helipad", km: 0.3 },
    room_types: [
      { name: "Valley View Couple", capacity: 2, price_per_night: 4500, beds: "1 double", rooms_available: 6 },
      { name: "Family Cottage", capacity: 4, price_per_night: 7500, beds: "2 double", rooms_available: 4 },
    ],
    cancellation_policy: "Non-refundable within 7 days — Sajek books out well ahead in season.",
  },
  {
    slug: "sajek-resort", destination_slug: "sajek-valley", name: "Sajek Resort (Army Operated)", city: "Sajek Valley", area: "Ruilui Para",
    price_per_night: 9000, rating: 4.6, star_rating: 4, review_score: 8.8, review_count: 540, budget_tier: "luxury",
    facilities: ["Valley View", "Restaurant", "WiFi", "Hot Water", "Generator Power", "Parking"],
    lat_lng: { lat: 23.3841, lng: 92.2963 }, address: "Ruilui Para, Sajek Valley, Rangamati",
    description: "The best-appointed property on the ridge, run by the army — book through their office, often weeks in advance.",
    distance_to_landmark: { landmark: "Konglak Hill", km: 1.2 },
    room_types: [
      { name: "Standard Double", capacity: 2, price_per_night: 9000, beds: "1 king", breakfast_included: true, rooms_available: 8 },
      { name: "VIP Suite", capacity: 4, price_per_night: 15000, beds: "1 king + 2 single", breakfast_included: true, rooms_available: 2 },
    ],
  },
  {
    slug: "runmoy-resort", destination_slug: "sajek-valley", name: "Runmoy Resort", city: "Sajek Valley", area: "Ruilui Para",
    price_per_night: 2500, rating: 4.0, star_rating: 2, review_score: 7.8, review_count: 210, budget_tier: "budget",
    facilities: ["Valley View", "Restaurant", "Bonfire"],
    lat_lng: { lat: 23.3812, lng: 92.2937 }, address: "Ruilui Para, Sajek Valley",
    description: "Simple bamboo-and-timber cottages with a shared veranda — the budget way to wake up above the clouds.",
    distance_to_landmark: { landmark: "Ruilui Para centre", km: 0.1 },
    room_types: [
      { name: "Bamboo Cottage", capacity: 2, price_per_night: 2500, beds: "1 double", has_ac: false, rooms_available: 8 },
      { name: "Group Cottage", capacity: 6, price_per_night: 5500, beds: "3 double", has_ac: false, rooms_available: 3 },
    ],
  },

  // ─────────────────────── Sundarbans / Khulna ───────────────────────
  {
    slug: "mv-alaska-cruise", destination_slug: "sundarbans", name: "MV Alaska (Cruise Package)", city: "Sundarbans", area: "Khulna departure",
    price_per_night: 8500, rating: 4.5, star_rating: 3, review_score: 8.4, review_count: 260, budget_tier: "mid",
    facilities: ["Full Board", "Guide", "Forest Permit", "AC Cabin", "Deck Lounge"],
    lat_lng: { lat: 22.8156, lng: 89.5403 }, address: "Departs BIWTA Ghat, Khulna",
    description: "Three-day live-aboard covering Karamjal, Harbaria and Kotka. The nightly rate is per person, all meals, permits and guide included.",
    distance_to_landmark: { landmark: "Karamjal Wildlife Centre", km: 0 },
    room_types: [
      { name: "Twin Cabin (per person)", capacity: 1, price_per_night: 8500, beds: "1 single", breakfast_included: true, rooms_available: 16 },
      { name: "Deluxe Cabin (per person)", capacity: 1, price_per_night: 11000, beds: "1 double", breakfast_included: true, rooms_available: 6 },
    ],
    cancellation_policy: "50% refundable up to 14 days before departure; non-refundable thereafter.",
  },
  {
    slug: "hotel-castle-salam", destination_slug: "khulna", name: "Hotel Castle Salam", city: "Khulna", area: "KDA Avenue",
    price_per_night: 3800, rating: 4.1, star_rating: 3, review_score: 7.9, review_count: 620, budget_tier: "mid",
    facilities: ["WiFi", "AC", "Restaurant", "Parking", "Conference Room"],
    lat_lng: { lat: 22.8103, lng: 89.5628 }, address: "KDA Avenue, Khulna",
    description: "The standard business hotel in Khulna, and the usual overnight before a morning Sundarbans departure.",
    distance_to_landmark: { landmark: "Rupsha Bridge", km: 4.2 }, phone: "+880 41-730133",
    room_types: [
      { name: "Standard Double", capacity: 2, price_per_night: 3800, beds: "1 queen", breakfast_included: true, rooms_available: 22 },
      { name: "Executive Suite", capacity: 3, price_per_night: 6500, beds: "1 king", breakfast_included: true, rooms_available: 5 },
    ],
  },

  // ──────────────────────── Sylhet / Srimangal ────────────────────────
  {
    slug: "grand-sultan-tea-resort", destination_slug: "srimangal", name: "The Grand Sultan Tea Resort & Golf", city: "Srimangal", area: "Radhanagar",
    price_per_night: 16500, rating: 4.7, star_rating: 5, review_score: 8.9, review_count: 1120, budget_tier: "luxury",
    facilities: ["WiFi", "Pool", "Spa", "Golf", "Breakfast", "Restaurant", "Gym", "Tea Garden View", "Parking"],
    lat_lng: { lat: 24.3208, lng: 91.7411 }, address: "Radhanagar, Srimangal, Moulvibazar",
    description: "A five-star built into the tea estates — the only property of its class in the north-east, and worth a night even on a short trip.",
    distance_to_landmark: { landmark: "Lawachara National Park", km: 6.5 }, phone: "+880 9612-333888",
    room_types: [
      { name: "Deluxe Garden View", capacity: 2, price_per_night: 16500, beds: "1 king", breakfast_included: true, rooms_available: 24 },
      { name: "Executive Suite", capacity: 3, price_per_night: 26000, beds: "1 king", breakfast_included: true, rooms_available: 8 },
      { name: "Presidential Villa", capacity: 6, price_per_night: 52000, beds: "3 king", breakfast_included: true, rooms_available: 2 },
    ],
    cancellation_policy: "Free cancellation up to 72 hours before check-in.",
  },
  {
    slug: "tea-town-rest-house", destination_slug: "srimangal", name: "Tea Town Rest House", city: "Srimangal", area: "Station Road",
    price_per_night: 2200, rating: 3.8, star_rating: 2, review_score: 7.4, review_count: 340, budget_tier: "budget",
    facilities: ["WiFi", "AC", "Restaurant"],
    lat_lng: { lat: 24.3081, lng: 91.7278 }, address: "Station Road, Srimangal",
    description: "Walkable from the railway station, which matters here — most visitors arrive on the morning train from Dhaka.",
    distance_to_landmark: { landmark: "Srimangal Railway Station", km: 0.4 },
    room_types: [
      { name: "AC Double", capacity: 2, price_per_night: 2200, beds: "1 double", rooms_available: 14 },
      { name: "Non-AC Twin", capacity: 2, price_per_night: 1400, beds: "2 single", has_ac: false, rooms_available: 8 },
    ],
  },
  {
    slug: "rose-view-sylhet", destination_slug: "sylhet", name: "Rose View Hotel", city: "Sylhet", area: "Shahjalal Upashahar",
    price_per_night: 7200, rating: 4.4, star_rating: 5, review_score: 8.5, review_count: 1340, budget_tier: "luxury",
    facilities: ["WiFi", "Pool", "Gym", "Breakfast", "Restaurant", "Parking", "Conference Room"],
    lat_lng: { lat: 24.8892, lng: 91.8722 }, address: "Shahjalal Upashahar, Sylhet",
    description: "Sylhet's established five-star, and the most convenient base for day trips out to Ratargul and Jaflong.",
    distance_to_landmark: { landmark: "Hazrat Shahjalal Shrine", km: 2.8 }, phone: "+880 821-721835",
    room_types: [
      { name: "Deluxe Double", capacity: 2, price_per_night: 7200, beds: "1 king", breakfast_included: true, rooms_available: 30 },
      { name: "Club Suite", capacity: 4, price_per_night: 13500, beds: "1 king + 2 single", breakfast_included: true, rooms_available: 6 },
    ],
  },
  {
    slug: "hotel-noorjahan-sylhet", destination_slug: "sylhet", name: "Hotel Noorjahan Grand", city: "Sylhet", area: "Dargah Gate",
    price_per_night: 4200, rating: 4.2, star_rating: 4, review_score: 8.2, review_count: 870, budget_tier: "mid",
    facilities: ["WiFi", "AC", "Restaurant", "Gym", "Parking"],
    lat_lng: { lat: 24.9019, lng: 91.8675 }, address: "Dargah Gate, Sylhet",
    description: "Right at Dargah Gate — the shortest walk to the shrine of anything in this class.",
    distance_to_landmark: { landmark: "Hazrat Shahjalal Shrine", km: 0.3 }, phone: "+880 821-728888",
    room_types: [
      { name: "Superior Double", capacity: 2, price_per_night: 4200, beds: "1 queen", breakfast_included: true, rooms_available: 26 },
      { name: "Family Suite", capacity: 4, price_per_night: 7800, beds: "2 queen", breakfast_included: true, rooms_available: 7 },
    ],
  },

  // ──────────────────── Bandarban / Rangamati / Khagrachari ────────────────────
  {
    slug: "hillside-resort-bandarban", destination_slug: "bandarban", name: "Hillside Resort", city: "Bandarban", area: "Milanchari",
    price_per_night: 5500, rating: 4.3, star_rating: 3, review_score: 8.3, review_count: 480, budget_tier: "mid",
    facilities: ["Hill View", "Restaurant", "WiFi", "Bonfire", "Parking"],
    lat_lng: { lat: 22.1719, lng: 92.2264 }, address: "Milanchari, Chimbuk Road, Bandarban",
    description: "Cottages on a hillside 4 km out of town on the Chimbuk road, run by the Guide Tours group.",
    distance_to_landmark: { landmark: "Bandarban town", km: 4.0 },
    room_types: [
      { name: "Hill Cottage", capacity: 2, price_per_night: 5500, beds: "1 double", rooms_available: 10 },
      { name: "Family Cottage", capacity: 4, price_per_night: 8500, beds: "2 double", rooms_available: 5 },
    ],
  },
  {
    slug: "nilgiri-hill-resort", destination_slug: "bandarban", name: "Nilgiri Hill Resort", city: "Bandarban", area: "Nilgiri",
    price_per_night: 11000, rating: 4.6, star_rating: 3, review_score: 8.7, review_count: 390, budget_tier: "luxury",
    facilities: ["Cloud View", "Restaurant", "Generator Power", "Parking"],
    lat_lng: { lat: 21.9678, lng: 92.4011 }, address: "Nilgiri, Thanchi Road, Bandarban",
    description: "Army-run cottages at 2,200 feet — on a clear winter morning the clouds sit below the balcony. Book through the army office.",
    distance_to_landmark: { landmark: "Nilgiri viewpoint", km: 0 },
    room_types: [
      { name: "Meghdut Cottage", capacity: 2, price_per_night: 11000, beds: "1 double", rooms_available: 4 },
      { name: "Ashra Cottage", capacity: 4, price_per_night: 16000, beds: "2 double", rooms_available: 3 },
    ],
    cancellation_policy: "Non-refundable. Booking is confirmed only against full advance payment.",
  },
  {
    slug: "parjatan-rangamati", destination_slug: "rangamati", name: "Parjatan Holiday Complex", city: "Rangamati", area: "Deer Park",
    price_per_night: 3400, rating: 3.9, star_rating: 3, review_score: 7.5, review_count: 560, budget_tier: "mid",
    facilities: ["Lake View", "Restaurant", "AC", "Parking", "Hanging Bridge Access"],
    lat_lng: { lat: 22.6339, lng: 92.1828 }, address: "Deer Park, Rangamati",
    description: "The government tourism complex beside the hanging bridge — dated, but the lake-facing rooms are the best-placed in town.",
    distance_to_landmark: { landmark: "Rangamati Hanging Bridge", km: 0.1 }, phone: "+880 351-63126",
    room_types: [
      { name: "Standard AC Double", capacity: 2, price_per_night: 3400, beds: "1 double", rooms_available: 16 },
      { name: "Lake View Suite", capacity: 4, price_per_night: 5800, beds: "2 double", rooms_available: 6 },
    ],
  },
  {
    slug: "hotel-gairing-khagrachari", destination_slug: "khagrachari", name: "Hotel Gairing", city: "Khagrachari", area: "Shapla Chattar",
    price_per_night: 2400, rating: 3.7, star_rating: 2, review_score: 7.2, review_count: 190, budget_tier: "budget",
    facilities: ["WiFi", "AC", "Restaurant"],
    lat_lng: { lat: 23.1147, lng: 91.9836 }, address: "Shapla Chattar, Khagrachari",
    description: "Central and cheap — mostly used as the night before an early Sajek convoy.",
    distance_to_landmark: { landmark: "Khagrachari bus stand", km: 0.8 },
    room_types: [
      { name: "AC Double", capacity: 2, price_per_night: 2400, beds: "1 double", rooms_available: 12 },
      { name: "Non-AC Twin", capacity: 2, price_per_night: 1500, beds: "2 single", has_ac: false, rooms_available: 8 },
    ],
  },

  // ──────────────── Dhaka / Chattogram / other cities ────────────────
  {
    slug: "pan-pacific-sonargaon", destination_slug: "dhaka", name: "Pan Pacific Sonargaon Dhaka", city: "Dhaka", area: "Karwan Bazar",
    price_per_night: 18500, rating: 4.7, star_rating: 5, review_score: 8.8, review_count: 3240, budget_tier: "luxury",
    facilities: ["WiFi", "Pool", "Spa", "Gym", "Breakfast", "Restaurant", "Bar", "Business Centre", "Parking"],
    lat_lng: { lat: 23.7503, lng: 90.3936 }, address: "107 Kazi Nazrul Islam Avenue, Karwan Bazar, Dhaka",
    description: "The city's long-standing luxury benchmark, central to both Motijheel and the diplomatic zone.",
    distance_to_landmark: { landmark: "Karwan Bazar", km: 0.5 }, phone: "+880 2-8330001",
    room_types: [
      { name: "Superior King", capacity: 2, price_per_night: 18500, beds: "1 king", breakfast_included: true, rooms_available: 40 },
      { name: "Pacific Club Room", capacity: 2, price_per_night: 26000, beds: "1 king", breakfast_included: true, rooms_available: 20 },
      { name: "Executive Suite", capacity: 4, price_per_night: 45000, beds: "1 king + sofa bed", breakfast_included: true, rooms_available: 6 },
    ],
    cancellation_policy: "Free cancellation up to 24 hours before check-in.",
  },
  {
    slug: "hotel-71-dhaka", destination_slug: "dhaka", name: "Hotel 71", city: "Dhaka", area: "Bijoynagar",
    price_per_night: 5600, rating: 4.1, star_rating: 4, review_score: 8.0, review_count: 1180, budget_tier: "mid",
    facilities: ["WiFi", "AC", "Restaurant", "Gym", "Parking"],
    lat_lng: { lat: 23.7361, lng: 90.4064 }, address: "Bijoynagar, Purana Paltan, Dhaka",
    description: "Well-run four-star in Paltan, convenient for Old Dhaka sightseeing and the Kamalapur rail station.",
    distance_to_landmark: { landmark: "Kamalapur Railway Station", km: 2.4 }, phone: "+880 2-9339071",
    room_types: [
      { name: "Deluxe Double", capacity: 2, price_per_night: 5600, beds: "1 queen", breakfast_included: true, rooms_available: 28 },
      { name: "Family Room", capacity: 4, price_per_night: 9200, beds: "2 queen", breakfast_included: true, rooms_available: 8 },
    ],
  },
  {
    slug: "hotel-victory-dhaka", destination_slug: "dhaka", name: "Hotel Victory", city: "Dhaka", area: "Bijoynagar",
    price_per_night: 2800, rating: 3.6, star_rating: 3, review_score: 7.3, review_count: 640, budget_tier: "budget",
    facilities: ["WiFi", "AC", "Restaurant"],
    lat_lng: { lat: 23.7344, lng: 90.4092 }, address: "30 Bijoynagar Road, Dhaka",
    description: "Reliable budget option in the same district as Hotel 71, at half the rate.",
    distance_to_landmark: { landmark: "Paltan", km: 0.6 },
    room_types: [
      { name: "Standard AC Double", capacity: 2, price_per_night: 2800, beds: "1 double", rooms_available: 24 },
      { name: "Twin Economy", capacity: 2, price_per_night: 2000, beds: "2 single", rooms_available: 12 },
    ],
  },
  {
    slug: "radisson-blu-chattogram", destination_slug: "chattogram", name: "Radisson Blu Chattogram Bay View", city: "Chattogram", area: "Nasirabad",
    price_per_night: 14000, rating: 4.6, star_rating: 5, review_score: 8.7, review_count: 1560, budget_tier: "luxury",
    facilities: ["WiFi", "Pool", "Spa", "Gym", "Breakfast", "Restaurant", "Bar", "Parking"],
    lat_lng: { lat: 22.3608, lng: 91.8153 }, address: "SS Khaled Road, Nasirabad, Chattogram",
    description: "The city's best hotel by some distance, on the hill above the cantonment.",
    distance_to_landmark: { landmark: "Chattogram city centre", km: 3.1 }, phone: "+880 31-2856956",
    room_types: [
      { name: "Superior King", capacity: 2, price_per_night: 14000, beds: "1 king", breakfast_included: true, rooms_available: 32 },
      { name: "Business Class", capacity: 2, price_per_night: 19000, beds: "1 king", breakfast_included: true, rooms_available: 14 },
    ],
  },
  {
    slug: "well-park-residence", destination_slug: "chattogram", name: "Well Park Residence", city: "Chattogram", area: "Agrabad",
    price_per_night: 4600, rating: 4.0, star_rating: 4, review_score: 7.9, review_count: 720, budget_tier: "mid",
    facilities: ["WiFi", "AC", "Restaurant", "Gym", "Parking"],
    lat_lng: { lat: 22.3269, lng: 91.8114 }, address: "Agrabad Commercial Area, Chattogram",
    description: "Business hotel in Agrabad, handy for the port and the Cox's Bazar road out of the city.",
    distance_to_landmark: { landmark: "Agrabad", km: 0.2 },
    room_types: [
      { name: "Deluxe Double", capacity: 2, price_per_night: 4600, beds: "1 queen", breakfast_included: true, rooms_available: 20 },
      { name: "Executive Twin", capacity: 2, price_per_night: 6000, beds: "2 single", breakfast_included: true, rooms_available: 10 },
    ],
  },
  {
    slug: "blue-marine-saint-martins", destination_slug: "saint-martins", name: "Blue Marine Resort", city: "Saint Martin's Island", area: "West Beach",
    price_per_night: 5200, rating: 4.2, star_rating: 3, review_score: 8.0, review_count: 410, budget_tier: "mid",
    facilities: ["Sea View", "Restaurant", "Generator Power", "Beach Access"],
    lat_lng: { lat: 20.6289, lng: 92.3183 }, address: "West Beach, Saint Martin's Island",
    description: "Beachfront cottages on the west side, positioned for the sunset. Power runs on a generator, not around the clock.",
    distance_to_landmark: { landmark: "West Beach", km: 0.05 },
    room_types: [
      { name: "Sea View Couple", capacity: 2, price_per_night: 5200, beds: "1 double", rooms_available: 10 },
      { name: "Family Cottage", capacity: 4, price_per_night: 8400, beds: "2 double", rooms_available: 5 },
    ],
    cancellation_policy: "Non-refundable in season — ferry capacity is fixed and rooms resell slowly.",
  },
  {
    slug: "sun-set-view-kuakata", destination_slug: "kuakata", name: "Hotel Sun Set View", city: "Kuakata", area: "Beach Road",
    price_per_night: 2600, rating: 3.8, star_rating: 3, review_score: 7.4, review_count: 280, budget_tier: "budget",
    facilities: ["Sea View", "WiFi", "AC", "Restaurant"],
    lat_lng: { lat: 21.8189, lng: 90.1219 }, address: "Beach Road, Kuakata, Patuakhali",
    description: "Two minutes from the sand, with sea-facing balconies on the upper floors.",
    distance_to_landmark: { landmark: "Kuakata Beach", km: 0.15 },
    room_types: [
      { name: "AC Sea View", capacity: 2, price_per_night: 2600, beds: "1 double", rooms_available: 14 },
      { name: "Family Room", capacity: 4, price_per_night: 4200, beds: "2 double", rooms_available: 6 },
    ],
  },
  {
    slug: "hotel-grand-park-barishal", destination_slug: "barishal", name: "Hotel Grand Park", city: "Barishal", area: "Band Road",
    price_per_night: 3600, rating: 4.1, star_rating: 4, review_score: 8.1, review_count: 520, budget_tier: "mid",
    facilities: ["WiFi", "AC", "Restaurant", "Gym", "Parking"],
    lat_lng: { lat: 22.6986, lng: 90.3711 }, address: "Band Road, Barishal",
    description: "The best hotel in the city, a short ride from the launch terminal.",
    distance_to_landmark: { landmark: "Barishal Launch Terminal", km: 1.9 }, phone: "+880 431-2177711",
    room_types: [
      { name: "Deluxe Double", capacity: 2, price_per_night: 3600, beds: "1 queen", breakfast_included: true, rooms_available: 18 },
      { name: "Executive Suite", capacity: 3, price_per_night: 6200, beds: "1 king", breakfast_included: true, rooms_available: 5 },
    ],
  },
  {
    slug: "hotel-nice-international-rajshahi", destination_slug: "rajshahi", name: "Hotel Nice International", city: "Rajshahi", area: "Shaheb Bazar",
    price_per_night: 2400, rating: 3.7, star_rating: 3, review_score: 7.3, review_count: 310, budget_tier: "budget",
    facilities: ["WiFi", "AC", "Restaurant", "Parking"],
    lat_lng: { lat: 24.3697, lng: 88.6017 }, address: "Shaheb Bazar, Rajshahi",
    description: "Central, clean and cheap — walking distance from Shaheb Bazar and the Padma embankment.",
    distance_to_landmark: { landmark: "Padma Garden", km: 1.3 },
    room_types: [
      { name: "AC Double", capacity: 2, price_per_night: 2400, beds: "1 double", rooms_available: 16 },
      { name: "Family Room", capacity: 4, price_per_night: 3900, beds: "2 double", rooms_available: 6 },
    ],
  },
  {
    slug: "nijhum-resort", destination_slug: "nijhum-dwip", name: "Nijhum Resort", city: "Nijhum Dwip", area: "Namar Bazar",
    price_per_night: 1800, rating: 3.5, star_rating: 2, review_score: 7.0, review_count: 120, budget_tier: "budget",
    facilities: ["Restaurant", "Generator Power", "Beach Access"],
    lat_lng: { lat: 22.0347, lng: 91.0181 }, address: "Namar Bazar, Nijhum Dwip, Hatiya",
    description: "One of a handful of places to stay on the island. Basic rooms, limited power, and the best sunset on Namar Bazar beach.",
    distance_to_landmark: { landmark: "Namar Bazar Beach", km: 0.3 },
    room_types: [
      { name: "Standard Double", capacity: 2, price_per_night: 1800, beds: "1 double", has_ac: false, rooms_available: 8 },
      { name: "Group Room", capacity: 6, price_per_night: 4000, beds: "3 double", has_ac: false, rooms_available: 2 },
    ],
  },

  // ───────────────────────── International ─────────────────────────
  {
    slug: "ibis-bangkok-siam", destination_slug: "bangkok", name: "ibis Bangkok Siam", city: "Bangkok", area: "Siam",
    price_per_night: 6800, rating: 4.2, star_rating: 3, review_score: 8.2, review_count: 4120, budget_tier: "mid",
    facilities: ["WiFi", "Pool", "Restaurant", "Gym", "BTS Access"],
    lat_lng: { lat: 13.7511, lng: 100.5225 }, address: "927 Rama I Road, Wang Mai, Bangkok",
    description: "On the BTS line at National Stadium — the practical choice for a first Bangkok trip built around the Skytrain.",
    distance_to_landmark: { landmark: "Siam Paragon", km: 1.2 },
    room_types: [
      { name: "Standard Double", capacity: 2, price_per_night: 6800, beds: "1 queen", rooms_available: 40 },
      { name: "Family Room", capacity: 4, price_per_night: 10500, beds: "2 double", rooms_available: 12 },
    ],
  },
];

export default hotels;
