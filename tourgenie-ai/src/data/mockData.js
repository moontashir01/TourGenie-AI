export const trips = [
  {
    id: "t1",
    destination: "Cox's Bazar",
    origin: "Dhaka",
    startDate: "2026-08-15",
    endDate: "2026-08-18",
    status: "planned",
    travelers: 2,
    budget: 20000,
    cover: "beach",
  },
  {
    id: "t2",
    destination: "Sajek Valley",
    origin: "Dhaka",
    startDate: "2026-09-02",
    endDate: "2026-09-05",
    status: "draft",
    travelers: 4,
    budget: 32000,
    cover: "hills",
  },
  {
    id: "t3",
    destination: "Sundarbans",
    origin: "Khulna",
    startDate: "2026-06-10",
    endDate: "2026-06-13",
    status: "completed",
    travelers: 3,
    budget: 27000,
    cover: "forest",
  },
];

export const itinerary = [
  {
    day: 1,
    date: "Aug 15",
    items: [
      { time: "07:00", activity: "Depart Dhaka by Green Line bus", location: "Saidabad Terminal", cost: 1200 },
      { time: "14:30", activity: "Check in at hotel, rest", location: "Kolatoli Beach Road", cost: 0 },
      { time: "17:00", activity: "Sunset walk on Laboni Beach", location: "Laboni Point", cost: 0 },
      { time: "20:00", activity: "Dinner — fresh seafood", location: "Beach View Restaurant", cost: 1400 },
    ],
  },
  {
    day: 2,
    date: "Aug 16",
    items: [
      { time: "08:00", activity: "Breakfast at hotel", location: "Hotel Cafe", cost: 400 },
      { time: "10:00", activity: "Boat trip to Himchari waterfall", location: "Himchari National Park", cost: 900 },
      { time: "15:00", activity: "Inani Beach exploration", location: "Inani Beach", cost: 600 },
      { time: "19:30", activity: "Beach bonfire & BBQ", location: "Kolatoli Beach", cost: 1800 },
    ],
  },
  {
    day: 3,
    date: "Aug 17",
    items: [
      { time: "09:00", activity: "Visit Aggmeda Khyang temple", location: "Aggmeda Khyang", cost: 100 },
      { time: "12:00", activity: "Lunch at local market", location: "Burmese Market", cost: 700 },
      { time: "16:00", activity: "Free time / souvenir shopping", location: "Burmese Market", cost: 1500 },
    ],
  },
];

export const hotels = [
  { id: "h1", name: "Sayeman Beach Resort", rating: 4.5, price: 6500, distance: "0.2 km to beach", facilities: ["WiFi", "Pool", "Breakfast"] },
  { id: "h2", name: "Ocean Paradise Hotel", rating: 4.2, price: 4800, distance: "0.5 km to beach", facilities: ["WiFi", "AC", "Gym"] },
  { id: "h3", name: "Long Beach Hotel", rating: 4.7, price: 8900, distance: "0.1 km to beach", facilities: ["WiFi", "Pool", "Spa", "Breakfast"] },
  { id: "h4", name: "Sea Crown Hotel", rating: 3.9, price: 3200, distance: "1.1 km to beach", facilities: ["WiFi", "AC"] },
];

export const expenses = [
  { id: "e1", category: "Transport", description: "Bus tickets (return)", amount: 2400, date: "2026-08-15" },
  { id: "e2", category: "Hotel", description: "3 nights — Sayeman Beach Resort", amount: 19500, date: "2026-08-15" },
  { id: "e3", category: "Food", description: "Seafood dinner", amount: 1400, date: "2026-08-15" },
  { id: "e4", category: "Attractions", description: "Himchari boat trip", amount: 900, date: "2026-08-16" },
  { id: "e5", category: "Shopping", description: "Souvenirs", amount: 1500, date: "2026-08-17" },
];

export const budgetByCategory = [
  { category: "Transport", amount: 4200, color: "#1C8C82" },
  { category: "Hotel", amount: 19500, color: "#EF8354" },
  { category: "Food", amount: 5600, color: "#D9A441" },
  { category: "Attractions", amount: 2100, color: "#146560" },
  { category: "Shopping", amount: 1500, color: "#D96B3B" },
];

export const communityPosts = [
  {
    id: "p1",
    user: "Farhana R.",
    place: "Cox's Bazar",
    rating: 5,
    content: "The AI itinerary nailed the sunset timing at Laboni Beach — genuinely better than the plan I made myself last year.",
    likes: 34,
    replies: 6,
    time: "2 days ago",
  },
  {
    id: "p2",
    user: "Tanvir H.",
    place: "Sajek Valley",
    rating: 4,
    content: "Road to Sajek is rough in monsoon — TourGenie's packing list correctly warned about rain gear. Wish the route map showed elevation.",
    likes: 21,
    replies: 3,
    time: "5 days ago",
  },
  {
    id: "p3",
    user: "Mahin A.",
    place: "Sundarbans",
    rating: 5,
    content: "Booked the launch through the mock booking flow just to plan seating — super clear which operators run which days.",
    likes: 18,
    replies: 2,
    time: "1 week ago",
  },
];

export const adminMetrics = [
  { label: "Total Users", value: "4,218" },
  { label: "Active Trips", value: "312" },
  { label: "Attractions Listed", value: "186" },
  { label: "Pending Reviews", value: "9" },
];

export const tripsCreatedByMonth = [
  { month: "Mar", value: 120 },
  { month: "Apr", value: 165 },
  { month: "May", value: 210 },
  { month: "Jun", value: 260 },
  { month: "Jul", value: 302 },
  { month: "Aug", value: 340 },
];

export const pendingModeration = [
  { id: "m1", type: "Review", place: "Sajek Valley", user: "user_2281", reason: "Reported: spam link" },
  { id: "m2", type: "Community Post", place: "Cox's Bazar", user: "guest_9910", reason: "Reported: offensive language" },
];

export const chatMessages = [
  { from: "ai", text: "Hi! I've generated your 3-day Cox's Bazar itinerary. Want me to adjust anything?" },
  { from: "user", text: "Make day 2 cheaper and keep it vegetarian." },
  { from: "ai", text: "Done — swapped the BBQ dinner for a vegetarian thali (৳600 instead of ৳1,800) and moved the boat trip to a shared tour, saving about ৳900 total." },
];

export const quickChips = ["Make it cheaper", "Add one more day", "Vegetarian food only", "What if it rains?"];
