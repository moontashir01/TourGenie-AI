// FR-18 — Smart Notification rules.
//
// The scheduler evaluates each active template against a trip's schedule and
// its WeatherForecast rows, and inserts a Notification when the trigger
// fires. Non-real-time by design (per the SRS): departure reminders and
// weather advisories, not live traffic or disruption feeds.
//
// Templates support {{destination}}, {{origin}}, {{trip_title}}, {{hours}},
// {{days}}, {{date}}, {{temp}}, {{condition}}, {{amount}}, {{percent}} and
// {{document_type}}.

export const notificationTemplates = [
  // ── Departure reminders ──
  {
    code: "departure_7d", type: "departure", label: "One week to departure",
    trigger: { event: "trip_start_approaching", offset_hours: 168 },
    title_template: "One week to {{destination}}",
    message_template: "Your trip to {{destination}} departs in 7 days. Now is a good time to confirm your booking, check your packing list and make sure your documents are uploaded.",
    severity: "info", icon: "CalendarClock", action_url: "/trips/{{trip_id}}",
  },
  {
    code: "departure_48h", type: "departure", label: "Two days to departure",
    trigger: { event: "trip_start_approaching", offset_hours: 48 },
    title_template: "{{destination}} in 2 days",
    message_template: "You leave for {{destination}} on {{date}}. Check the forecast — your packing list updates with it — and confirm your transport booking.",
    severity: "reminder", icon: "Bell", action_url: "/trips/{{trip_id}}",
  },
  {
    code: "departure_24h", type: "departure", label: "Departure tomorrow",
    trigger: { event: "trip_start_approaching", offset_hours: 24 },
    title_template: "Departure tomorrow — {{origin}} to {{destination}}",
    message_template: "Your journey to {{destination}} starts tomorrow. Have your tickets, ID and cash ready, and allow extra time to reach the terminal.",
    severity: "reminder", icon: "Luggage", action_url: "/trips/{{trip_id}}/booking",
  },
  {
    code: "departure_3h", type: "departure", label: "Departure imminent",
    trigger: { event: "trip_start_approaching", offset_hours: 3 },
    title_template: "Leaving soon for {{destination}}",
    message_template: "Your departure is in about 3 hours. Traffic to the terminal is the usual reason people miss it — leave earlier than feels necessary.",
    severity: "warning", icon: "AlarmClock", action_url: "/trips/{{trip_id}}/booking",
  },

  // ── Weather advisories ──
  {
    code: "weather_rain", type: "weather", label: "Rain expected",
    trigger: { event: "daily_weather_check", offset_hours: 24, weather_conditions: ["rain", "light-rain"] },
    title_template: "Rain expected in {{destination}}",
    message_template: "The forecast for {{date}} in {{destination}} shows {{condition}}. Your weather-dependent activities that day have indoor alternatives — ask the assistant to swap them if you'd rather not risk it.",
    severity: "info", icon: "CloudRain", action_url: "/trips/{{trip_id}}/itinerary",
  },
  {
    code: "weather_heavy_rain", type: "weather", label: "Heavy rain warning",
    trigger: { event: "daily_weather_check", offset_hours: 24, weather_conditions: ["heavy-rain", "thunderstorm"] },
    title_template: "Heavy rain warning — {{destination}}",
    message_template: "Heavy rain is forecast for {{destination}} on {{date}}. Boat trips and hill roads are the first things affected. Check with your operator before travelling, and keep the day flexible.",
    severity: "warning", icon: "CloudLightning", action_url: "/trips/{{trip_id}}/itinerary",
  },
  {
    code: "weather_heat", type: "weather", label: "High temperature advisory",
    trigger: { event: "daily_weather_check", offset_hours: 24, threshold: 36 },
    title_template: "Hot day ahead in {{destination}}",
    message_template: "{{destination}} is forecast to reach {{temp}} °C on {{date}}. Plan outdoor sightseeing for early morning or late afternoon, and carry more water than you think you need.",
    severity: "warning", icon: "Thermometer", action_url: "/trips/{{trip_id}}/itinerary",
  },
  {
    code: "weather_cold", type: "weather", label: "Cold night advisory",
    trigger: { event: "daily_weather_check", offset_hours: 24, threshold: 12 },
    title_template: "Cold nights in {{destination}}",
    message_template: "Temperatures in {{destination}} drop to around {{temp}} °C overnight on {{date}}. If you're at a hill destination, bring a warmer layer than the daytime forecast suggests.",
    severity: "info", icon: "Snowflake", action_url: "/trips/{{trip_id}}/packing",
  },

  // ── Budget ──
  {
    code: "budget_75", type: "budget", label: "75% of budget spent",
    trigger: { event: "budget_threshold", threshold: 75 },
    title_template: "You've used {{percent}}% of your budget",
    message_template: "Logged expenses for {{destination}} now total ৳{{amount}} — {{percent}}% of your budget. Still on track, but worth a look at the breakdown.",
    severity: "info", icon: "PieChart", action_url: "/trips/{{trip_id}}/budget",
  },
  {
    code: "budget_90", type: "budget", label: "90% of budget spent",
    trigger: { event: "budget_threshold", threshold: 90 },
    title_template: "Approaching your budget limit",
    message_template: "You've spent ৳{{amount}} of your {{destination}} budget — {{percent}}%. Ask the assistant to trim the remaining days if you want to stay inside it.",
    severity: "warning", icon: "TrendingUp", action_url: "/trips/{{trip_id}}/budget",
  },
  {
    code: "budget_exceeded", type: "budget", label: "Budget exceeded",
    trigger: { event: "budget_threshold", threshold: 100 },
    title_template: "Over budget on {{destination}}",
    message_template: "Logged expenses have passed your budget by ৳{{amount}}. Nothing is blocked — this is a tracker, not a limit — but the remaining days are worth reviewing.",
    severity: "critical", icon: "CircleAlert", action_url: "/trips/{{trip_id}}/budget",
  },

  // ── Documents ──
  {
    code: "document_expiring_90d", type: "document", label: "Document expiring in 90 days",
    trigger: { event: "document_expiring", threshold: 90 },
    title_template: "Your {{document_type}} expires in {{days}} days",
    message_template: "Your stored {{document_type}} expires on {{date}}. Many countries require at least six months' validity on a passport at entry — renew well before you travel.",
    severity: "warning", icon: "FileWarning", action_url: "/documents",
  },
  {
    code: "document_expiring_30d", type: "document", label: "Document expiring in 30 days",
    trigger: { event: "document_expiring", threshold: 30 },
    title_template: "{{document_type}} expires this month",
    message_template: "Your {{document_type}} expires on {{date}} — under 30 days away. Renew it before your next trip.",
    severity: "critical", icon: "FileX", action_url: "/documents",
  },

  // ── Lifecycle ──
  {
    code: "itinerary_ready", type: "itinerary", label: "Itinerary generated",
    trigger: { event: "itinerary_generated", offset_hours: 0 },
    title_template: "Your {{destination}} itinerary is ready",
    message_template: "A day-by-day plan for {{destination}} has been generated across {{days}} days. Open it to review, and use the chat assistant to adjust anything in plain language.",
    severity: "info", icon: "Sparkles", action_url: "/trips/{{trip_id}}/itinerary",
  },
  {
    code: "booking_confirmed", type: "booking", label: "Booking confirmed",
    trigger: { event: "booking_confirmed", offset_hours: 0 },
    title_template: "Booking confirmed (demo)",
    message_template: "Your {{destination}} transport booking is saved. This is a demonstration record — no payment was taken and no ticket was issued with the operator.",
    severity: "info", icon: "TicketCheck", action_url: "/trips/{{trip_id}}/booking",
  },
  {
    code: "trip_ending", type: "departure", label: "Trip ending tomorrow",
    trigger: { event: "trip_end_approaching", offset_hours: 24 },
    title_template: "Last day in {{destination}}",
    message_template: "Your {{destination}} trip ends tomorrow. Check your return booking, and log any expenses you haven't recorded yet.",
    severity: "reminder", icon: "CalendarCheck", action_url: "/trips/{{trip_id}}/budget",
  },
  {
    code: "trip_completed", type: "review", label: "Trip completed",
    trigger: { event: "trip_completed", offset_hours: 24 },
    title_template: "How was {{destination}}?",
    message_template: "Your trip is marked complete. Share a review or a community post — the places you rate feed into what the planner recommends to other travellers.",
    severity: "info", icon: "Star", action_url: "/community",
  },
];

export default notificationTemplates;
