const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("tourgenie_token");
}

/**
 * Changing a password retires every token signed before it, including the
 * one this tab is holding. The server answers with a replacement; storing it
 * here is what stops the next request 401-ing the user out of the settings
 * page they just used correctly.
 */
export function setToken(token) {
  if (token) localStorage.setItem("tourgenie_token", token);
}

// A login lasts a week. When it runs out, every request starts coming back
// 401 — and the app used to render that as a red "Not authorized" banner on
// whichever page you were on, forever, with no hint that logging in again
// was the fix. Now the first such answer ends the session cleanly and sends
// you to the login screen with an explanation.
export const SESSION_EXPIRED_EVENT = "tourgenie:session-expired";
const EXPIRY_NOTICE_KEY = "tourgenie_session_expired";

let expiring = false;

function endExpiredSession() {
  // A page that fired six requests at once gets six 401s; only the first
  // should do anything.
  if (expiring) return;
  expiring = true;
  try {
    localStorage.removeItem("tourgenie_token");
    // Read and cleared by the login screen, so it can say why you're there.
    sessionStorage.setItem(EXPIRY_NOTICE_KEY, "1");
  } catch {
    // Storage blocked — the event below still signs the user out in memory.
  }
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  // Let the whole burst of in-flight requests settle before re-arming.
  setTimeout(() => {
    expiring = false;
  }, 1000);
}

/** True once, for the login screen; the notice doesn't survive a reload. */
export function consumeSessionExpiredNotice() {
  try {
    const flag = sessionStorage.getItem(EXPIRY_NOTICE_KEY);
    if (flag) sessionStorage.removeItem(EXPIRY_NOTICE_KEY);
    return Boolean(flag);
  } catch {
    return false;
  }
}

async function request(path, { method = "GET", body, auth = true, reauthToken } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  // The two-minute confirmation from POST /admin/reauth. A handful of admin
  // actions ask for the password again and won't run without it.
  if (reauthToken) headers["x-reauth-token"] = reauthToken;

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
    // Only when a token was actually sent: a 401 from the login form means
    // "wrong password", not "your session ended", and must stay on the page.
    if (res.status === 401 && auth && token) endExpiredSession();

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

// A file, not JSON. The admin exports stream CSV straight from a cursor, so
// they can't go through request() — but they still need the bearer token, and
// a plain <a href> can't carry one.
async function downloadFile(path, fallbackName, { reauthToken } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(reauthToken ? { "x-reauth-token": reauthToken } : {}),
    },
  });

  if (!res.ok) {
    // An error before the stream starts is still JSON.
    let message = `Request failed with status ${res.status}`;
    try {
      message = (await res.json())?.message || message;
    } catch {
      // Not JSON — keep the status line.
    }
    if (res.status === 401 && token) endExpiredSession();
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const disposition = res.headers.get("content-disposition") || "";
  const named = /filename="([^"]+)"/.exec(disposition);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = named?.[1] || fallbackName;
  a.click();
  URL.revokeObjectURL(url);
  return { filename: a.download, bytes: blob.size };
}

