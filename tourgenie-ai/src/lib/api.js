const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("tourgenie_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body (e.g. 204)
  }

  if (!res.ok) {
    const message = data?.message || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    // Structured context the API attached (e.g. the cost estimate behind a
    // rejected budget) so callers can show numbers, not just the sentence.
    error.details = data?.details;
    // The whole error body, for handlers that read fields the API puts at the
    // top level (e.g. `retry_after` on a rate-limited reset request).
    error.body = data;
    throw error;
  }

  return data;
}

export const authApi = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),
  // Password recovery. forgotPassword is also the resend — the server applies
  // its own cooldown, so the UI only has to mirror it.
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email }, auth: false }),
  verifyOtp: (email, otp) => request("/auth/verify-otp", { method: "POST", body: { email, otp }, auth: false }),
  resetPassword: (reset_token, password) =>
    request("/auth/reset-password", { method: "POST", body: { reset_token, password }, auth: false }),
};

export const tripsApi = {
  list: () => request("/trips"),
  create: (payload) => request("/trips", { method: "POST", body: payload }),
  // What a trip would cost, without creating it — powers the live figure
  // under the budget field on the Plan a trip form.
  estimate: (payload) => request("/trips/estimate", { method: "POST", body: payload }),
  get: (id) => request(`/trips/${id}`),
  update: (id, payload) => request(`/trips/${id}`, { method: "PATCH", body: payload }),
  remove: (id) => request(`/trips/${id}`, { method: "DELETE" }),
};

export const referenceApi = {
  currencies: () => request("/reference/currencies", { auth: false }),
  expenseCategories: () => request("/reference/expense-categories", { auth: false }),
  // FR-17 — languages for the switcher, and one language's string table.
  languages: () => request("/reference/languages", { auth: false }),
  translation: (lang) => request(`/reference/translations/${lang}`, { auth: false }),
};

export const destinationsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/destinations${qs ? `?${qs}` : ""}`, { auth: false });
  },
  get: (idOrSlug) => request(`/destinations/${idOrSlug}`, { auth: false }),
  // Best time to visit — 12 monthly climate normals plus a summary.
  climate: (idOrSlug) => request(`/destinations/${idOrSlug}/climate`, { auth: false }),
  // Side-by-side comparison of up to four destinations, in one request.
  compare: (slugs, origin) => {
    const qs = new URLSearchParams({
      slugs: Array.isArray(slugs) ? slugs.join(",") : slugs,
      ...(origin && { origin }),
    }).toString();
    return request(`/destinations/compare?${qs}`, { auth: false });
  },
};

export const itineraryApi = {
  get: (tripId) => request(`/trips/${tripId}/itinerary`),
  generateAI: (tripId) => request(`/trips/${tripId}/itinerary/generate`, { method: "POST" }),
  generate: (tripId, items) => request(`/trips/${tripId}/itinerary`, { method: "POST", body: { items } }),
  update: (tripId, itemId, payload) =>
    request(`/trips/${tripId}/itinerary/${itemId}`, { method: "PATCH", body: payload }),
  remove: (tripId, itemId) => request(`/trips/${tripId}/itinerary/${itemId}`, { method: "DELETE" }),
  selectTransport: (tripId, itemId, payload) =>
    request(`/trips/${tripId}/itinerary/${itemId}/transport`, { method: "PUT", body: payload }),
};

export const expenseApi = {
  budgetSummary: (tripId) => request(`/trips/${tripId}/budget`),
  list: (tripId) => request(`/trips/${tripId}/expenses`),
  add: (tripId, payload) => request(`/trips/${tripId}/expenses`, { method: "POST", body: payload }),
  remove: (tripId, expenseId) => request(`/trips/${tripId}/expenses/${expenseId}`, { method: "DELETE" }),
};

export const hotelApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/hotels${qs ? `?${qs}` : ""}`, { auth: false });
  },
  select: (hotelId, tripId, city) =>
    request(`/hotels/${hotelId}/select`, { method: "POST", body: { trip_id: tripId, ...(city && { city }) } }),
};

export const attractionApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/attractions${qs ? `?${qs}` : ""}`, { auth: false });
  },
};

export const transportApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transport${qs ? `?${qs}` : ""}`, { auth: false });
  },
};

export const flightApi = {
  // With return_date the server quotes ROUND-TRIP fares — one price covering
  // both directions, counted once in the budget.
  search: ({ origin, destination, date, return_date, travelers }) => {
    const qs = new URLSearchParams({
      origin,
      destination,
      ...(date && { date }),
      ...(return_date && { return_date }),
      ...(travelers && { travelers }),
    }).toString();
    return request(`/flights?${qs}`);
  },
};

export const routeApi = {
  get: (from, to, mode) => {
    const qs = new URLSearchParams({ from, to, ...(mode && { mode }) }).toString();
    return request(`/routes?${qs}`, { auth: false });
  },
  // FR-06 — every seeded variant for a pair (fastest / scenic / cheapest).
  options: (from, to) => {
    const qs = new URLSearchParams({ from, to }).toString();
    return request(`/routes/options?${qs}`, { auth: false });
  },
  // FR-06 — the whole journey for a trip, leg by leg, variants included.
  trip: (tripId) => request(`/trips/${tripId}/route`),
};

