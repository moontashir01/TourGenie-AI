// Airport reference data and flight schedules.
//
// Replaces the hardcoded city→IATA table the flight service used to carry
// in code, and lets the flight search answer from MongoDB. Schedules are
// recurring (days_of_week), so the search expands them onto whatever dates
// the traveller asks for. Fares are indicative BDT round-trip-inclusive
// one-way figures for demonstration.

export const airports = [
  // ── Bangladesh ──
  { iata: "DAC", icao: "VGHS", name: "Hazrat Shahjalal International Airport", city: "Dhaka", destination_slug: "dhaka", city_aliases: ["Dacca"], country: "Bangladesh", country_code: "BD", lat_lng: { lat: 23.8433, lng: 90.3978 }, is_international: true },
  { iata: "CGP", icao: "VGEG", name: "Shah Amanat International Airport", city: "Chattogram", destination_slug: "chattogram", city_aliases: ["Chittagong", "Ctg"], country: "Bangladesh", country_code: "BD", lat_lng: { lat: 22.2496, lng: 91.8133 }, is_international: true },
  { iata: "CXB", icao: "VGCB", name: "Cox's Bazar Airport", city: "Cox's Bazar", destination_slug: "coxs-bazar", city_aliases: ["Coxs Bazar"], country: "Bangladesh", country_code: "BD", lat_lng: { lat: 21.4522, lng: 91.9639 }, is_international: false },
  { iata: "ZYL", icao: "VGSY", name: "Osmani International Airport", city: "Sylhet", destination_slug: "sylhet", country: "Bangladesh", country_code: "BD", lat_lng: { lat: 24.9632, lng: 91.8667 }, is_international: true },
  { iata: "JSR", icao: "VGJR", name: "Jashore Airport", city: "Jashore", city_aliases: ["Jessore", "Khulna"], country: "Bangladesh", country_code: "BD", lat_lng: { lat: 23.1838, lng: 89.1608 }, is_international: false },
  { iata: "BZL", icao: "VGBR", name: "Barishal Airport", city: "Barishal", destination_slug: "barishal", city_aliases: ["Barisal"], country: "Bangladesh", country_code: "BD", lat_lng: { lat: 22.801, lng: 90.3013 }, is_international: false },
  { iata: "RJH", icao: "VGRJ", name: "Shah Makhdum Airport", city: "Rajshahi", destination_slug: "rajshahi", country: "Bangladesh", country_code: "BD", lat_lng: { lat: 24.4372, lng: 88.6165 }, is_international: false },
  { iata: "SPD", icao: "VGSD", name: "Saidpur Airport", city: "Saidpur", city_aliases: ["Nilphamari", "Rangpur"], country: "Bangladesh", country_code: "BD", lat_lng: { lat: 25.7592, lng: 88.9089 }, is_international: false },

  // ── International ──
  { iata: "BKK", icao: "VTBS", name: "Suvarnabhumi Airport", city: "Bangkok", destination_slug: "bangkok", country: "Thailand", country_code: "TH", lat_lng: { lat: 13.6900, lng: 100.7501 }, timezone: "Asia/Bangkok" },
];

const daily = [0, 1, 2, 3, 4, 5, 6];