export const authApi = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),
  // Account settings — send only the keys being changed; anything omitted
  // is left as it is.
  updateMe: (payload) => request("/auth/me", { method: "PATCH", body: payload }),
  changePassword: (current_password, new_password) =>
    request("/auth/change-password", { method: "POST", body: { current_password, new_password } }),
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
  // FR-03 — confirms the trip and emails the plan as a PDF. Returns as soon
  // as the trip is confirmed; `email.queued` says whether a send was started.
  confirm: (id) => request(`/trips/${id}/confirm`, { method: "POST" }),
  // The cities this trip covers — the traveller's picks where they made any,
  // narrowed by the same rule the itinerary planner uses. `all_cities` backs
  // the "show every city in the country" escape hatch.
  cities: (id) => request(`/trips/${id}/cities`),

  // Sharing. Everything but `accept` is the owner's; the API enforces that
  // and answers 404 to anyone else, so these are safe to call optimistically.
  shares: {
    list: (id) => request(`/trips/${id}/shares`),
    invite: (id, { email, role }) => request(`/trips/${id}/shares`, { method: "POST", body: { email, role } }),
    setRole: (id, shareId, role) =>
      request(`/trips/${id}/shares/${shareId}`, { method: "PATCH", body: { role } }),
    revoke: (id, shareId) => request(`/trips/${id}/shares/${shareId}`, { method: "DELETE" }),
    // Claims an invite from the link in its email. Already-accepted invites
    // come back fine, so the dashboard can call this without checking first.
    accept: (token) => request(`/trips/shares/accept/${token}`, { method: "POST" }),
  },
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
  // Drag-and-drop reordering. Sends every affected row's new {day, time} in
  // one call and gets the whole re-sorted itinerary back, so the list can't
  // land half-updated the way one-PATCH-per-item did.
  reorder: (tripId, items) =>
    request(`/trips/${tripId}/itinerary/reorder`, { method: "PATCH", body: { items } }),
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

// FR-08 for accommodation. A reservation is a demonstration record until it
// is paid for through paymentApi below; nothing is ever reserved with the
// property itself.
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

// FR-08 — real payment through SSLCommerz.
//
// init() hands back a gateway URL the browser is sent to; the traveller comes
// back to /booking?payment=… once the gateway has redirected through the API.
// Nothing here decides whether a payment succeeded — the server validates
// against SSLCommerz before it will mark anything paid.
export const paymentApi = {
  init: (bookingKind, bookingRef) =>
    request("/payments/init", { method: "POST", body: { booking_kind: bookingKind, booking_ref: bookingRef } }),
  list: () => request("/payments"),
  get: (tranId) => request(`/payments/${tranId}`),
  refund: (tranId) => request(`/payments/${tranId}/refund`, { method: "POST" }),
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
  // Drops everything already read. The sweep regenerates anything whose
  // trigger still holds, so clearing is tidying, not suppression.
  clearRead: () => request("/notifications/read", { method: "DELETE" }),
};

export const communityApi = {
  // Sent with the token when there is one: the feed is public, but it marks
  // the posts you've already liked.
  list: (place) =>
    request(`/community-posts${place && place !== "All places" ? `?place=${encodeURIComponent(place)}` : ""}`),
  places: () => request("/community-posts/places", { auth: false }),
  create: (payload) => request("/community-posts", { method: "POST", body: payload }),
  like: (id) => request(`/community-posts/${id}/like`, { method: "POST" }),
};

// FR-23 — flagging someone else's post or review. One report per person per
// thing; the server answers 409 on a second attempt.
export const reportApi = {
  create: ({ target_type, target_id, reason, details }) =>
    request("/reports", { method: "POST", body: { target_type, target_id, reason, details } }),
  mine: () => request("/reports/mine"),
};

// Admin lists all speak the same query language — see utils/adminList.js on
// the server. `params` is {q, page, limit, sort, ...filters}; the answer is
// always { rows, page, limit, total, pages }.
function adminList(resource, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  ).toString();
  return request(`/admin/${resource}${qs ? `?${qs}` : ""}`);
}

