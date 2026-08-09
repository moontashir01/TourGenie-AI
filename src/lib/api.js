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
    throw error;
  }

  return data;
}

export const authApi = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),
};

export const tripsApi = {
  list: () => request("/trips"),
  create: (payload) => request("/trips", { method: "POST", body: payload }),
  get: (id) => request(`/trips/${id}`),
  update: (id, payload) => request(`/trips/${id}`, { method: "PATCH", body: payload }),
  remove: (id) => request(`/trips/${id}`, { method: "DELETE" }),
};

export const itineraryApi = {
  get: (tripId) => request(`/trips/${tripId}/itinerary`),
  generateAI: (tripId) => request(`/trips/${tripId}/itinerary/generate`, { method: "POST" }),
  generate: (tripId, items) => request(`/trips/${tripId}/itinerary`, { method: "POST", body: { items } }),
  update: (tripId, itemId, payload) =>
    request(`/trips/${tripId}/itinerary/${itemId}`, { method: "PATCH", body: payload }),
  remove: (tripId, itemId) => request(`/trips/${tripId}/itinerary/${itemId}`, { method: "DELETE" }),
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
  select: (hotelId, tripId) => request(`/hotels/${hotelId}/select`, { method: "POST", body: { trip_id: tripId } }),
};

export const attractionApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/attractions${qs ? `?${qs}` : ""}`, { auth: false });
  },
};

export const communityApi = {
  list: (place) => request(`/community-posts${place && place !== "All places" ? `?place=${encodeURIComponent(place)}` : ""}`, { auth: false }),
  create: (payload) => request("/community-posts", { method: "POST", body: payload }),
  like: (id) => request(`/community-posts/${id}/like`, { method: "POST" }),
};

export const adminApi = {
  analytics: () => request("/admin/analytics"),
  users: () => request("/admin/users"),
};

export { getToken };
