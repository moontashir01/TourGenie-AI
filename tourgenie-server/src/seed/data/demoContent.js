// Demo accounts and the sample activity the admin analytics aggregates over.
//
// The analytics snapshots are computed by genuinely aggregating these
// records by their created_at date — the numbers on the admin dashboard are
// real counts over demo data, not invented chart values.

export const DEMO_PASSWORD = "Traveler123!";
export const ADMIN_PASSWORD = "Admin123!";

export const users = [
  {
    name: "TourGenie Admin", email: "admin@tourgenie.ai", role: "admin", language: "en",
    password: ADMIN_PASSWORD, city: "Dhaka", days_ago: 240, email_verified: true,
  },
  {
    name: "Moontashir Azim", email: "moontashir@tourgenie.ai", role: "traveler", language: "en",
    password: DEMO_PASSWORD, city: "Dhaka", days_ago: 210, email_verified: true,
    preferences: { interests: ["beach", "photography", "food"], default_budget_tier: "mid" },
  },
  {
    name: "Quazi Md Sadman", email: "sadman@tourgenie.ai", role: "traveler", language: "en",
    password: DEMO_PASSWORD, city: "Dhaka", days_ago: 210, email_verified: true,
    preferences: { interests: ["hills", "trekking", "adventure"], default_budget_tier: "budget" },
  },
  { name: "Farhana Rahman", email: "farhana@example.com", role: "traveler", language: "bn", password: DEMO_PASSWORD, city: "Dhaka", days_ago: 165, preferences: { interests: ["beach", "relaxation", "family"] } },
  { name: "Tanvir Hossain", email: "tanvir@example.com", role: "traveler", language: "bn", password: DEMO_PASSWORD, city: "Chattogram", days_ago: 150, preferences: { interests: ["hills", "photography", "adventure"] } },
  { name: "Mahin Ahmed", email: "mahin@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, city: "Khulna", days_ago: 132, preferences: { interests: ["wildlife", "boating"] } },
  { name: "Nusrat Jahan", email: "nusrat@example.com", role: "traveler", language: "bn", password: DEMO_PASSWORD, city: "Sylhet", days_ago: 118, preferences: { interests: ["waterfalls", "nature", "photography"] } },
  { name: "Rafiul Islam", email: "rafiul@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, city: "Rajshahi", days_ago: 96, preferences: { interests: ["history", "culture"] } },
  { name: "Sadia Afrin", email: "sadia@example.com", role: "traveler", language: "bn", password: DEMO_PASSWORD, city: "Dhaka", days_ago: 74, preferences: { interests: ["food", "shopping", "city"] } },
  { name: "Imran Kabir", email: "imran@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, city: "Barishal", days_ago: 58, preferences: { interests: ["boating", "relaxation"] } },
  { name: "Priya Chakma", email: "priya@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, city: "Rangamati", days_ago: 41, preferences: { interests: ["hills", "culture", "photography"] } },
  { name: "Arif Chowdhury", email: "arif@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, city: "Dhaka", days_ago: 27, preferences: { interests: ["trekking", "adventure"] } },
  { name: "Zannatul Ferdous", email: "zannat@example.com", role: "traveler", language: "bn", password: DEMO_PASSWORD, city: "Cox's Bazar", days_ago: 15, preferences: { interests: ["beach", "family"] } },
  { name: "Shahriar Kabir", email: "shahriar@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, city: "Dhaka", days_ago: 6, is_active: false, preferences: { interests: ["history"] } },
  { name: "Anong Srisai", email: "anong.th@example.com", role: "traveler", language: "th", password: DEMO_PASSWORD, country: "Thailand", city: "Bangkok", days_ago: 120, preferences: { currency: "BDT", interests: ["food", "culture", "beach"] } },
  { name: "Nur Aisyah", email: "aisyah.my@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, country: "Thailand", city: "Bangkok", days_ago: 105, preferences: { currency: "BDT", interests: ["food", "history", "nature"] } },
  { name: "Aarav Mehta", email: "aarav.in@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, country: "Thailand", city: "Bangkok", days_ago: 90, preferences: { currency: "BDT", interests: ["history", "food", "photography"] } },
  { name: "Sushma Karki", email: "sushma.np@example.com", role: "traveler", language: "en", password: DEMO_PASSWORD, country: "Thailand", city: "Chiang Mai", days_ago: 76, preferences: { currency: "BDT", interests: ["nature", "beach", "culture"] } },
];

// Trips spread across the past six months and a few weeks ahead, so the
// dashboard has completed, active, planned and draft trips at once.
// `start_offset_days` is relative to today: negative is past.
export const trips = [
  { user_email: "moontashir@tourgenie.ai", origin: "Dhaka", destination: "Cox's Bazar", start_offset_days: 4, nights: 3, travelers: 2, budget: 20000, status: "planned", interests: ["beach", "photography", "food"], budget_tier: "mid", created_days_ago: 12, cover: "beach" },
  { user_email: "moontashir@tourgenie.ai", origin: "Dhaka", destination: "Srimangal", start_offset_days: -45, nights: 1, travelers: 2, budget: 9000, status: "completed", interests: ["wildlife", "relaxation"], budget_tier: "mid", created_days_ago: 58, cover: "forest" },
  { user_email: "sadman@tourgenie.ai", origin: "Dhaka", destination: "Sajek Valley", start_offset_days: 18, nights: 2, travelers: 4, budget: 32000, status: "draft", interests: ["hills", "photography", "adventure"], budget_tier: "budget", created_days_ago: 5, cover: "hills" },
  { user_email: "sadman@tourgenie.ai", origin: "Dhaka", destination: "Bandarban", start_offset_days: -80, nights: 3, travelers: 3, budget: 36000, status: "completed", interests: ["trekking", "adventure", "hills"], budget_tier: "mid", created_days_ago: 95, cover: "hills" },
  { user_email: "farhana@example.com", origin: "Dhaka", destination: "Cox's Bazar", start_offset_days: -120, nights: 3, travelers: 4, budget: 42000, status: "completed", interests: ["beach", "family", "relaxation"], budget_tier: "mid", created_days_ago: 138, cover: "beach" },
  { user_email: "farhana@example.com", origin: "Dhaka", destination: "Kuakata", start_offset_days: 30, nights: 1, travelers: 4, budget: 18000, status: "planned", interests: ["beach", "relaxation"], budget_tier: "budget", created_days_ago: 9, cover: "beach" },
  { user_email: "tanvir@example.com", origin: "Chattogram", destination: "Sajek Valley", start_offset_days: -95, nights: 2, travelers: 5, budget: 45000, status: "completed", interests: ["hills", "photography"], budget_tier: "mid", created_days_ago: 110, cover: "hills" },
  { user_email: "tanvir@example.com", origin: "Chattogram", destination: "Rangamati", start_offset_days: -30, nights: 2, travelers: 2, budget: 16000, status: "completed", interests: ["boating", "hills"], budget_tier: "mid", created_days_ago: 44, cover: "hills" },
  { user_email: "tanvir@example.com", origin: "Chattogram", destination: "Bandarban", start_offset_days: 12, nights: 3, travelers: 3, budget: 38000, status: "planned", interests: ["trekking", "adventure"], budget_tier: "mid", created_days_ago: 3, cover: "hills" },
  { user_email: "mahin@example.com", origin: "Khulna", destination: "Sundarbans", start_offset_days: -60, nights: 2, travelers: 3, budget: 82000, status: "completed", interests: ["wildlife", "boating", "photography"], budget_tier: "mid", created_days_ago: 78, cover: "forest" },
  { user_email: "mahin@example.com", origin: "Khulna", destination: "Bagerhat", start_offset_days: -58, nights: 0, travelers: 3, budget: 6000, status: "completed", interests: ["history"], budget_tier: "budget", created_days_ago: 78, cover: "forest" },
  { user_email: "nusrat@example.com", origin: "Dhaka", destination: "Sylhet", start_offset_days: -22, nights: 2, travelers: 2, budget: 18000, status: "completed", interests: ["waterfalls", "photography", "religious"], budget_tier: "mid", created_days_ago: 36, cover: "forest" },
  { user_email: "nusrat@example.com", origin: "Dhaka", destination: "Jaflong", start_offset_days: 0, nights: 1, travelers: 2, budget: 7000, status: "active", interests: ["nature", "photography"], budget_tier: "budget", created_days_ago: 8, cover: "forest" },
  { user_email: "rafiul@example.com", origin: "Rajshahi", destination: "Paharpur", start_offset_days: -70, nights: 0, travelers: 2, budget: 5500, status: "completed", interests: ["history", "culture"], budget_tier: "budget", created_days_ago: 84, cover: "forest" },
  { user_email: "rafiul@example.com", origin: "Dhaka", destination: "Sonargaon", start_offset_days: -18, nights: 0, travelers: 4, budget: 8000, status: "completed", interests: ["history", "photography"], budget_tier: "budget", created_days_ago: 25, cover: "forest" },
  { user_email: "sadia@example.com", origin: "Dhaka", destination: "Pattaya", start_offset_days: -35, nights: 2, travelers: 2, budget: 62000, status: "completed", interests: ["food", "shopping", "history"], budget_tier: "mid", created_days_ago: 52, cover: "hills" },
  { user_email: "sadia@example.com", origin: "Dhaka", destination: "Bangkok", start_offset_days: 45, nights: 3, travelers: 2, budget: 175000, status: "draft", interests: ["shopping", "food", "nightlife"], budget_tier: "mid", created_days_ago: 2, cover: "beach" },
  { user_email: "imran@example.com", origin: "Dhaka", destination: "Barishal", start_offset_days: -14, nights: 1, travelers: 2, budget: 9000, status: "completed", interests: ["boating", "relaxation"], budget_tier: "budget", created_days_ago: 21, cover: "forest" },
  { user_email: "imran@example.com", origin: "Dhaka", destination: "Nijhum Dwip", start_offset_days: 25, nights: 2, travelers: 3, budget: 21000, status: "planned", interests: ["wildlife", "relaxation"], budget_tier: "budget", created_days_ago: 7, cover: "forest" },
  { user_email: "priya@example.com", origin: "Rangamati", destination: "Sajek Valley", start_offset_days: -8, nights: 2, travelers: 2, budget: 15000, status: "completed", interests: ["hills", "culture", "photography"], budget_tier: "mid", created_days_ago: 18, cover: "hills" },
  { user_email: "arif@example.com", origin: "Dhaka", destination: "Bandarban", start_offset_days: 7, nights: 3, travelers: 4, budget: 48000, status: "planned", interests: ["trekking", "adventure", "hills"], budget_tier: "mid", created_days_ago: 4, cover: "hills" },
  { user_email: "arif@example.com", origin: "Dhaka", destination: "Saint Martin's Island", start_offset_days: 60, nights: 2, travelers: 4, budget: 56000, status: "draft", interests: ["beach", "adventure"], budget_tier: "mid", created_days_ago: 1, cover: "beach" },
  { user_email: "zannat@example.com", origin: "Cox's Bazar", destination: "Saint Martin's Island", start_offset_days: -5, nights: 2, travelers: 2, budget: 28000, status: "completed", interests: ["beach", "relaxation"], budget_tier: "mid", created_days_ago: 13, cover: "beach" },
  { user_email: "zannat@example.com", origin: "Dhaka", destination: "Dhaka", start_offset_days: 90, nights: 1, travelers: 2, budget: 9000, status: "draft", interests: ["history", "food"], budget_tier: "budget", created_days_ago: 1, cover: "hills" },
  { user_email: "anong.th@example.com", origin: "Bangkok", destination: "Chiang Mai", start_offset_days: -42, nights: 3, travelers: 2, budget: 52000, status: "completed", interests: ["culture", "food", "nature"], budget_tier: "mid", created_days_ago: 56, cover: "hills" },
  { user_email: "anong.th@example.com", origin: "Bangkok", destination: "Phuket", start_offset_days: 28, nights: 4, travelers: 3, budget: 96000, status: "planned", interests: ["beach", "food", "relaxation"], budget_tier: "mid", created_days_ago: 8, cover: "beach" },
  { user_email: "aisyah.my@example.com", origin: "Bangkok", destination: "Krabi", start_offset_days: -34, nights: 2, travelers: 2, budget: 38000, status: "completed", interests: ["beach", "nature", "photography"], budget_tier: "mid", created_days_ago: 47, cover: "beach" },
  { user_email: "aisyah.my@example.com", origin: "Bangkok", destination: "Phuket", start_offset_days: 36, nights: 3, travelers: 2, budget: 68000, status: "planned", interests: ["beach", "food", "relaxation"], budget_tier: "mid", created_days_ago: 10, cover: "beach" },
  { user_email: "aarav.in@example.com", origin: "Bangkok", destination: "Chiang Mai", start_offset_days: -55, nights: 2, travelers: 4, budget: 52000, status: "completed", interests: ["culture", "food", "photography"], budget_tier: "mid", created_days_ago: 68, cover: "hills" },
  { user_email: "aarav.in@example.com", origin: "Bangkok", destination: "Pattaya", start_offset_days: 48, nights: 4, travelers: 2, budget: 110000, status: "draft", interests: ["beach", "food", "nightlife"], budget_tier: "mid", created_days_ago: 6, cover: "beach" },
  { user_email: "sushma.np@example.com", origin: "Chiang Mai", destination: "Krabi", start_offset_days: -28, nights: 3, travelers: 2, budget: 44000, status: "completed", interests: ["beach", "nature", "photography"], budget_tier: "mid", created_days_ago: 40, cover: "beach" },
  { user_email: "sushma.np@example.com", origin: "Bangkok", destination: "Chiang Mai", start_offset_days: 22, nights: 2, travelers: 3, budget: 54000, status: "planned", interests: ["culture", "nature", "food"], budget_tier: "mid", created_days_ago: 7, cover: "hills" },
];

// Community posts. `days_ago` drives both created_at and the analytics roll-up.
export const communityPosts = [
  { user_email: "farhana@example.com", place: "Cox's Bazar", rating: 5, days_ago: 118, likes: 34, content: "The AI itinerary nailed the sunset timing at Laboni Beach — genuinely better than the plan I made myself last year. It also put Inani on day two rather than day one, which was right: the light is better in the morning there.", tags: ["beach", "family"], is_pinned: true },
  { user_email: "tanvir@example.com", place: "Sajek Valley", rating: 4, days_ago: 92, likes: 21, content: "The road to Sajek is rough in monsoon and the convoy timing is not negotiable — TourGenie's packing list correctly warned about rain gear. Wish the route map showed elevation.", tags: ["hills", "monsoon"] },
  { user_email: "mahin@example.com", place: "Sundarbans", rating: 5, days_ago: 74, likes: 18, content: "Booked the launch through the demo booking flow just to plan seating — very clear which operators run which days. The actual cruise was three days and worth every taka.", tags: ["wildlife", "cruise"] },
  { user_email: "nusrat@example.com", place: "Sylhet", rating: 5, days_ago: 34, likes: 27, content: "Ratargul in October was exactly as the app described — water high enough to paddle through, not so high the trees were submerged. Timing advice was the most useful part.", tags: ["nature", "seasonal"], is_pinned: true },
  { user_email: "rafiul@example.com", place: "Paharpur", rating: 4, days_ago: 82, likes: 9, content: "Somapura Mahavihara is genuinely underrated. Half a day is enough, and the site museum is worth the extra thirty minutes. Go on a weekday.", tags: ["history", "unesco"] },
  { user_email: "sadia@example.com", place: "Pattaya", rating: 5, days_ago: 50, likes: 41, content: "Short flight, no language barrier, and the Walking Street on a Saturday night. The budget estimate came in slightly under what I actually spent — shopping is where it goes.", tags: ["international", "food"] },
  { user_email: "priya@example.com", place: "Sajek Valley", rating: 5, days_ago: 16, likes: 23, content: "Konglak at 5 AM in December — clear sky, full cloud sea below. The app flagged that this is weather-dependent and it was right; the group next to us went two days earlier and saw nothing.", tags: ["hills", "sunrise"] },
  { user_email: "imran@example.com", place: "Barishal", rating: 4, days_ago: 19, likes: 14, content: "The overnight launch is the trip, not the transport. Book a cabin, not deck. Sunset leaving Sadarghat is something else.", tags: ["launch", "river"] },
  { user_email: "zannat@example.com", place: "Saint Martin's Island", rating: 5, days_ago: 11, likes: 31, content: "Chera Dwip at low tide, then snorkelling in the afternoon. Check the overnight-stay rules before booking — they changed and the ferry capacity is fixed.", tags: ["island", "coral"] },
  { user_email: "moontashir@tourgenie.ai", place: "Srimangal", rating: 5, days_ago: 44, likes: 19, content: "Morning train from Kamalapur, gibbons in Lawachara before 9 AM, seven-layer tea in the afternoon, back the next evening. Easiest good trip in the country.", tags: ["nature", "train"] },
  { user_email: "sadman@tourgenie.ai", place: "Bandarban", rating: 4, days_ago: 88, likes: 26, content: "Boga Lake needs a guide and the permit process is real — plan it, don't improvise. Nilgiri on a clear December morning is the payoff.", tags: ["trekking", "permit"] },
  { user_email: "arif@example.com", place: "Bandarban", rating: 4, days_ago: 5, likes: 7, content: "Planning Nafakhum for next month. The app's cost estimate for the Thanchi boat looks about right based on what people are reporting.", tags: ["trekking", "planning"] },
  { user_email: "anong.th@example.com", place: "Chiang Mai", rating: 5, days_ago: 39, likes: 24, content: "Three days was enough for the old city, temples, and a relaxed market evening. Keeping the mountain day separate made the plan much less rushed.", tags: ["thailand", "culture"] },
  { user_email: "aisyah.my@example.com", place: "Krabi", rating: 5, days_ago: 31, likes: 29, content: "Railay Beach was stunning and the itinerary grouped Ao Nang food stops together instead of sending us back and forth across the peninsula repeatedly.", tags: ["thailand", "beach", "food"] },
  { user_email: "aarav.in@example.com", place: "Chiang Mai", rating: 4, days_ago: 51, likes: 17, content: "Starting Doi Suthep early avoided most of the heat, and the old city temples fitted comfortably into the afternoon.", tags: ["thailand", "culture"] },
  { user_email: "sushma.np@example.com", place: "Krabi", rating: 5, days_ago: 25, likes: 32, content: "The itinerary left a weather buffer for the island day trip, which mattered when the first morning had choppy seas.", tags: ["thailand", "beach"] },
];

// Attraction reviews. `attraction_slug` resolves at seed time.
export const reviews = [
  { user_email: "farhana@example.com", attraction_slug: "laboni-beach", rating: 5, days_ago: 117, title: "Best sunset spot in town", comment: "Crowded, but that's part of it. Get there by 5:30 to find a chair. The stalls behind sell decent fried snacks." },
  { user_email: "farhana@example.com", attraction_slug: "inani-beach", rating: 5, days_ago: 116, title: "Worth the drive south", comment: "Far cleaner and quieter than the town beaches. The coral boulders at low tide are the reason to come." },
  { user_email: "zannat@example.com", attraction_slug: "chera-dwip", rating: 5, days_ago: 10, title: "Check the tide before you go", comment: "We walked across at low tide and came back by boat. Get the timing wrong and you either can't cross or you're stuck." },
  { user_email: "priya@example.com", attraction_slug: "konglak-hill", rating: 5, days_ago: 15, title: "Go at 5 AM, not 6", comment: "The cloud sea starts breaking up by 6:30. It's a 25-minute walk up in the dark — bring a torch." },
  { user_email: "tanvir@example.com", attraction_slug: "sajek-helipad", rating: 4, days_ago: 91, title: "Good sunset, very crowded", comment: "Everyone in Sajek goes here at the same time. Fine, but Konglak at dawn is the better view." },
  { user_email: "sadman@tourgenie.ai", attraction_slug: "nilgiri", rating: 5, days_ago: 87, title: "Above the clouds in winter", comment: "December morning, completely clear, clouds sitting in the valleys below. Book the cottage well ahead — it's army-run and fills up." },
  { user_email: "sadman@tourgenie.ai", attraction_slug: "boga-lake", rating: 4, days_ago: 86, title: "Real trekking, plan properly", comment: "Guide and permit are mandatory, not optional. The lake itself is quiet and the guesthouse food was better than expected." },
  { user_email: "mahin@example.com", attraction_slug: "karamjal", rating: 4, days_ago: 73, title: "Good introduction to the mangroves", comment: "The boardwalk is easy and the breeding centre is interesting, but this is the shallow end of the Sundarbans. Kotka is where it gets real." },
  { user_email: "mahin@example.com", attraction_slug: "kotka-beach", rating: 5, days_ago: 72, title: "Where the forest meets the sea", comment: "We saw tiger tracks on the sand at dawn. No tiger, but the tracks were enough. Deer everywhere." },
  { user_email: "nusrat@example.com", attraction_slug: "ratargul", rating: 5, days_ago: 33, title: "Go after the monsoon, not during", comment: "October was perfect — enough water to paddle through, and the light comes through the canopy properly." },
  { user_email: "nusrat@example.com", attraction_slug: "jaflong-zero-point", rating: 4, days_ago: 32, title: "Beautiful, but very busy", comment: "The stones and the hills behind are lovely. It gets packed on Fridays; go on a weekday morning." },
  { user_email: "nusrat@example.com", attraction_slug: "bisnakandi", rating: 5, days_ago: 32, title: "Worth the long boat ride", comment: "It's a slog to get there and back, and completely worth it. Clear water over stones with the Meghalaya hills right there." },
  { user_email: "moontashir@tourgenie.ai", attraction_slug: "lawachara", rating: 5, days_ago: 43, title: "Be there at 7 AM for the gibbons", comment: "Take a forest guide from the gate — they know where the family is on any given morning. We heard them before we saw them." },
  { user_email: "moontashir@tourgenie.ai", attraction_slug: "nilkantha-tea-cabin", rating: 5, days_ago: 43, title: "The seven layers are real", comment: "Not a gimmick — the layers genuinely don't mix. Cash only, and there's usually a queue." },
  { user_email: "rafiul@example.com", attraction_slug: "somapura-mahavihara", rating: 5, days_ago: 81, title: "Extraordinary and almost empty", comment: "One of the most significant archaeological sites in South Asia and we had it nearly to ourselves. Bring a hat — there's no shade." },
  { user_email: "rafiul@example.com", attraction_slug: "panam-city", rating: 4, days_ago: 24, title: "Decaying and photogenic", comment: "One street, 52 houses, all falling down. An hour is enough. Closed Thursdays, which we found out the hard way." },
  { user_email: "sadia@example.com", attraction_slug: "grand-palace", rating: 4, days_ago: 49, title: "Beautiful but crowded", comment: "The temples are stunning. Must visit, but go early to avoid the afternoon heat. Strict dress code." },
  { user_email: "imran@example.com", attraction_slug: "floating-guava-market", rating: 5, days_ago: 18, title: "Be on the water by 6 AM", comment: "By 8 it's largely over. Reserve a small boat the night before at Bhimruli — worth the early start." },
  { user_email: "tanvir@example.com", attraction_slug: "kaptai-lake", rating: 5, days_ago: 42, title: "Reserve the boat for a full day", comment: "Half a day isn't enough. Split the boat cost across the group and go all the way to Shuvolong." },
  { user_email: "priya@example.com", attraction_slug: "chakma-rajbari", rating: 4, days_ago: 14, title: "Quiet and worth a stop", comment: "Small, but the Rajbana Vihara next door is beautiful and almost nobody visits." },
  { user_email: "farhana@example.com", attraction_slug: "himchari-national-park", rating: 3, days_ago: 115, title: "Waterfall is seasonal", comment: "In winter there's barely any water. The viewpoint over the bay is still good, but manage expectations outside the monsoon." },
  { user_email: "arif@example.com", attraction_slug: "lalbagh-fort", rating: 4, days_ago: 60, title: "Go early, before the heat", comment: "Nice gardens, good brickwork, closed Sundays. An hour and a half is plenty." },
  { user_email: "sadia@example.com", attraction_slug: "ahsan-manzil", rating: 4, days_ago: 61, title: "The riverside setting makes it", comment: "23 rooms restored to how the Nawabs had them. Combine it with a walk to Sadarghat at rush hour." },
  { user_email: "zannat@example.com", attraction_slug: "saint-martins-coral-reef", rating: 4, days_ago: 9, title: "Gear hire on the beach is fine", comment: "Don't bring your own — hire on the beach for a few hundred taka. Visibility was good in the morning, worse after lunch." },
];

// Documents held against demo accounts, so the expiry-notification sweep and
// the Documents page have something to show.
export const documents = [
  { user_email: "moontashir@tourgenie.ai", type: "passport", title: "Passport — Moontashir Azim", expiry_offset_days: 420, document_number: "BW0••••••", issued_by: "Department of Immigration & Passports", days_ago: 200 },
  { user_email: "moontashir@tourgenie.ai", type: "id", title: "National ID", expiry_offset_days: null, days_ago: 200 },
  { user_email: "sadman@tourgenie.ai", type: "passport", title: "Passport — Quazi Md Sadman", expiry_offset_days: 75, document_number: "BX1••••••", issued_by: "Department of Immigration & Passports", days_ago: 195 },
  { user_email: "sadman@tourgenie.ai", type: "id", title: "National ID", expiry_offset_days: null, days_ago: 195 },
  { user_email: "sadia@example.com", type: "passport", title: "Passport — Sadia Afrin", expiry_offset_days: 25, document_number: "BY2••••••", issued_by: "Department of Immigration & Passports", days_ago: 70 },
  { user_email: "sadia@example.com", type: "visa", title: "Thailand Tourist Visa", expiry_offset_days: 180, days_ago: 55 },
  { user_email: "sadia@example.com", type: "insurance", title: "Travel Insurance — Green Delta", expiry_offset_days: 300, days_ago: 52 },
  { user_email: "farhana@example.com", type: "ticket", title: "Cox's Bazar coach ticket", expiry_offset_days: null, days_ago: 12 },
  { user_email: "arif@example.com", type: "passport", title: "Passport — Arif Chowdhury", expiry_offset_days: 900, days_ago: 25 },
];

export default { users, trips, communityPosts, reviews, documents, DEMO_PASSWORD, ADMIN_PASSWORD };