// FR-11 — per-day forecast aligned to the trip's itinerary.
export const weatherApi = {
  trip: (tripId) => request(`/trips/${tripId}/weather`),
  // Preview by default; apply:true writes the swaps to the itinerary.
  swap: (tripId, apply = false) =>
    request(`/trips/${tripId}/weather-swap${apply ? "?apply=true" : ""}`, { method: "POST" }),
};

// FR-15 — smart packing list, persisted per trip.
export const packingApi = {
  get: (tripId) => request(`/trips/${tripId}/packing-list`),
  generate: (tripId) => request(`/trips/${tripId}/packing-list/generate`, { method: "POST" }),
  toggle: (tripId, category, name, checked) =>
    request(`/trips/${tripId}/packing-list/items`, { method: "PATCH", body: { category, name, checked } }),
};

// FR-13 — nearby services from the 2dsphere index.
export const nearbyApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/nearby?${qs}`, { auth: false });
  },
};

// FR-14 — travel documents.
export const documentApi = {
  list: () => request("/documents"),
  add: (payload) => request("/documents", { method: "POST", body: payload }),
  remove: (id) => request(`/documents/${id}`, { method: "DELETE" }),
};

export const chatApi = {
  quickActions: () => request("/chat/quick-actions"),
  session: (tripId) => request(`/chat/session${tripId ? `?trip_id=${tripId}` : ""}`),
  send: (message, tripId, sessionId) =>
    request("/chat/messages", {
      method: "POST",
      body: { message, trip_id: tripId || undefined, session_id: sessionId || undefined },
    }),
};

// FR-08 — mock ticket booking. Demonstration records: no carrier API and
// no payment gateway is involved at any point.
export const bookingApi = {
  create: (payload) => request("/bookings", { method: "POST", body: payload }),
  forTrip: (tripId) => request(`/bookings/trips/${tripId}`),
  cancel: (tripId, bookingId) =>
    request(`/bookings/trips/${tripId}/${bookingId}/cancel`, { method: "PATCH" }),
  // Which seats are already sold on a given departure.
  availability: (transportId, date) =>
    request(`/transport/${transportId}/availability${date ? `?date=${date}` : ""}`, { auth: false }),
};

// FR-08 for accommodation — demonstration reservations. No payment is
// taken and nothing is reserved with the property.
export const hotelBookingApi = {
  availability: (hotelId, checkIn, checkOut) => {
    const qs = new URLSearchParams({ ...(checkIn && { check_in: checkIn }), ...(checkOut && { check_out: checkOut }) }).toString();
    return request(`/hotels/${hotelId}/availability${qs ? `?${qs}` : ""}`, { auth: false });
  },
  create: (payload) => request("/hotel-bookings", { method: "POST", body: payload }),
  forTrip: (tripId) => request(`/hotel-bookings/trips/${tripId}`),
  cancel: (tripId, bookingId) =>
    request(`/hotel-bookings/trips/${tripId}/${bookingId}/cancel`, { method: "PATCH" }),
};

// FR-18 — reading the list is what runs the rule sweep server-side.
export const notificationApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/notifications${qs ? `?${qs}` : ""}`);
  },
  unreadCount: () => request("/notifications/unread-count"),
  refresh: () => request("/notifications/refresh", { method: "POST" }),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
  remove: (id) => request(`/notifications/${id}`, { method: "DELETE" }),
};

export const communityApi = {
  list: (place) => request(`/community-posts${place && place !== "All places" ? `?place=${encodeURIComponent(place)}` : ""}`, { auth: false }),
  create: (payload) => request("/community-posts", { method: "POST", body: payload }),
  like: (id) => request(`/community-posts/${id}/like`, { method: "POST" }),
};

export const adminApi = {
  analytics: () => request("/admin/analytics"),
  users: () => request("/admin/users"),
  setUserStatus: (id, is_active) => request(`/admin/users/${id}/status`, { method: "PATCH", body: { is_active } }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),

  trips: () => request("/admin/trips"),

  createAttraction: (payload) => request("/admin/attractions", { method: "POST", body: payload }),
  updateAttraction: (id, payload) => request(`/admin/attractions/${id}`, { method: "PATCH", body: payload }),
  deleteAttraction: (id) => request(`/admin/attractions/${id}`, { method: "DELETE" }),

  createTransport: (payload) => request("/admin/transport", { method: "POST", body: payload }),
  updateTransport: (id, payload) => request(`/admin/transport/${id}`, { method: "PATCH", body: payload }),
  deleteTransport: (id) => request(`/admin/transport/${id}`, { method: "DELETE" }),

  hotels: () => request("/admin/hotels"),
  createHotel: (payload) => request("/admin/hotels", { method: "POST", body: payload }),
  updateHotel: (id, payload) => request(`/admin/hotels/${id}`, { method: "PATCH", body: payload }),
  deleteHotel: (id) => request(`/admin/hotels/${id}`, { method: "DELETE" }),

  communityPosts: () => request("/admin/community-posts"),
  moderatePost: (id, action) => request(`/admin/community-posts/${id}/moderate`, { method: "PATCH", body: { action } }),

  reviews: () => request("/admin/reviews"),
  moderateReview: (id, action) => request(`/admin/reviews/${id}/moderate`, { method: "PATCH", body: { action } }),
};

export { getToken };