export const adminApi = {
  // Confirms the admin's own password and returns a short-lived token for
  // role changes, account deletion and exports carrying email addresses. It
  // is deliberately not cached: each of those prompts asks again.
  reauth: (password) => request("/admin/reauth", { method: "POST", body: { password } }),
  // FR-24 — the rolled-up history behind the headline counters, for the charts.
  analyticsTimeseries: (period = "month", limit) => {
    const qs = new URLSearchParams({ period, ...(limit && { limit }) }).toString();
    return request(`/admin/analytics/timeseries?${qs}`);
  },

  analytics: () => request("/admin/analytics"),
  // The time series, from AnalyticsSnapshot rather than counted live.
  trends: ({ period = "day", limit } = {}) =>
    request(`/admin/analytics/trends?period=${period}${limit ? `&limit=${limit}` : ""}`),
  // The dashboard's work queue — counts of what is outstanding, and where
  // each one is cleared.
  attention: () => request("/admin/attention"),
  auditLogs: (params) => adminList("audit-logs", params),
  health: () => request("/admin/health"),

  search: (q) => request(`/admin/search?q=${encodeURIComponent(q)}`),

  users: (params) => adminList("users", params),
  userDetail: (id) => request(`/admin/users/${id}`),
  userFootprint: (id) => request(`/admin/users/${id}/footprint`),
  setUserStatus: (id, is_active, reason) =>
    request(`/admin/users/${id}/status`, { method: "PATCH", body: { is_active, reason } }),
  setUserRole: (id, role, reason, reauthToken) =>
    request(`/admin/users/${id}/role`, { method: "PATCH", body: { role, reason }, reauthToken }),
  // Soft by default and reversible; `hard` runs the cascade and is what the
  // password confirmation is for.
  deleteUser: (id, reason, { hard = false, reauthToken } = {}) =>
    request(`/admin/users/${id}${hard ? "?hard=true" : ""}`, { method: "DELETE", body: { reason }, reauthToken }),
  restoreUser: (id, reason) => request(`/admin/users/${id}/restore`, { method: "POST", body: { reason } }),
  // Keeps the trips and bookings, removes the person.
  anonymiseUser: (id, reason, reauthToken) =>
    request(`/admin/users/${id}/anonymise`, { method: "POST", body: { reason }, reauthToken }),

  trips: (params) => adminList("trips", params),
  tripDetail: (id) => request(`/admin/trips/${id}`),

  // Support context on a traveller or a trip — what an admin knew, as
  // opposed to what they did, which is the audit log's job.
  notes: {
    list: (target_type, target_id) =>
      request(`/admin/notes?target_type=${target_type}&target_id=${target_id}`),
    create: (payload) => request("/admin/notes", { method: "POST", body: payload }),
    update: (id, payload) => request(`/admin/notes/${id}`, { method: "PATCH", body: payload }),
    remove: (id) => request(`/admin/notes/${id}`, { method: "DELETE" }),
  },

  bookings: (params) => adminList("bookings", params),
  cancelBooking: (id, reason) => request(`/admin/bookings/${id}/cancel`, { method: "PATCH", body: { reason } }),
  hotelBookings: (params) => adminList("hotel-bookings", params),
  cancelHotelBooking: (id, reason) =>
    request(`/admin/hotel-bookings/${id}/cancel`, { method: "PATCH", body: { reason } }),
  seatMap: (transport_id, date) =>
    request(`/admin/bookings/seat-map?transport_id=${transport_id}&date=${encodeURIComponent(String(date || "").slice(0, 10))}`),

  // The catalogue: seven collections, one set of routes. Deleting is soft by
  // default — pass { hard: true } only after reading the references.
  catalogue: {
    list: (resource, params) => adminList(`catalogue/${resource}`, params),
    create: (resource, payload) => request(`/admin/catalogue/${resource}`, { method: "POST", body: payload }),
    update: (resource, id, payload) =>
      request(`/admin/catalogue/${resource}/${id}`, { method: "PATCH", body: payload }),
    remove: (resource, id, { reason, hard } = {}) =>
      request(`/admin/catalogue/${resource}/${id}${hard ? "?hard=true" : ""}`, {
        method: "DELETE",
        body: { reason },
      }),
    restore: (resource, id, reason) =>
      request(`/admin/catalogue/${resource}/${id}/restore`, { method: "POST", body: { reason } }),
    references: (resource, id) => request(`/admin/catalogue/${resource}/${id}/references`),
    bulk: (resource, ids, action, reason) =>
      request(`/admin/catalogue/${resource}/bulk`, { method: "POST", body: { ids, action, reason } }),
    rateCache: () => request("/admin/catalogue/hotel-rates"),
    clearRateCache: (city) =>
      request(`/admin/catalogue/hotel-rates${city ? `?city=${encodeURIComponent(city)}` : ""}`, {
        method: "DELETE",
      }),
  },

  // The three screens that already had bespoke forms keep their method names
  // and now go through the shared catalogue routes.
  createAttraction: (payload) => request("/admin/catalogue/attractions", { method: "POST", body: payload }),
  updateAttraction: (id, payload) =>
    request(`/admin/catalogue/attractions/${id}`, { method: "PATCH", body: payload }),
  deleteAttraction: (id) => request(`/admin/catalogue/attractions/${id}`, { method: "DELETE" }),
  attractions: (params) => adminList("catalogue/attractions", params),

  transport: (params) => adminList("catalogue/transport", params),
  createTransport: (payload) => request("/admin/catalogue/transport", { method: "POST", body: payload }),
  updateTransport: (id, payload) => request(`/admin/catalogue/transport/${id}`, { method: "PATCH", body: payload }),
  deleteTransport: (id) => request(`/admin/catalogue/transport/${id}`, { method: "DELETE" }),

  hotels: (params) => adminList("catalogue/hotels", params),
  createHotel: (payload) => request("/admin/catalogue/hotels", { method: "POST", body: payload }),
  updateHotel: (id, payload) => request(`/admin/catalogue/hotels/${id}`, { method: "PATCH", body: payload }),
  deleteHotel: (id) => request(`/admin/catalogue/hotels/${id}`, { method: "DELETE" }),

  communityPosts: (params) => adminList("community-posts", params),
  moderatePost: (id, action, reason) =>
    request(`/admin/community-posts/${id}/moderate`, { method: "PATCH", body: { action, reason } }),
  reviews: (params) => adminList("reviews", params),
  moderateReview: (id, action, reason) =>
    request(`/admin/reviews/${id}/moderate`, { method: "PATCH", body: { action, reason } }),

  // FR-23 — the queue: content the posting rules held, plus anything a
  // traveller reported. `action` is approve | hide | unhide | remove and goes
  // through the same two endpoints as the lists above.
  moderationQueue: (limit = 25) => request(`/admin/moderation/queue?limit=${limit}`),
  moderationStats: () => request("/admin/moderation/stats"),
  reports: (params) => adminList("reports", params),
  resolveReport: (id, status, resolution) =>
    request(`/admin/reports/${id}`, { method: "PATCH", body: { status, resolution } }),

  // Configuration: the limits the app enforces, the copy of every
  // notification, and the UI string tables. All three were seed-file-only.
  settings: {
    list: () => request("/admin/settings"),
    update: (key, value, reason) =>
      request(`/admin/settings/${encodeURIComponent(key)}`, { method: "PATCH", body: { value, reason } }),
  },

  notificationTemplates: {
    list: () => request("/admin/notification-templates"),
    create: (payload) => request("/admin/notification-templates", { method: "POST", body: payload }),
    update: (id, payload) => request(`/admin/notification-templates/${id}`, { method: "PATCH", body: payload }),
    remove: (id, reason) =>
      request(`/admin/notification-templates/${id}`, { method: "DELETE", body: { reason } }),
  },

  translations: {
    list: () => request("/admin/translations"),
    // Flattened to dotted keys with the English text beside each one.
    get: (lang) => request(`/admin/translations/${lang}`),
    // Send only the keys being changed — the whole table would let two
    // people editing at once overwrite each other silently.
    update: (lang, payload) => request(`/admin/translations/${lang}`, { method: "PATCH", body: payload }),
  },

  // Streamed CSV, built server-side. Personal columns are opt-in and every
  // download writes an audit entry.
  exports: {
    list: () => request("/admin/exports"),
    run: (report, { includePersonal = false, reauthToken } = {}) =>
      downloadFile(
        `/admin/exports/${report}${includePersonal ? "?include_personal=true" : ""}`,
        `tourgenie-${report}.csv`,
        { reauthToken }
      ),
  },
};

export { getToken };