export const flightOptions = [
  // ───────────────── Domestic: Dhaka ↔ Cox's Bazar ─────────────────
  { airline: "Biman Bangladesh Airlines", airline_code: "BG", flight_number: "BG-435", aircraft: "Boeing 737-800", from_city: "Dhaka", from_iata: "DAC", to_city: "Cox's Bazar", to_iata: "CXB", depart_time: "08:00", arrive_time: "09:10", duration_min: 70, base_fare_bdt: 4800, taxes_bdt: 900, total_fare_bdt: 5700, baggage_kg: 20, seats_available: 42, days_of_week: daily, is_domestic: true },
  { airline: "US-Bangla Airlines", airline_code: "BS", flight_number: "BS-141", aircraft: "ATR 72-600", from_city: "Dhaka", from_iata: "DAC", to_city: "Cox's Bazar", to_iata: "CXB", depart_time: "10:30", arrive_time: "11:45", duration_min: 75, base_fare_bdt: 4200, taxes_bdt: 850, total_fare_bdt: 5050, baggage_kg: 20, seats_available: 28, days_of_week: daily, is_domestic: true },
  { airline: "Novoair", airline_code: "VQ", flight_number: "VQ-921", aircraft: "ATR 72-500", from_city: "Dhaka", from_iata: "DAC", to_city: "Cox's Bazar", to_iata: "CXB", depart_time: "14:15", arrive_time: "15:30", duration_min: 75, base_fare_bdt: 4500, taxes_bdt: 850, total_fare_bdt: 5350, baggage_kg: 20, seats_available: 31, days_of_week: daily, is_domestic: true },
  { airline: "US-Bangla Airlines", airline_code: "BS", flight_number: "BS-146", aircraft: "Boeing 737-800", from_city: "Cox's Bazar", from_iata: "CXB", to_city: "Dhaka", to_iata: "DAC", depart_time: "16:30", arrive_time: "17:45", duration_min: 75, base_fare_bdt: 4200, taxes_bdt: 850, total_fare_bdt: 5050, baggage_kg: 20, seats_available: 36, days_of_week: daily, is_domestic: true },

  // ───────────────── Domestic: other routes ─────────────────
  { airline: "Biman Bangladesh Airlines", airline_code: "BG", flight_number: "BG-601", aircraft: "Boeing 737-800", from_city: "Dhaka", from_iata: "DAC", to_city: "Chattogram", to_iata: "CGP", depart_time: "07:15", arrive_time: "08:10", duration_min: 55, base_fare_bdt: 3900, taxes_bdt: 800, total_fare_bdt: 4700, baggage_kg: 20, seats_available: 48, days_of_week: daily, is_domestic: true },
  { airline: "US-Bangla Airlines", airline_code: "BS", flight_number: "BS-121", aircraft: "ATR 72-600", from_city: "Dhaka", from_iata: "DAC", to_city: "Sylhet", to_iata: "ZYL", depart_time: "09:45", arrive_time: "10:40", duration_min: 55, base_fare_bdt: 3800, taxes_bdt: 800, total_fare_bdt: 4600, baggage_kg: 20, seats_available: 30, days_of_week: daily, is_domestic: true },
  { airline: "Novoair", airline_code: "VQ", flight_number: "VQ-931", aircraft: "ATR 72-500", from_city: "Dhaka", from_iata: "DAC", to_city: "Jashore", to_iata: "JSR", depart_time: "11:00", arrive_time: "11:50", duration_min: 50, base_fare_bdt: 3600, taxes_bdt: 750, total_fare_bdt: 4350, baggage_kg: 20, seats_available: 34, days_of_week: daily, is_domestic: true },
  { airline: "US-Bangla Airlines", airline_code: "BS", flight_number: "BS-171", aircraft: "ATR 72-600", from_city: "Dhaka", from_iata: "DAC", to_city: "Barishal", to_iata: "BZL", depart_time: "12:30", arrive_time: "13:15", duration_min: 45, base_fare_bdt: 3500, taxes_bdt: 750, total_fare_bdt: 4250, baggage_kg: 20, seats_available: 26, days_of_week: [0, 2, 4, 6], is_domestic: true },
  { airline: "Biman Bangladesh Airlines", airline_code: "BG", flight_number: "BG-491", aircraft: "Dash 8-400", from_city: "Dhaka", from_iata: "DAC", to_city: "Rajshahi", to_iata: "RJH", depart_time: "15:00", arrive_time: "15:55", duration_min: 55, base_fare_bdt: 3700, taxes_bdt: 750, total_fare_bdt: 4450, baggage_kg: 20, seats_available: 40, days_of_week: [0, 1, 3, 5], is_domestic: true },
  { airline: "US-Bangla Airlines", airline_code: "BS", flight_number: "BS-161", aircraft: "ATR 72-600", from_city: "Dhaka", from_iata: "DAC", to_city: "Saidpur", to_iata: "SPD", depart_time: "08:45", arrive_time: "09:45", duration_min: 60, base_fare_bdt: 3900, taxes_bdt: 800, total_fare_bdt: 4700, baggage_kg: 20, seats_available: 29, days_of_week: daily, is_domestic: true },

  // ───────────────── International: Dhaka ↔ Bangkok ─────────────────
  { airline: "US-Bangla Airlines", airline_code: "BS", flight_number: "BS-321", aircraft: "Boeing 737-800", from_city: "Dhaka", from_iata: "DAC", to_city: "Bangkok", to_iata: "BKK", depart_time: "23:45", arrive_time: "03:35", duration_min: 170, base_fare_bdt: 29500, taxes_bdt: 9500, total_fare_bdt: 39000, baggage_kg: 30, seats_available: 40, days_of_week: daily, arrives_next_day: true, is_domestic: false },
];

export default { airports, flightOptions };
