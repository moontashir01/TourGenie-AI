// FR-05 — the database side of the AI chat assistant.
//
// The quick-action chips in the wireframe ("Make it cheaper", "Add one more
// day", "Vegetarian food only", "What if it rains?") are the first four rows
// here. `patterns` are regex sources tested case-insensitively against the
// traveller's message; `keywords` is a cheaper fallback match.
//
// Templates support {{destination}}, {{days}}, {{budget}}, {{saved}},
// {{traveler_name}} and {{total_cost}}.

export const chatIntents = [
  {
    code: "reduce_budget", label: "Make the trip cheaper", priority: 90,
    is_quick_action: true, quick_action_label: "Make it cheaper", quick_action_order: 1,
    patterns: ["make it cheap(er)?", "reduce (the )?(budget|cost)", "too expensive", "lower the cost", "save money", "budget.{0,10}friendly"],
    keywords: ["cheaper", "cheap", "budget", "expensive", "save", "cost", "affordable"],
    response_template:
      "I've reworked your {{destination}} plan to bring the cost down. I swapped paid activities for free alternatives where the experience holds up, moved meals towards local restaurants, and dropped the optional add-ons. Estimated saving: ৳{{saved}}. The new total is ৳{{total_cost}}.",
    followup_suggestions: ["Show me the cheapest hotel option", "What did you remove?", "Can we go cheaper still?"],
    action: { type: "reduce_budget", params: { target_reduction_pct: 25, drop_optional: true, prefer_free_attractions: true } },
  },
  {
    code: "add_day", label: "Extend the trip by a day", priority: 88,
    is_quick_action: true, quick_action_label: "Add one more day", quick_action_order: 2,
    patterns: ["add (one |an |a )?(more |extra )?day", "extend (the |my )?trip", "stay (one |an )?(more|extra|another) (day|night)", "make it longer"],
    keywords: ["add day", "extra day", "extend", "longer", "one more day"],
    response_template:
      "Added day {{days}} to your {{destination}} itinerary. I've filled it with the attractions that didn't fit the original schedule, kept the pace relaxed since it's the last day, and left the evening open for the return journey. The updated estimate is ৳{{total_cost}}.",
    followup_suggestions: ["What's on the new day?", "Add another night at the same hotel", "Now make it cheaper"],
    action: { type: "add_day", params: { pace: "relaxed", fill_from_unused_attractions: true } },
  },
  {
    code: "filter_food", label: "Restrict food options", priority: 85,
    is_quick_action: true, quick_action_label: "Vegetarian food only", quick_action_order: 3,
    patterns: ["vegetarian", "veg(an)? (only|food)", "no (meat|beef|pork)", "halal only", "food preference", "dietary"],
    keywords: ["vegetarian", "vegan", "halal", "meat", "diet", "food"],
    response_template:
      "Updated every meal on your {{destination}} itinerary to match that preference. Bangladeshi menus are meat-heavy, so I've steered towards places with reliable vegetarian options — dal, bhorta, vegetable curries and the Bengali sweet shops. Costs came down slightly as a result.",
    followup_suggestions: ["Any vegetarian restaurants nearby?", "What about breakfast?", "Show the updated budget"],
    action: { type: "filter_food", params: { preference: "vegetarian" } },
  },
  {
    code: "weather_contingency", label: "Rainy-day alternative", priority: 87,
    is_quick_action: true, quick_action_label: "What if it rains?", quick_action_order: 4,
    patterns: ["what if it rains", "rain(y)? (day|plan|backup)", "bad weather", "if it('s| is) raining", "monsoon plan"],
    keywords: ["rain", "raining", "weather", "monsoon", "storm", "wet"],
    requires_trip: true,
    response_template:
      "Here's the wet-weather version. I've flagged the weather-dependent activities on your {{destination}} plan and paired each with an indoor alternative — museums, covered markets, monasteries and cafés — so a rainy morning doesn't cost you the day. Your forecast currently shows rain on some days, so this is worth keeping to hand.",
    followup_suggestions: ["Show me the forecast", "Swap the rainy days now", "What should I pack for rain?"],
    action: { type: "swap_weather_dependent", params: { prefer_indoor: true, dry_run: true } },
  },

  // ── Non-chip intents ──
  {
    code: "increase_budget", label: "Upgrade the trip", priority: 80,
    patterns: ["upgrade", "make it (better|nicer|luxur)", "spend more", "premium", "increase (the )?budget", "better hotel"],
    keywords: ["upgrade", "luxury", "premium", "better", "nicer", "splurge"],
    response_template:
      "Upgraded your {{destination}} plan. Accommodation moves to the higher tier, I've added the guided and reserved-transport options, and swapped a few meals to the better-regarded restaurants. New estimate: ৳{{total_cost}}.",
    followup_suggestions: ["Show me luxury hotels", "Add a spa day", "Back to the original plan"],
    action: { type: "increase_budget", params: { target_tier: "luxury" } },
  },
  {
    code: "remove_day", label: "Shorten the trip", priority: 78,
    patterns: ["remove (a |one )?day", "shorten (the |my )?trip", "make it shorter", "(one|1) (day|night) less", "cut a day"],
    keywords: ["shorter", "remove day", "less days", "cut"],
    response_template:
      "Shortened your {{destination}} itinerary to {{days}} days. I removed the lightest day and redistributed its best activities into the remaining schedule, so you keep the highlights. Updated estimate: ৳{{total_cost}}.",
    followup_suggestions: ["What did I lose?", "Now make it cheaper", "Show the new plan"],
    action: { type: "remove_day", params: { keep_highlights: true } },
  },
  {
    code: "relax_pace", label: "Slow the itinerary down", priority: 75,
    patterns: ["too (busy|packed|rushed|hectic)", "slow(er)? (it )?down", "relax(ed)? pace", "less activities", "too much"],
    keywords: ["busy", "rushed", "packed", "slow", "relax", "tiring"],
    response_template:
      "Eased the pace on your {{destination}} plan. I've dropped the optional stops, pushed the morning starts later, and left longer gaps between activities. You'll see less, but you won't spend the trip in transit.",
    followup_suggestions: ["What did you remove?", "Add back the waterfall", "Show the new schedule"],
    action: { type: "reorder_day", params: { pace: "relaxed", drop_optional: true, latest_start: "09:00" } },
  },
  {
    code: "pack_more", label: "Fit more in", priority: 74,
    patterns: ["more (activities|things to do)", "add more", "pack(ed)? (it )?in", "not enough", "busy(er)? itinerary"],
    keywords: ["more", "add", "busy", "packed", "boring"],
    response_template:
      "Added more to each day of your {{destination}} plan — earlier starts and the attractions that were previously left out. It's a full schedule now, so factor in travel time between stops.",
    followup_suggestions: ["Is that too much for one day?", "Show the new plan", "Now check the budget"],
    action: { type: "reorder_day", params: { pace: "packed", earliest_start: "07:00" } },
  },
  {
    code: "add_activity", label: "Add a specific activity", priority: 70,
    patterns: ["add (the )?(.+) to (my |the )?(itinerary|plan|trip)", "i want to (visit|see|go to)", "can (we|you) (add|include)"],
    keywords: ["add", "include", "visit", "want to see"],
    response_template:
      "Added that to your {{destination}} itinerary and slotted it into the day where it fits the geography best, so you're not doubling back. The cost estimate has been updated.",
    followup_suggestions: ["What time is it scheduled?", "Show the updated map", "What did it cost?"],
    action: { type: "add_activity", params: {} },
  },
  {
    code: "ask_weather", label: "Weather question", priority: 68, requires_trip: false,
    patterns: ["what('s| is) the weather", "will it rain", "how (hot|cold) (is|will)", "temperature", "forecast"],
    keywords: ["weather", "rain", "temperature", "hot", "cold", "forecast", "climate"],
    response_template:
      "Here's the forecast for {{destination}} across your travel dates. I pull this from the daily forecast records rather than a live feed, so it reflects the seasonal pattern for those dates. Anything marked weather-dependent on your itinerary is worth having a backup for.",
    followup_suggestions: ["What should I pack?", "Show me a rainy-day plan", "Is this a good time to visit?"],
    action: { type: "explain", params: { topic: "weather" } },
  },
  {
    code: "ask_budget", label: "Budget question", priority: 67,
    patterns: ["how much (will|does|is)", "what('s| is) the (total|budget|cost)", "can i afford", "cost breakdown", "am i over budget"],
    keywords: ["cost", "budget", "afford", "total", "price", "expensive", "money"],
    response_template:
      "Your {{destination}} trip is estimated at ৳{{total_cost}} against a budget of ৳{{budget}}. The breakdown by category is on the Budget page, split across transport, hotel, food, attractions, shopping and contingency. Expenses you log during the trip are tracked against this estimate.",
    followup_suggestions: ["Make it cheaper", "Which category costs most?", "Add an expense"],
    action: { type: "explain", params: { topic: "budget" } },
  },
  {
    code: "ask_packing", label: "Packing question", priority: 66,
    patterns: ["what (should|do) i (pack|bring|take)", "packing list", "what to (wear|carry)"],
    keywords: ["pack", "packing", "bring", "carry", "wear", "luggage"],
    response_template:
      "Your packing list for {{destination}} is generated from the forecast for your dates, the destination type and the interests you selected. It's on the Documents & Packing page, grouped by category with the essentials marked. Regenerate it if your dates change — the weather rules will re-evaluate.",
    followup_suggestions: ["Show the packing list", "Do I need rain gear?", "What about documents?"],
    action: { type: "explain", params: { topic: "packing" } },
  },
  {
    code: "ask_carbon", label: "Carbon footprint question", priority: 60,
    patterns: ["carbon", "co2", "emission", "environment(al)? impact", "footprint", "eco.?friendly"],
    keywords: ["carbon", "co2", "emission", "environment", "green", "eco"],
    response_template:
      "The carbon estimate for your {{destination}} trip is calculated from the route distance and the emission factor for your transport mode. Train comes out lowest per passenger-kilometre, bus close behind, and domestic flights highest by a wide margin — a short flight burns most of its fuel on takeoff and landing.",
    followup_suggestions: ["Show greener options", "How is this calculated?", "Switch me to the train"],
    action: { type: "explain", params: { topic: "carbon" } },
  },
  {
    code: "ask_transport", label: "Transport question", priority: 65,
    patterns: ["how (do|can) i (get|travel|reach)", "which (bus|train|flight)", "best way to (get|travel)", "transport option"],
    keywords: ["bus", "train", "flight", "launch", "travel", "reach", "get there"],
    response_template:
      "Here are the transport options between your origin and {{destination}}, with operators, departure times and fares. You can book any of them from the Booking page — note these are demonstration bookings, not real tickets.",
    followup_suggestions: ["Show me the cheapest", "What's the fastest?", "Book the morning departure"],
    action: { type: "explain", params: { topic: "transport" } },
  },
  {
    code: "greeting", label: "Greeting", priority: 20, requires_trip: false,
    patterns: ["^(hi|hello|hey|salam|assalamu alaikum|good (morning|afternoon|evening))\\b"],
    keywords: ["hi", "hello", "hey", "salam"],
    response_template:
      "Hello. I can adjust your itinerary, answer questions about the destination, weather, budget or transport, and rework the plan in plain language. Try one of the chips below, or just tell me what you'd like to change.",
    followup_suggestions: ["Make it cheaper", "Add one more day", "What's the weather like?"],
    action: { type: "none", params: {} },
  },
  {
    code: "thanks", label: "Thanks", priority: 20, requires_trip: false,
    patterns: ["thank(s| you)", "appreciate it", "that('s| is) (great|perfect|helpful)"],
    keywords: ["thanks", "thank you", "great", "perfect"],
    response_template: "Glad that helped. Anything else you'd like to adjust on the plan?",
    followup_suggestions: ["Show the full itinerary", "Check my budget", "What should I pack?"],
    action: { type: "none", params: {} },
  },
  {
    code: "fallback", label: "No intent matched", priority: 0, requires_trip: false,
    patterns: [],
    keywords: [],
    response_template:
      "I didn't quite catch that. I can change your itinerary — make it cheaper, add or remove a day, adjust the pace, or swap in rainy-day alternatives — and answer questions about the destination, weather, budget, transport, packing or carbon footprint. What would you like to do?",
    followup_suggestions: ["Make it cheaper", "Add one more day", "What if it rains?", "How much will this cost?"],
    action: { type: "none", params: {} },
  },
];

export default chatIntents;
