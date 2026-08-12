// FR-04 — curated day-by-day plans.
//
// The planner scores these against the trip's destination, duration, budget
// tier and interests, picks the best match, stretches or trims it to the
// actual day count, and writes ItineraryItem rows. `attraction_slug` is
// resolved to a real Attraction._id at generation time.
//
// est_cost is BDT per traveller. Items marked is_optional are the first to
// drop on a relaxed pace; weather_dependent items are what the "what if it
// rains?" intent swaps out.

export const itineraryTemplates = [
  // ══════════════════════════ Cox's Bazar ══════════════════════════
  {
    code: "coxs-bazar-3d-mid",
    destination_slug: "coxs-bazar",
    title: "Cox's Bazar in 3 days — beaches and Marine Drive",
    summary: "The standard first visit: town beaches on arrival, the Marine Drive run south on day two, and the Burmese Market before departure.",
    duration_days: 3, pace: "balanced", budget_tier: "mid",
    interests: ["beach", "photography", "family", "relaxation"],
    suitable_for: ["family", "couple", "friends"],
    est_total_cost_per_person: 8400, popularity: 95,
    days: [
      { day: 1, theme: "Arrival and the first sunset", items: [
        { time: "07:00", activity: "Depart Dhaka by AC coach", location: "Rajarbagh Counter, Dhaka", est_cost: 1800, duration_min: 600, category: "travel", tags: ["transit"] },
        { time: "17:00", activity: "Check in and freshen up", location: "Kolatoli hotel zone", est_cost: 0, duration_min: 60, category: "checkin" },
        { time: "18:00", activity: "Sunset walk on Laboni Beach", location: "Laboni Point", attraction_slug: "laboni-beach", est_cost: 0, duration_min: 90, category: "sightseeing", tags: ["sunset", "free"] },
        { time: "20:00", activity: "Seafood dinner — grilled rupchanda and prawn", location: "Sugandha Point food stalls", attraction_slug: "sugandha-beach", est_cost: 700, duration_min: 75, category: "meal", tags: ["seafood"] },
      ]},
      { day: 2, theme: "Marine Drive south", items: [
        { time: "08:00", activity: "Breakfast at the hotel", location: "Hotel restaurant", est_cost: 250, duration_min: 45, category: "meal" },
        { time: "09:00", activity: "Drive south along Marine Drive", location: "Marine Drive", attraction_slug: "marine-drive", est_cost: 300, duration_min: 60, category: "travel", tags: ["scenic"] },
        { time: "10:00", activity: "Himchari National Park and the waterfall viewpoint", location: "Himchari", attraction_slug: "himchari-national-park", est_cost: 100, duration_min: 120, category: "sightseeing", weather_dependent: true },
        { time: "12:30", activity: "Continue to Inani Beach", location: "Inani, Ukhia", attraction_slug: "inani-beach", est_cost: 200, duration_min: 150, category: "sightseeing", tags: ["beach", "coral"] },
        { time: "15:30", activity: "Lunch at a Marine Drive restaurant", location: "Pechar Dwip", est_cost: 500, duration_min: 60, category: "meal" },
        { time: "18:30", activity: "Return to town, evening free", location: "Kolatoli", est_cost: 200, duration_min: 60, category: "rest" },
        { time: "20:30", activity: "Dinner", location: "Kolatoli Main Road", est_cost: 600, duration_min: 60, category: "meal" },
      ]},
      { day: 3, theme: "Market and departure", items: [
        { time: "07:00", activity: "Early morning beach walk", location: "Sugandha Beach", attraction_slug: "sugandha-beach", est_cost: 0, duration_min: 60, category: "sightseeing", tags: ["free", "quiet"] },
        { time: "09:00", activity: "Breakfast and checkout", location: "Hotel", est_cost: 250, duration_min: 90, category: "checkout" },
        { time: "11:00", activity: "Shopping at the Burmese Market", location: "Main Road", attraction_slug: "burmese-market", est_cost: 800, duration_min: 90, category: "shopping", is_optional: true },
        { time: "13:00", activity: "Lunch before departure", location: "Kolatoli", est_cost: 450, duration_min: 60, category: "meal" },
        { time: "15:00", activity: "Return coach to Dhaka", location: "Cox's Bazar counter", est_cost: 1800, duration_min: 600, category: "travel", tags: ["transit"] },
      ]},
    ],
  },
  {
    code: "coxs-bazar-4d-relaxed",
    destination_slug: "coxs-bazar",
    title: "Cox's Bazar in 4 days — slow beach trip",
    summary: "An unhurried version with a full day at Inani, a monastery morning, and no early starts.",
    duration_days: 4, pace: "relaxed", budget_tier: "mid",
    interests: ["beach", "relaxation", "family", "food"],
    suitable_for: ["family", "couple"],
    est_total_cost_per_person: 11200, popularity: 88,
    days: [
      { day: 1, theme: "Arrival", items: [
        { time: "06:15", activity: "Depart Dhaka on the Cox's Bazar Express", location: "Kamalapur Railway Station", est_cost: 1725, duration_min: 525, category: "travel", tags: ["train"] },
        { time: "16:00", activity: "Check in and rest", location: "Kolatoli hotel zone", est_cost: 0, duration_min: 90, category: "checkin" },
        { time: "18:00", activity: "Sunset at Laboni Beach", location: "Laboni Point", attraction_slug: "laboni-beach", est_cost: 0, duration_min: 90, category: "sightseeing" },
        { time: "20:30", activity: "Dinner", location: "Kolatoli", est_cost: 650, duration_min: 75, category: "meal" },
      ]},
      { day: 2, theme: "Town and monastery", items: [
        { time: "09:00", activity: "Late breakfast", location: "Hotel", est_cost: 250, duration_min: 60, category: "meal" },
        { time: "10:30", activity: "Aggmeda Khyang Buddhist monastery", location: "Tekpara", attraction_slug: "aggmeda-khyang", est_cost: 50, duration_min: 60, category: "sightseeing" },
        { time: "13:00", activity: "Lunch", location: "Town centre", est_cost: 450, duration_min: 60, category: "meal" },
        { time: "15:30", activity: "Beach time and swimming", location: "Sugandha Beach", attraction_slug: "sugandha-beach", est_cost: 0, duration_min: 150, category: "activity" },
        { time: "20:00", activity: "Seafood dinner", location: "Sugandha Point", est_cost: 750, duration_min: 90, category: "meal" },
      ]},
      { day: 3, theme: "Inani and Marine Drive", items: [
        { time: "09:00", activity: "Breakfast", location: "Hotel", est_cost: 250, duration_min: 45, category: "meal" },
        { time: "10:00", activity: "Marine Drive to Inani, stopping at viewpoints", location: "Marine Drive", attraction_slug: "marine-drive", est_cost: 400, duration_min: 90, category: "travel", tags: ["scenic"] },
        { time: "11:30", activity: "Inani Beach — coral boulders and swimming", location: "Inani", attraction_slug: "inani-beach", est_cost: 0, duration_min: 210, category: "activity" },
        { time: "15:00", activity: "Late lunch at Mermaid Café", location: "Pechar Dwip", est_cost: 900, duration_min: 90, category: "meal", is_optional: true },
        { time: "18:00", activity: "Sunset drive back to town", location: "Marine Drive", est_cost: 300, duration_min: 75, category: "travel" },
        { time: "20:30", activity: "Dinner", location: "Kolatoli", est_cost: 650, duration_min: 75, category: "meal" },
      ]},
      { day: 4, theme: "Market and return", items: [
        { time: "08:30", activity: "Breakfast and checkout", location: "Hotel", est_cost: 250, duration_min: 90, category: "checkout" },
        { time: "10:30", activity: "Burmese Market", location: "Main Road", attraction_slug: "burmese-market", est_cost: 1000, duration_min: 120, category: "shopping" },
        { time: "13:00", activity: "Farewell lunch", location: "Town centre", est_cost: 500, duration_min: 75, category: "meal" },
        { time: "15:30", activity: "Return train to Dhaka", location: "Cox's Bazar Iconic Station", est_cost: 1725, duration_min: 525, category: "travel" },
      ]},
    ],
  },
  {
    code: "coxs-bazar-3d-budget",
    destination_slug: "coxs-bazar",
    title: "Cox's Bazar in 3 days on a budget",
    summary: "Overnight non-AC coach, budget rooms near Sugandha, and the free beaches — the trip most students actually take.",
    duration_days: 3, pace: "balanced", budget_tier: "budget",
    interests: ["beach", "food"],
    suitable_for: ["friends", "solo"],
    est_total_cost_per_person: 4600, popularity: 84,
    days: [
      { day: 1, theme: "Arrive and hit the beach", items: [
        { time: "20:00", activity: "Overnight coach from Dhaka (departed previous night)", location: "Saidabad Terminal", est_cost: 1000, duration_min: 630, category: "travel", tags: ["overnight", "budget"] },
        { time: "07:00", activity: "Arrive, check in to a budget hotel", location: "Sugandha Point", est_cost: 0, duration_min: 60, category: "checkin" },
        { time: "09:00", activity: "Breakfast — paratha and dal", location: "Local eatery", est_cost: 80, duration_min: 30, category: "meal" },
        { time: "10:00", activity: "Laboni Beach", location: "Laboni Point", attraction_slug: "laboni-beach", est_cost: 0, duration_min: 180, category: "activity", tags: ["free"] },
        { time: "14:00", activity: "Lunch at a local rice hotel", location: "Kolatoli Road", est_cost: 150, duration_min: 45, category: "meal" },
        { time: "17:30", activity: "Sunset at Sugandha Beach", location: "Sugandha Point", attraction_slug: "sugandha-beach", est_cost: 0, duration_min: 90, category: "sightseeing", tags: ["free"] },
        { time: "20:00", activity: "Street-stall grilled fish dinner", location: "Sugandha food stalls", est_cost: 250, duration_min: 60, category: "meal" },
      ]},
      { day: 2, theme: "Inani by local transport", items: [
        { time: "08:00", activity: "Breakfast", location: "Local eatery", est_cost: 80, duration_min: 30, category: "meal" },
        { time: "09:00", activity: "Shared jeep down Marine Drive to Inani", location: "Kolatoli stand", est_cost: 150, duration_min: 75, category: "travel", tags: ["shared", "budget"] },
        { time: "10:30", activity: "Inani Beach", location: "Inani", attraction_slug: "inani-beach", est_cost: 0, duration_min: 210, category: "activity", tags: ["free"] },
        { time: "14:30", activity: "Lunch at a beach stall", location: "Inani", est_cost: 180, duration_min: 45, category: "meal" },
        { time: "16:00", activity: "Shared jeep back, stopping at Himchari gate", location: "Marine Drive", attraction_slug: "himchari-national-park", est_cost: 250, duration_min: 120, category: "sightseeing", is_optional: true, weather_dependent: true },
        { time: "20:00", activity: "Dinner", location: "Kolatoli Road", est_cost: 200, duration_min: 45, category: "meal" },
      ]},
      { day: 3, theme: "Market and the night coach home", items: [
        { time: "07:00", activity: "Sunrise beach walk", location: "Laboni Beach", est_cost: 0, duration_min: 75, category: "sightseeing", tags: ["free"] },
        { time: "09:00", activity: "Breakfast and checkout", location: "Hotel", est_cost: 80, duration_min: 60, category: "checkout" },
        { time: "11:00", activity: "Burmese Market — dried fish and souvenirs", location: "Main Road", attraction_slug: "burmese-market", est_cost: 400, duration_min: 120, category: "shopping" },
        { time: "14:00", activity: "Lunch", location: "Town centre", est_cost: 180, duration_min: 45, category: "meal" },
        { time: "20:00", activity: "Overnight coach back to Dhaka", location: "Cox's Bazar Bus Terminal", est_cost: 1000, duration_min: 630, category: "travel", tags: ["overnight"] },
      ]},
    ],
  },

  // ══════════════════════════ Sajek Valley ══════════════════════════
  {
    code: "sajek-3d-balanced",
    destination_slug: "sajek-valley",
    title: "Sajek Valley in 3 days — cloud sea and Konglak",
    summary: "Built around the convoy times, which govern this trip more than anything else. Dawn on Konglak Hill is the reason to come.",
    duration_days: 3, pace: "balanced", budget_tier: "mid",
    interests: ["hills", "photography", "adventure", "culture"],
    suitable_for: ["couple", "friends", "solo"],
    est_total_cost_per_person: 9200, popularity: 93,
    days: [
      { day: 1, theme: "Dhaka to the ridge", items: [
        { time: "22:00", activity: "Overnight coach from Dhaka to Khagrachari (departed previous night)", location: "Saidabad Terminal", est_cost: 1000, duration_min: 510, category: "travel", tags: ["overnight"] },
        { time: "07:00", activity: "Arrive Khagrachari, breakfast", location: "Shapla Chattar", est_cost: 150, duration_min: 60, category: "meal" },
        { time: "08:30", activity: "Reserve a chander gari (jeep) to Sajek", location: "Khagrachari stand", est_cost: 800, duration_min: 60, category: "travel", tags: ["shared-cost"] },
        { time: "10:30", activity: "Join the escorted convoy at Dighinala", location: "Dighinala", attraction_slug: "sajek-convoy-point", est_cost: 0, duration_min: 120, category: "travel", tags: ["convoy", "fixed-time"] },
        { time: "13:00", activity: "Arrive Sajek, check in to a valley-view cottage", location: "Ruilui Para", est_cost: 0, duration_min: 60, category: "checkin" },
        { time: "14:30", activity: "Late lunch — bamboo chicken", location: "Ruilui Para", est_cost: 350, duration_min: 60, category: "meal", tags: ["local-speciality"] },
        { time: "16:30", activity: "Walk through Ruilui Para village", location: "Ruilui Para", attraction_slug: "ruilui-para", est_cost: 0, duration_min: 90, category: "sightseeing", tags: ["culture", "free"] },
        { time: "18:00", activity: "Sunset from the helipad viewpoint", location: "Sajek Helipad", attraction_slug: "sajek-helipad", est_cost: 0, duration_min: 60, category: "sightseeing", weather_dependent: true },
        { time: "20:00", activity: "Dinner and a bonfire", location: "Resort", est_cost: 400, duration_min: 90, category: "meal" },
      ]},
      { day: 2, theme: "Konglak at dawn", items: [
        { time: "05:00", activity: "Walk up Konglak Hill for the cloud sea", location: "Konglak Para", attraction_slug: "konglak-hill", est_cost: 0, duration_min: 150, category: "sightseeing", tags: ["sunrise", "the-reason-you-came"], weather_dependent: true },
        { time: "08:30", activity: "Breakfast back at the resort", location: "Ruilui Para", est_cost: 200, duration_min: 60, category: "meal" },
        { time: "10:00", activity: "Trek down to Kamalak waterfall with a guide", location: "Near Ruilui", attraction_slug: "kamalak-waterfall", est_cost: 500, duration_min: 240, category: "activity", tags: ["trekking", "guide-required"], is_optional: true, weather_dependent: true },
        { time: "14:30", activity: "Lunch", location: "Ruilui Para", est_cost: 300, duration_min: 60, category: "meal" },
        { time: "16:30", activity: "Rest, then the evening viewpoint again", location: "Sajek Helipad", est_cost: 0, duration_min: 120, category: "rest" },
        { time: "20:00", activity: "Dinner", location: "Resort", est_cost: 400, duration_min: 75, category: "meal" },
      ]},
      { day: 3, theme: "Down the hill and home", items: [
        { time: "05:30", activity: "Final sunrise from the cottage veranda", location: "Ruilui Para", est_cost: 0, duration_min: 60, category: "sightseeing", weather_dependent: true },
        { time: "07:30", activity: "Breakfast and checkout", location: "Resort", est_cost: 200, duration_min: 60, category: "checkout" },
        { time: "09:00", activity: "Descend with the morning convoy", location: "Sajek to Dighinala", est_cost: 800, duration_min: 150, category: "travel", tags: ["convoy", "fixed-time"] },
        { time: "12:00", activity: "Alutila Cave on the way through Khagrachari", location: "Alutila", attraction_slug: "alutila-cave", est_cost: 30, duration_min: 90, category: "sightseeing", is_optional: true },
        { time: "14:00", activity: "Lunch in Khagrachari", location: "Shapla Chattar", est_cost: 200, duration_min: 60, category: "meal" },
        { time: "20:00", activity: "Overnight coach back to Dhaka", location: "Khagrachari counter", est_cost: 1000, duration_min: 510, category: "travel", tags: ["overnight"] },
      ]},
    ],
  },

  // ══════════════════════════ Sundarbans ══════════════════════════
  {
    code: "sundarbans-3d-cruise",
    destination_slug: "sundarbans",
    title: "Sundarbans in 3 days — the standard cruise",
    summary: "A live-aboard package from Khulna. Almost everything is included in the fare, which is why the daily costs below look sparse.",
    duration_days: 3, pace: "balanced", budget_tier: "mid",
    interests: ["wildlife", "boating", "photography", "adventure"],
    suitable_for: ["family", "friends", "solo"],
    est_total_cost_per_person: 27500, popularity: 89,
    days: [
      { day: 1, theme: "Board and enter the forest", items: [
        { time: "08:15", activity: "Train from Dhaka to Khulna", location: "Kamalapur Railway Station", est_cost: 1100, duration_min: 565, category: "travel" },
        { time: "18:00", activity: "Board the vessel, safety briefing and dinner", location: "BIWTA Ghat, Khulna", est_cost: 8500, duration_min: 180, category: "checkin", tags: ["package-inclusive"] },
        { time: "21:00", activity: "Overnight sailing down the Rupsha and Pasur", location: "On board", est_cost: 0, duration_min: 480, category: "rest" },
      ]},
      { day: 2, theme: "Deep forest", items: [
        { time: "06:00", activity: "Dawn small-boat trip into the narrow creeks", location: "Forest channels", est_cost: 0, duration_min: 150, category: "activity", tags: ["wildlife", "package-inclusive"], weather_dependent: true },
        { time: "09:00", activity: "Breakfast on board", location: "On board", est_cost: 0, duration_min: 60, category: "meal", tags: ["package-inclusive"] },
        { time: "10:30", activity: "Harbaria Eco Park boardwalk and watchtower", location: "Chandpai Range", attraction_slug: "harbaria", est_cost: 150, duration_min: 120, category: "sightseeing" },
        { time: "14:00", activity: "Lunch and sailing towards Kotka", location: "On board", est_cost: 0, duration_min: 240, category: "meal", tags: ["package-inclusive"] },
        { time: "16:00", activity: "Kotka Beach — deer, tiger tracks and the forest edge", location: "Kotka", attraction_slug: "kotka-beach", est_cost: 0, duration_min: 180, category: "sightseeing", tags: ["wildlife", "permit-required"] },
        { time: "20:00", activity: "Dinner and a talk from the forest guide", location: "On board", est_cost: 0, duration_min: 120, category: "meal", tags: ["package-inclusive"] },
      ]},
      { day: 3, theme: "Karamjal and return", items: [
        { time: "06:30", activity: "Sunrise on deck", location: "On board", est_cost: 0, duration_min: 60, category: "sightseeing" },
        { time: "08:00", activity: "Breakfast", location: "On board", est_cost: 0, duration_min: 60, category: "meal", tags: ["package-inclusive"] },
        { time: "10:00", activity: "Karamjal Wildlife Centre — crocodiles, deer, mangrove boardwalk", location: "Karamjal, Mongla", attraction_slug: "karamjal", est_cost: 200, duration_min: 120, category: "sightseeing" },
        { time: "13:00", activity: "Lunch while sailing back to Khulna", location: "On board", est_cost: 0, duration_min: 90, category: "meal", tags: ["package-inclusive"] },
        { time: "17:00", activity: "Disembark at Khulna", location: "BIWTA Ghat", est_cost: 0, duration_min: 45, category: "checkout" },
        { time: "22:00", activity: "Overnight coach or train back to Dhaka", location: "Sonadanga Terminal", est_cost: 750, duration_min: 390, category: "travel", tags: ["overnight"] },
      ]},
    ],
  },

  // ══════════════════════════ Srimangal ══════════════════════════
  {
    code: "srimangal-2d-nature",
    destination_slug: "srimangal",
    title: "Srimangal in 2 days — tea and rainforest",
    summary: "The easiest nature trip in the country: morning train from Dhaka, gibbons in Lawachara, seven-layer tea, back the next evening.",
    duration_days: 2, pace: "balanced", budget_tier: "mid",
    interests: ["wildlife", "relaxation", "photography", "food", "trekking"],
    suitable_for: ["couple", "family", "solo", "friends"],
    est_total_cost_per_person: 4800, popularity: 90,
    days: [
      { day: 1, theme: "Arrive and walk the estates", items: [
        { time: "06:20", activity: "Parabat Express from Dhaka", location: "Kamalapur Railway Station", est_cost: 500, duration_min: 290, category: "travel", tags: ["train"] },
        { time: "11:30", activity: "Check in and lunch", location: "Srimangal town", est_cost: 350, duration_min: 90, category: "checkin" },
        { time: "14:00", activity: "Walk the tea estate roads", location: "Around Srimangal", attraction_slug: "tea-estates-srimangal", est_cost: 0, duration_min: 150, category: "sightseeing", tags: ["free", "photography"] },
        { time: "17:00", activity: "Seven-layer tea at Nilkantha Tea Cabin", location: "Ramnagar", attraction_slug: "nilkantha-tea-cabin", est_cost: 120, duration_min: 45, category: "activity", tags: ["local-speciality"] },
        { time: "19:30", activity: "Dinner — fish curry and local vegetables", location: "Station Road", est_cost: 400, duration_min: 75, category: "meal" },
      ]},
      { day: 2, theme: "Lawachara and home", items: [
        { time: "06:30", activity: "Early breakfast", location: "Hotel", est_cost: 150, duration_min: 45, category: "meal" },
        { time: "07:30", activity: "Lawachara National Park with a forest guide — best gibbon chances at dawn", location: "Kamalganj", attraction_slug: "lawachara", est_cost: 400, duration_min: 210, category: "activity", tags: ["wildlife", "trekking"], weather_dependent: true },
        { time: "11:30", activity: "Madhabpur Lake", location: "Kamalganj", attraction_slug: "madhabpur-lake", est_cost: 20, duration_min: 90, category: "sightseeing", is_optional: true },
        { time: "13:30", activity: "Lunch and checkout", location: "Srimangal town", est_cost: 400, duration_min: 90, category: "checkout" },
        { time: "16:00", activity: "Pick up tea from a local estate shop", location: "Srimangal town", est_cost: 500, duration_min: 45, category: "shopping", is_optional: true },
        { time: "18:00", activity: "Return train to Dhaka", location: "Srimangal Railway Station", est_cost: 500, duration_min: 290, category: "travel" },
      ]},
    ],
  },

  // ══════════════════════════ Sylhet ══════════════════════════
  {
    code: "sylhet-3d-nature",
    destination_slug: "sylhet",
    title: "Sylhet in 3 days — swamp forest, stones and shrines",
    summary: "Sylhet as a base: Ratargul by boat, Jaflong on the border, and the shrine in the city. Best October to February, when the water runs clear.",
    duration_days: 3, pace: "balanced", budget_tier: "mid",
    interests: ["waterfalls", "photography", "religious", "boating", "culture"],
    suitable_for: ["friends", "couple", "family"],
    est_total_cost_per_person: 7600, popularity: 86,
    days: [
      { day: 1, theme: "Arrival and the shrine", items: [
        { time: "06:20", activity: "Parabat Express from Dhaka", location: "Kamalapur Railway Station", est_cost: 680, duration_min: 400, category: "travel", tags: ["train"] },
        { time: "14:00", activity: "Check in and lunch", location: "Zindabazar", est_cost: 400, duration_min: 90, category: "checkin" },
        { time: "16:00", activity: "Hazrat Shahjalal Mazar Sharif", location: "Dargah Gate", attraction_slug: "shahjalal-shrine", est_cost: 0, duration_min: 75, category: "sightseeing", tags: ["free", "modest-dress"] },
        { time: "18:00", activity: "Walk Zindabazar and the evening market", location: "Zindabazar", est_cost: 200, duration_min: 90, category: "shopping", is_optional: true },
        { time: "20:00", activity: "Dinner — Sylheti satkora beef at Panshi", location: "Jallarpar Road", est_cost: 450, duration_min: 75, category: "meal", tags: ["local-speciality"] },
      ]},
      { day: 2, theme: "Ratargul and Bisnakandi", items: [
        { time: "07:00", activity: "Breakfast and reserve a CNG for the day", location: "Hotel", est_cost: 200, duration_min: 45, category: "meal" },
        { time: "08:00", activity: "Drive to Ratargul Swamp Forest", location: "Gowainghat", est_cost: 600, duration_min: 90, category: "travel" },
        { time: "09:30", activity: "Country-boat paddle through the swamp forest", location: "Ratargul", attraction_slug: "ratargul", est_cost: 400, duration_min: 150, category: "activity", tags: ["boat", "seasonal"], weather_dependent: true },
        { time: "12:30", activity: "Continue to Bisnakandi", location: "Gowainghat", est_cost: 500, duration_min: 90, category: "travel" },
        { time: "14:00", activity: "Bisnakandi — stone bed under the Meghalaya hills", location: "Bisnakandi", attraction_slug: "bisnakandi", est_cost: 0, duration_min: 180, category: "sightseeing", weather_dependent: true },
        { time: "19:00", activity: "Return to Sylhet and dinner", location: "Zindabazar", est_cost: 450, duration_min: 90, category: "meal" },
      ]},
      { day: 3, theme: "Jaflong and departure", items: [
        { time: "07:30", activity: "Breakfast and checkout", location: "Hotel", est_cost: 200, duration_min: 60, category: "checkout" },
        { time: "08:30", activity: "Drive to Jaflong", location: "Sylhet–Tamabil Highway", est_cost: 400, duration_min: 105, category: "travel", tags: ["scenic"] },
        { time: "10:30", activity: "Jaflong Zero Point — the Piyain riverbed", location: "Gowainghat", attraction_slug: "jaflong-zero-point", est_cost: 0, duration_min: 180, category: "sightseeing", weather_dependent: true },
        { time: "13:30", activity: "Sangrampunji waterfall and the Khasi village", location: "Sangrampunji", attraction_slug: "sangrampunji-waterfall", est_cost: 0, duration_min: 90, category: "sightseeing", is_optional: true, weather_dependent: true },
        { time: "15:30", activity: "Lunch on the way back", location: "Gowainghat road", est_cost: 350, duration_min: 60, category: "meal" },
        { time: "22:00", activity: "Overnight coach or train to Dhaka", location: "Kadamtoli, Sylhet", est_cost: 950, duration_min: 405, category: "travel", tags: ["overnight"] },
      ]},
    ],
  },

  // ══════════════════════════ Bandarban ══════════════════════════
  {
    code: "bandarban-4d-adventure",
    destination_slug: "bandarban",
    title: "Bandarban in 4 days — Nilgiri, Boga Lake and the hills",
    summary: "The serious hill trip. Some sections need a guide and permission arranged in advance — that is not optional here.",
    duration_days: 4, pace: "packed", budget_tier: "mid",
    interests: ["hills", "trekking", "adventure", "waterfalls", "photography"],
    suitable_for: ["friends", "solo"],
    est_total_cost_per_person: 12800, popularity: 87,
    days: [
      { day: 1, theme: "Arrive and the golden temple", items: [
        { time: "21:30", activity: "Overnight coach from Dhaka (departed previous night)", location: "Kalabagan Counter", est_cost: 1100, duration_min: 510, category: "travel", tags: ["overnight"] },
        { time: "07:00", activity: "Arrive Bandarban, check in and breakfast", location: "Bandarban town", est_cost: 200, duration_min: 120, category: "checkin" },
        { time: "10:00", activity: "Buddha Dhatu Jadi — the Golden Temple", location: "Balaghata", attraction_slug: "golden-temple-bandarban", est_cost: 20, duration_min: 90, category: "sightseeing" },
        { time: "13:00", activity: "Lunch", location: "Bandarban town", est_cost: 300, duration_min: 60, category: "meal" },
        { time: "15:00", activity: "Meghla tourist complex and hanging bridge", location: "Meghla", est_cost: 50, duration_min: 120, category: "sightseeing", is_optional: true },
        { time: "19:30", activity: "Dinner and arrange the next day's jeep and guide", location: "Bandarban town", est_cost: 350, duration_min: 90, category: "meal" },
      ]},
      { day: 2, theme: "Chimbuk and Nilgiri", items: [
        { time: "07:00", activity: "Breakfast and depart by chander gari", location: "Bandarban town", est_cost: 1200, duration_min: 60, category: "travel", tags: ["shared-cost"] },
        { time: "09:00", activity: "Chimbuk Hill viewpoint", location: "Chimbuk Road", attraction_slug: "chimbuk-hill", est_cost: 0, duration_min: 60, category: "sightseeing", tags: ["free"] },
        { time: "11:00", activity: "Nilgiri — above the cloud line on a clear morning", location: "Thanchi Road", attraction_slug: "nilgiri", est_cost: 50, duration_min: 150, category: "sightseeing", weather_dependent: true },
        { time: "14:30", activity: "Lunch at the Nilgiri complex", location: "Nilgiri", est_cost: 400, duration_min: 60, category: "meal" },
        { time: "17:00", activity: "Return to town for the night", location: "Bandarban town", est_cost: 0, duration_min: 120, category: "travel" },
        { time: "20:00", activity: "Dinner", location: "Bandarban town", est_cost: 350, duration_min: 75, category: "meal" },
      ]},
      { day: 3, theme: "Ruma and Boga Lake", items: [
        { time: "06:00", activity: "Register with the district office and travel to Ruma Bazar", location: "Ruma", est_cost: 400, duration_min: 150, category: "travel", tags: ["permit-required"] },
        { time: "09:30", activity: "Guide and jeep to Boga Lake", location: "Ruma to Boga", est_cost: 1500, duration_min: 180, category: "travel", tags: ["guide-required", "shared-cost"] },
        { time: "13:00", activity: "Boga Lake — the crater lake and the village", location: "Boga Lake", attraction_slug: "boga-lake", est_cost: 0, duration_min: 240, category: "activity", tags: ["trekking"] },
        { time: "18:00", activity: "Overnight in a Boga Lake guesthouse, dinner cooked by the host", location: "Boga Lake", est_cost: 800, duration_min: 180, category: "checkin", tags: ["basic-accommodation"] },
      ]},
      { day: 4, theme: "Down and out", items: [
        { time: "06:00", activity: "Sunrise over the lake", location: "Boga Lake", est_cost: 0, duration_min: 90, category: "sightseeing", weather_dependent: true },
        { time: "08:00", activity: "Breakfast and descend to Ruma", location: "Boga to Ruma", est_cost: 1500, duration_min: 210, category: "travel" },
        { time: "12:30", activity: "Return to Bandarban town, lunch", location: "Bandarban town", est_cost: 700, duration_min: 150, category: "meal" },
        { time: "16:00", activity: "Buy hill-tract handloom before leaving", location: "Bandarban market", est_cost: 600, duration_min: 60, category: "shopping", is_optional: true },
        { time: "20:00", activity: "Overnight coach back to Dhaka", location: "Bandarban Bus Terminal", est_cost: 1100, duration_min: 510, category: "travel", tags: ["overnight"] },
      ]},
    ],
  },

  // ══════════════════════════ Rangamati ══════════════════════════
  {
    code: "rangamati-3d-lake",
    destination_slug: "rangamati",
    title: "Rangamati in 3 days — Kaptai Lake by boat",
    summary: "Most of this trip happens on the water. Reserve a boat for a full day and the whole lake opens up.",
    duration_days: 3, pace: "relaxed", budget_tier: "mid",
    interests: ["boating", "hills", "culture", "family", "photography"],
    suitable_for: ["family", "couple", "friends"],
    est_total_cost_per_person: 8100, popularity: 80,
    days: [
      { day: 1, theme: "Arrive at the lake", items: [
        { time: "22:15", activity: "Overnight coach from Dhaka (departed previous night)", location: "Arambagh Counter", est_cost: 1050, duration_min: 525, category: "travel", tags: ["overnight"] },
        { time: "07:30", activity: "Arrive, check in and breakfast", location: "Rangamati town", est_cost: 200, duration_min: 120, category: "checkin" },
        { time: "10:30", activity: "Rangamati Hanging Bridge", location: "Rangamati Park", attraction_slug: "hanging-bridge", est_cost: 20, duration_min: 60, category: "sightseeing" },
        { time: "13:00", activity: "Lunch", location: "Rangamati town", est_cost: 350, duration_min: 60, category: "meal" },
        { time: "15:30", activity: "Chakma Rajbari and Rajbana Vihara", location: "Rajbari Road", attraction_slug: "chakma-rajbari", est_cost: 0, duration_min: 90, category: "sightseeing", tags: ["culture", "free"] },
        { time: "19:30", activity: "Dinner", location: "Rangamati town", est_cost: 350, duration_min: 75, category: "meal" },
      ]},
      { day: 2, theme: "A full day on Kaptai Lake", items: [
        { time: "08:00", activity: "Breakfast and reserve a boat for the day", location: "Town jetty", est_cost: 200, duration_min: 60, category: "meal" },
        { time: "09:00", activity: "Cross Kaptai Lake by reserved boat", location: "Kaptai Lake", attraction_slug: "kaptai-lake", est_cost: 900, duration_min: 120, category: "travel", tags: ["boat", "shared-cost"] },
        { time: "11:00", activity: "Shuvolong Waterfall", location: "Barkal", attraction_slug: "shuvolong", est_cost: 20, duration_min: 90, category: "sightseeing", weather_dependent: true },
        { time: "13:00", activity: "Lunch at Peda Ting Ting — Chakma cuisine on an island", location: "Kaptai Lake island", est_cost: 500, duration_min: 90, category: "meal", tags: ["indigenous-cuisine", "boat-access"] },
        { time: "15:00", activity: "Continue around the lake, stopping at the smaller islands", location: "Kaptai Lake", est_cost: 0, duration_min: 180, category: "activity" },
        { time: "20:00", activity: "Dinner", location: "Rangamati town", est_cost: 350, duration_min: 75, category: "meal" },
      ]},
      { day: 3, theme: "Market and return", items: [
        { time: "08:30", activity: "Breakfast and checkout", location: "Hotel", est_cost: 200, duration_min: 90, category: "checkout" },
        { time: "10:30", activity: "Tribal handloom market", location: "Rangamati town", est_cost: 700, duration_min: 90, category: "shopping", is_optional: true },
        { time: "13:00", activity: "Lunch", location: "Rangamati town", est_cost: 350, duration_min: 60, category: "meal" },
        { time: "20:00", activity: "Overnight coach back to Dhaka", location: "Rangamati Bus Terminal", est_cost: 1050, duration_min: 525, category: "travel", tags: ["overnight"] },
      ]},
    ],
  },

  // ══════════════════════════ Dhaka ══════════════════════════
  {
    code: "dhaka-2d-heritage",
    destination_slug: "dhaka",
    title: "Dhaka in 2 days — Mughal city and modern landmarks",
    summary: "Old Dhaka on foot in the morning, the modern city in the afternoon. Build generous buffers between stops — traffic, not distance, sets the pace.",
    duration_days: 2, pace: "balanced", budget_tier: "mid",
    interests: ["history", "culture", "food", "religious", "photography", "shopping"],
    suitable_for: ["solo", "couple", "friends", "family"],
    est_total_cost_per_person: 4200, popularity: 82,
    days: [
      { day: 1, theme: "Old Dhaka", items: [
        { time: "08:00", activity: "Breakfast — paratha, dal and tea", location: "Old Dhaka", est_cost: 150, duration_min: 45, category: "meal" },
        { time: "09:30", activity: "Lalbagh Fort", location: "Lalbagh Road", attraction_slug: "lalbagh-fort", est_cost: 20, duration_min: 120, category: "sightseeing", tags: ["mughal"] },
        { time: "12:00", activity: "Star Mosque — the chinitikri mosaic", location: "Armanitola", attraction_slug: "star-mosque", est_cost: 0, duration_min: 45, category: "sightseeing", tags: ["free"] },
        { time: "13:30", activity: "Lunch at Haji Biryani", location: "Nazira Bazar", est_cost: 200, duration_min: 60, category: "meal", tags: ["local-institution", "cash-only"] },
        { time: "15:00", activity: "Ahsan Manzil, the Pink Palace", location: "Islampur", attraction_slug: "ahsan-manzil", est_cost: 20, duration_min: 90, category: "sightseeing" },
        { time: "17:00", activity: "Sadarghat launch terminal at rush hour", location: "Sadarghat", est_cost: 0, duration_min: 60, category: "sightseeing", tags: ["free", "photography"], is_optional: true },
        { time: "19:30", activity: "Dinner — kebab at Star", location: "Dhanmondi", est_cost: 500, duration_min: 75, category: "meal" },
      ]},
      { day: 2, theme: "Modern Dhaka", items: [
        { time: "09:00", activity: "Breakfast", location: "Hotel", est_cost: 250, duration_min: 45, category: "meal" },
        { time: "10:30", activity: "Liberation War Museum", location: "Agargaon", attraction_slug: "liberation-war-museum", est_cost: 100, duration_min: 120, category: "sightseeing", tags: ["indoor", "1971"] },
        { time: "13:30", activity: "Lunch", location: "Dhanmondi", est_cost: 400, duration_min: 60, category: "meal" },
        { time: "15:00", activity: "Dhakeshwari National Temple", location: "Bakshi Bazar", attraction_slug: "dhakeshwari-temple", est_cost: 0, duration_min: 45, category: "sightseeing", tags: ["free"], is_optional: true },
        { time: "16:30", activity: "Jatiya Sangsad Bhaban — Louis Kahn's parliament", location: "Sher-e-Bangla Nagar", attraction_slug: "national-parliament", est_cost: 0, duration_min: 75, category: "sightseeing", tags: ["architecture", "free"] },
        { time: "18:30", activity: "Shopping at New Market or Jamuna Future Park", location: "New Market / Bashundhara", est_cost: 1200, duration_min: 120, category: "shopping", is_optional: true },
        { time: "21:00", activity: "Dinner", location: "Gulshan", est_cost: 700, duration_min: 90, category: "meal" },
      ]},
    ],
  },

  // ══════════════════════════ Saint Martin's ══════════════════════════
  {
    code: "saint-martins-3d-island",
    destination_slug: "saint-martins",
    title: "Saint Martin's in 3 days — the coral island",
    summary: "Ferry season is roughly November to March only, and overnight stays are now capped. Check the current season rules before you commit to dates.",
    duration_days: 3, pace: "relaxed", budget_tier: "mid",
    interests: ["beach", "adventure", "relaxation", "photography", "food"],
    suitable_for: ["couple", "friends", "family"],
    est_total_cost_per_person: 13500, popularity: 91,
    days: [
      { day: 1, theme: "Cox's Bazar to the island", items: [
        { time: "06:30", activity: "Marine Drive bus from Cox's Bazar to Teknaf", location: "Kolatoli", est_cost: 200, duration_min: 120, category: "travel", tags: ["scenic"] },
        { time: "09:30", activity: "Ferry from Teknaf to Saint Martin's", location: "Teknaf Jetty", est_cost: 1200, duration_min: 150, category: "travel", tags: ["seasonal", "booking-required"] },
        { time: "12:30", activity: "Check in to a beachfront cottage", location: "West Beach", est_cost: 0, duration_min: 60, category: "checkin" },
        { time: "14:00", activity: "Lunch — grilled coral fish", location: "West Beach", est_cost: 600, duration_min: 75, category: "meal", tags: ["seafood"] },
        { time: "16:00", activity: "Walk the west shore to the jetty and back", location: "West Beach", attraction_slug: "saint-martins-west-beach", est_cost: 0, duration_min: 120, category: "sightseeing", tags: ["free", "sunset"] },
        { time: "20:00", activity: "Barbecue dinner on the beach", location: "West Beach", est_cost: 700, duration_min: 90, category: "meal" },
      ]},
      { day: 2, theme: "Chera Dwip and the reef", items: [
        { time: "07:30", activity: "Breakfast", location: "Resort", est_cost: 250, duration_min: 45, category: "meal" },
        { time: "09:00", activity: "Boat or low-tide walk to Chera Dwip", location: "South Saint Martin's", attraction_slug: "chera-dwip", est_cost: 400, duration_min: 210, category: "activity", tags: ["tidal", "check-timing"], weather_dependent: true },
        { time: "13:00", activity: "Lunch back at the resort", location: "West Beach", est_cost: 550, duration_min: 75, category: "meal" },
        { time: "15:00", activity: "Snorkelling over the reef edge", location: "West Beach reef", attraction_slug: "saint-martins-coral-reef", est_cost: 500, duration_min: 150, category: "activity", tags: ["snorkelling"], weather_dependent: true },
        { time: "18:00", activity: "Sunset and the night sky — no light pollution here", location: "West Beach", est_cost: 0, duration_min: 120, category: "sightseeing", tags: ["free"] },
        { time: "20:30", activity: "Dinner", location: "West Beach", est_cost: 650, duration_min: 90, category: "meal" },
      ]},
      { day: 3, theme: "Ferry back", items: [
        { time: "06:30", activity: "Sunrise walk on the east shore", location: "East Beach", est_cost: 0, duration_min: 90, category: "sightseeing", tags: ["free"] },
        { time: "08:30", activity: "Breakfast and checkout", location: "Resort", est_cost: 250, duration_min: 90, category: "checkout" },
        { time: "10:30", activity: "Buy dried fish and coconut before the ferry", location: "Jetty market", est_cost: 400, duration_min: 60, category: "shopping", is_optional: true },
        { time: "15:00", activity: "Ferry back to Teknaf", location: "Saint Martin's Jetty", est_cost: 1200, duration_min: 150, category: "travel", tags: ["fixed-time"] },
        { time: "18:00", activity: "Bus back to Cox's Bazar", location: "Teknaf", est_cost: 200, duration_min: 120, category: "travel" },
      ]},
    ],
  },

  // ══════════════════════════ Kuakata ══════════════════════════
  {
    code: "kuakata-2d-beach",
    destination_slug: "kuakata",
    title: "Kuakata in 2 days — sunrise and sunset from one beach",
    summary: "The only beach in the country where you can watch both from the same stretch of sand. Quieter and cheaper than Cox's Bazar.",
    duration_days: 2, pace: "relaxed", budget_tier: "budget",
    interests: ["beach", "relaxation", "photography", "culture"],
    suitable_for: ["couple", "family", "friends"],
    est_total_cost_per_person: 4400, popularity: 76,
    days: [
      { day: 1, theme: "Arrive for the sunset", items: [
        { time: "08:00", activity: "AC coach from Dhaka via the Padma Bridge", location: "Gabtoli Terminal", est_cost: 900, duration_min: 420, category: "travel" },
        { time: "15:30", activity: "Check in", location: "Kuakata Beach Road", est_cost: 0, duration_min: 60, category: "checkin" },
        { time: "16:30", activity: "Rakhine village and the bronze Buddha", location: "Keranipara", attraction_slug: "rakhine-village-kuakata", est_cost: 0, duration_min: 75, category: "sightseeing", tags: ["culture", "free"] },
        { time: "18:00", activity: "Sunset over the water", location: "Kuakata Beach", attraction_slug: "kuakata-beach", est_cost: 0, duration_min: 75, category: "sightseeing", tags: ["free"], weather_dependent: true },
        { time: "20:00", activity: "Dinner — fresh fish at the beach food court", location: "Beach Road", est_cost: 350, duration_min: 75, category: "meal" },
      ]},
      { day: 2, theme: "Sunrise and home", items: [
        { time: "05:15", activity: "Sunrise from the eastern end of the beach", location: "Gangamati end", attraction_slug: "kuakata-beach", est_cost: 0, duration_min: 90, category: "sightseeing", tags: ["free"], weather_dependent: true },
        { time: "07:00", activity: "Walk into Gangamati Reserved Forest", location: "East Kuakata", attraction_slug: "gangamati-forest", est_cost: 0, duration_min: 90, category: "sightseeing", tags: ["free"] },
        { time: "09:00", activity: "Breakfast and checkout", location: "Hotel", est_cost: 180, duration_min: 90, category: "checkout" },
        { time: "11:00", activity: "Beach time before departure", location: "Kuakata Beach", est_cost: 0, duration_min: 120, category: "activity" },
        { time: "13:30", activity: "Lunch", location: "Beach Road", est_cost: 300, duration_min: 60, category: "meal" },
        { time: "15:00", activity: "Coach back to Dhaka", location: "Kuakata Bus Stand", est_cost: 900, duration_min: 420, category: "travel" },
      ]},
    ],
  },

  // ══════════════════════════ Chattogram ══════════════════════════
  {
    code: "chattogram-2d-city",
    destination_slug: "chattogram",
    title: "Chattogram in 2 days — port city between hills and sea",
    summary: "Usually a stopover on the way south. Two days covers the lake, the beach and the war cemetery comfortably.",
    duration_days: 2, pace: "balanced", budget_tier: "mid",
    interests: ["city", "food", "history", "family", "photography"],
    suitable_for: ["family", "friends", "solo"],
    est_total_cost_per_person: 5200, popularity: 74,
    days: [
      { day: 1, theme: "Lake and hills", items: [
        { time: "07:00", activity: "Subarna Express from Dhaka", location: "Kamalapur Railway Station", est_cost: 725, duration_min: 320, category: "travel", tags: ["train"] },
        { time: "13:00", activity: "Check in and lunch — mezban beef", location: "GEC Circle", est_cost: 450, duration_min: 120, category: "checkin", tags: ["local-speciality"] },
        { time: "15:30", activity: "Foy's Lake", location: "Khulshi", attraction_slug: "foys-lake", est_cost: 300, duration_min: 180, category: "activity", tags: ["family"] },
        { time: "19:30", activity: "Dinner", location: "GEC Circle", est_cost: 500, duration_min: 75, category: "meal" },
      ]},
      { day: 2, theme: "Cemetery, shrine and sea", items: [
        { time: "08:30", activity: "Breakfast", location: "Hotel", est_cost: 250, duration_min: 45, category: "meal" },
        { time: "10:00", activity: "Chattogram War Cemetery", location: "Badshah Mia Road", attraction_slug: "chattogram-war-cemetery", est_cost: 0, duration_min: 60, category: "sightseeing", tags: ["free", "quiet"] },
        { time: "11:30", activity: "Bayezid Bostami shrine and the turtle pond", location: "Nasirabad", attraction_slug: "bayezid-bostami", est_cost: 0, duration_min: 60, category: "sightseeing", tags: ["free"], is_optional: true },
        { time: "13:30", activity: "Lunch and checkout", location: "Agrabad", est_cost: 450, duration_min: 120, category: "checkout" },
        { time: "16:30", activity: "Patenga Beach — sunset over the ships", location: "Patenga", attraction_slug: "patenga-beach", est_cost: 0, duration_min: 120, category: "sightseeing", tags: ["free", "sunset"] },
        { time: "22:00", activity: "Overnight coach or train back to Dhaka", location: "Chattogram", est_cost: 900, duration_min: 330, category: "travel", tags: ["overnight"] },
      ]},
    ],
  },

  // ══════════════════════════ International ══════════════════════════

  {
    code: "bangkok-4d-city",
    destination_slug: "bangkok",
    title: "Bangkok in 4 days — temples, markets and the river",
    summary: "Built around the BTS and the river boats, which is the only sane way to move around this city.",
    duration_days: 4, pace: "balanced", budget_tier: "mid",
    interests: ["city", "food", "shopping", "history", "religious", "nightlife"],
    suitable_for: ["couple", "friends", "family", "solo"],
    est_total_cost_per_person: 78000, popularity: 88,
    days: [
      { day: 1, theme: "Arrive and Siam", items: [
        { time: "23:45", activity: "Overnight flight from Dhaka (departed previous night)", location: "Hazrat Shahjalal International", est_cost: 39000, duration_min: 170, category: "travel", tags: ["international", "overnight"] },
        { time: "06:00", activity: "Arrive, visa on arrival and transfer to the hotel", location: "Suvarnabhumi Airport", est_cost: 2500, duration_min: 150, category: "travel" },
        { time: "12:00", activity: "Check in near a BTS station", location: "Siam", est_cost: 0, duration_min: 60, category: "checkin" },
        { time: "14:00", activity: "Lunch at a Siam food court", location: "Siam Paragon", est_cost: 900, duration_min: 75, category: "meal" },
        { time: "16:00", activity: "Shopping around Siam and Bukit Bintang-style malls", location: "Siam", est_cost: 4000, duration_min: 180, category: "shopping", is_optional: true },
        { time: "20:00", activity: "Street-food dinner", location: "Silom", est_cost: 800, duration_min: 90, category: "meal" },
      ]},
      { day: 2, theme: "The old city", items: [
        { time: "08:00", activity: "Breakfast", location: "Hotel", est_cost: 600, duration_min: 45, category: "meal" },
        { time: "09:30", activity: "Grand Palace and Wat Phra Kaew — covered shoulders and knees required", location: "Phra Nakhon", attraction_slug: "grand-palace", est_cost: 1750, duration_min: 180, category: "sightseeing", tags: ["dress-code"] },
        { time: "13:30", activity: "Lunch by the river", location: "Tha Tien", est_cost: 900, duration_min: 75, category: "meal" },
        { time: "15:30", activity: "Cross the river to Wat Arun", location: "Arun Amarin", attraction_slug: "wat-arun", est_cost: 320, duration_min: 120, category: "sightseeing" },
        { time: "18:00", activity: "Chao Phraya river boat at sunset", location: "Chao Phraya", est_cost: 400, duration_min: 90, category: "activity", tags: ["sunset"] },
        { time: "20:30", activity: "Dinner in Chinatown (Yaowarat)", location: "Yaowarat", est_cost: 1200, duration_min: 120, category: "meal", tags: ["street-food"] },
      ]},
      { day: 3, theme: "Markets", items: [
        { time: "08:00", activity: "Breakfast", location: "Hotel", est_cost: 600, duration_min: 45, category: "meal" },
        { time: "09:00", activity: "Chatuchak Weekend Market — go early, it gets brutal by noon", location: "Chatuchak", attraction_slug: "chatuchak", est_cost: 0, duration_min: 210, category: "shopping", tags: ["weekend-only"] },
        { time: "13:00", activity: "Lunch at the market", location: "Chatuchak", est_cost: 700, duration_min: 60, category: "meal" },
        { time: "16:00", activity: "Rest at the hotel", location: "Siam", est_cost: 0, duration_min: 120, category: "rest" },
        { time: "19:00", activity: "Rooftop bar and dinner", location: "Sathorn", est_cost: 3500, duration_min: 150, category: "meal", is_optional: true },
      ]},
      { day: 4, theme: "Last morning and home", items: [
        { time: "09:00", activity: "Breakfast and checkout", location: "Hotel", est_cost: 600, duration_min: 90, category: "checkout" },
        { time: "11:00", activity: "Last shopping — MBK or Platinum for cheaper goods", location: "Pathum Wan", est_cost: 3000, duration_min: 150, category: "shopping", is_optional: true },
        { time: "14:00", activity: "Lunch", location: "Siam", est_cost: 800, duration_min: 60, category: "meal" },
        { time: "17:00", activity: "Transfer to the airport and fly home", location: "Suvarnabhumi Airport", est_cost: 2500, duration_min: 300, category: "travel", tags: ["return-included"] },
      ]},
    ],
  },

];

export default itineraryTemplates;
