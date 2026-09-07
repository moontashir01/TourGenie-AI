// Who can reach a shared trip, asked over HTTP.
//
// The point of these is the negative case: a trip must be unreachable by
// anyone who neither owns it nor holds an accepted share, on every endpoint —
// not merely hidden by a UI that doesn't render a link to it. So the real app
// is started on a port and driven with real tokens, through the same routing,
// auth middleware and error handler production uses.
//
// Runs against its own database (…/tourgenie_sharetest), created and dropped
// per run, so it can never touch real trips.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import "dotenv/config";

let server;
let base;
let User;
let Trip;
let TripShare;
let Country;
let generateToken;

// Mail is not the subject here, and the invite path sends one.
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

before(async () => {
  const uri = process.env.MONGODB_URI;
  assert.ok(uri, "MONGODB_URI must be set to run these tests");
  await mongoose.connect(uri.replace(/\/([^/?]+)(\?|$)/, "/tourgenie_sharetest$2"));
  assert.equal(mongoose.connection.name, "tourgenie_sharetest");

  ({ default: User } = await import("../src/models/User.js"));
  ({ default: Trip } = await import("../src/models/Trip.js"));
  ({ default: TripShare } = await import("../src/models/TripShare.js"));
  ({ default: Country } = await import("../src/models/Country.js"));
  ({ generateToken } = await import("../src/utils/generateToken.js"));

  const { default: app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  // Sign-up validates the country against the catalogue, which is empty here.
  await Country.create({
    name: "Bangladesh",
    code: "BD",
    currency: "BDT",
    pricing_currency: "BDT",
    is_core: true,
    is_active: true,
  });
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  server?.close();
});

let seq = 0;
async function makeUser(name) {
  seq += 1;
  const user = await User.create({
    name,
    email: `${name.toLowerCase()}-${seq}@sharetest.local`,
    password_hash: "x".repeat(20),
    country: "Bangladesh",
    country_code: "BD",
  });
  return { user, token: generateToken(user) };
}

async function makeTrip(owner) {
  return Trip.create({
    user_id: owner._id,
    origin: "Dhaka",
    destination: "Cox's Bazar",
    start_date: new Date("2026-03-01"),
    end_date: new Date("2026-03-04"),
    travelers: 2,
    budget: 40000,
    title: "Test trip",
  });
}

function call(path, { token, method = "GET", body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// Every trip-scoped read a stranger might try. If one of these ever answers
// 200 for someone with no claim on the trip, that is the leak.
const READ_PATHS = (id) => [
  `/api/trips/${id}`,
  `/api/trips/${id}/cities`,
  `/api/trips/${id}/itinerary`,
  `/api/trips/${id}/expenses`,
  `/api/trips/${id}/budget`,
  `/api/trips/${id}/packing-list`,
  `/api/trips/${id}/weather`,
  `/api/trips/${id}/bookings`,
  `/api/trips/${id}/hotel-bookings`,
  `/api/trips/${id}/shares`,
];

test("a trip is invisible to a user with neither ownership nor a share", async () => {
  const { user: owner } = await makeUser("Owner");
  const { token: strangerToken } = await makeUser("Stranger");
  const trip = await makeTrip(owner);

  for (const path of READ_PATHS(trip._id)) {
    const res = await call(path, { token: strangerToken });
    assert.equal(res.status, 404, `${path} leaked to a stranger (${res.status})`);
  }
});

test("an unauthenticated caller reaches nothing", async () => {
  const { user: owner } = await makeUser("Owner");
  const trip = await makeTrip(owner);

  const res = await call(`/api/trips/${trip._id}`);
  assert.equal(res.status, 401);
});

test("the owner shares by email and the recipient sees the trip, badged", async () => {
  const { user: owner, token: ownerToken } = await makeUser("Owner");
  const { user: friend, token: friendToken } = await makeUser("Friend");
  const trip = await makeTrip(owner);

  const shared = await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: friend.email, role: "viewer" },
  });
  assert.equal(shared.status, 201);
  const { share } = await shared.json();
  // The recipient already has an account, so access is live immediately.
  assert.equal(share.status, "accepted");

  const listed = await call("/api/trips", { token: friendToken });
  const { trips } = await listed.json();
  const entry = trips.find((t) => String(t._id) === String(trip._id));
  assert.ok(entry, "the shared trip is missing from the recipient's list");
  assert.equal(entry.shared, true);
  assert.equal(entry.role, "viewer");
  assert.equal(entry.owner.name, owner.name);

  // And the owner's own list still says the trip is theirs.
  const own = await call("/api/trips", { token: ownerToken });
  const mine = (await own.json()).trips.find((t) => String(t._id) === String(trip._id));
  assert.equal(mine.shared, false);
  assert.equal(mine.role, "owner");
});

test("a viewer can read the itinerary but not change it", async () => {
  const { user: owner, token: ownerToken } = await makeUser("Owner");
  const { user: friend, token: friendToken } = await makeUser("Viewer");
  const trip = await makeTrip(owner);

  await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: friend.email, role: "viewer" },
  });

  const read = await call(`/api/trips/${trip._id}/itinerary`, { token: friendToken });
  assert.equal(read.status, 200);

  const write = await call(`/api/trips/${trip._id}/itinerary`, {
    token: friendToken,
    method: "POST",
    body: { items: [{ day: 1, time: "09:00", activity: "Sneak an edit in", category: "activity" }] },
  });
  assert.equal(write.status, 404, "a viewer was allowed to add an itinerary item");

  // Nor may they rename the trip.
  const rename = await call(`/api/trips/${trip._id}`, {
    token: friendToken,
    method: "PATCH",
    body: { title: "Mine now" },
  });
  assert.equal(rename.status, 404);
});

test("an editor can change the itinerary; deleting the trip stays with the owner", async () => {
  const { user: owner, token: ownerToken } = await makeUser("Owner");
  const { user: friend, token: friendToken } = await makeUser("Editor");
  const trip = await makeTrip(owner);

  await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: friend.email, role: "editor" },
  });

  const write = await call(`/api/trips/${trip._id}/itinerary`, {
    token: friendToken,
    method: "POST",
    body: { items: [{ day: 1, time: "09:00", activity: "Beach walk", category: "activity" }] },
  });
  assert.equal(write.status, 201, "an editor could not add an itinerary item");

  const destroy = await call(`/api/trips/${trip._id}`, { token: friendToken, method: "DELETE" });
  assert.equal(destroy.status, 404, "an editor was allowed to delete the trip");

  // The trip is still there afterwards.
  assert.ok(await Trip.findById(trip._id));
});

test("revoking removes access on the next request", async () => {
  const { user: owner, token: ownerToken } = await makeUser("Owner");
  const { user: friend, token: friendToken } = await makeUser("Revoked");
  const trip = await makeTrip(owner);

  const created = await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: friend.email, role: "editor" },
  });
  const { share } = await created.json();

  assert.equal((await call(`/api/trips/${trip._id}`, { token: friendToken })).status, 200);

  const revoked = await call(`/api/trips/${trip._id}/shares/${share._id}`, {
    token: ownerToken,
    method: "DELETE",
  });
  assert.equal(revoked.status, 200);

  assert.equal((await call(`/api/trips/${trip._id}`, { token: friendToken })).status, 404);
  const listed = await call("/api/trips", { token: friendToken });
  const still = (await listed.json()).trips.find((t) => String(t._id) === String(trip._id));
  assert.equal(still, undefined, "a revoked trip is still listed");
});

test("only the owner may invite, re-invite updates the role, and self-invite is refused", async () => {
  const { user: owner, token: ownerToken } = await makeUser("Owner");
  const { user: friend, token: friendToken } = await makeUser("Friend");
  const { user: other } = await makeUser("Other");
  const trip = await makeTrip(owner);

  await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: friend.email, role: "editor" },
  });

  // An editor cannot hand the trip on to somebody else.
  const relay = await call(`/api/trips/${trip._id}/shares`, {
    token: friendToken,
    method: "POST",
    body: { email: other.email, role: "editor" },
  });
  assert.equal(relay.status, 404, "an editor was allowed to invite someone");

  // Re-inviting the same address changes the role instead of failing on the
  // unique index.
  const again = await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: friend.email, role: "viewer" },
  });
  assert.equal(again.status, 201);
  assert.equal((await again.json()).share.role, "viewer");

  const self = await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: owner.email, role: "viewer" },
  });
  assert.equal(self.status, 400);
});

test("an invite to an address with no account waits, and registration claims it", async () => {
  const { user: owner, token: ownerToken } = await makeUser("Owner");
  const trip = await makeTrip(owner);
  const email = `newcomer-${Date.now()}@sharetest.local`;

  const invited = await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email, role: "editor" },
  });
  assert.equal(invited.status, 201);
  assert.equal((await invited.json()).share.status, "pending");

  // A pending invite is not access: nothing is granted until the address is
  // claimed by a real account.
  const pending = await TripShare.findOne({ trip_id: trip._id, invited_email: email });
  assert.equal(pending.shared_with_user_id, null);

  const registered = await call("/api/auth/register", {
    method: "POST",
    body: { name: "Newcomer", email, password: "hunter2!", country_code: "BD" },
  });
  assert.equal(registered.status, 201);
  // Registration creates the account but doesn't sign you in — log in for the
  // token, which is the flow the sign-up screen follows anyway.
  const loggedIn = await call("/api/auth/login", {
    method: "POST",
    body: { email, password: "hunter2!" },
  });
  assert.equal(loggedIn.status, 200);
  const { token } = await loggedIn.json();

  const claimed = await TripShare.findOne({ trip_id: trip._id, invited_email: email });
  assert.equal(claimed.status, "accepted");

  const listed = await call("/api/trips", { token });
  const entry = (await listed.json()).trips.find((t) => String(t._id) === String(trip._id));
  assert.ok(entry, "the invite did not follow the new account");
  assert.equal(entry.role, "editor");
});

test("an invite token cannot be redeemed by the wrong account", async () => {
  const { user: owner, token: ownerToken } = await makeUser("Owner");
  const { user: friend } = await makeUser("Friend");
  const { token: interloperToken } = await makeUser("Interloper");
  const trip = await makeTrip(owner);

  await call(`/api/trips/${trip._id}/shares`, {
    token: ownerToken,
    method: "POST",
    body: { email: friend.email, role: "editor" },
  });
  const { token: inviteToken } = await TripShare.findOne({ trip_id: trip._id, invited_email: friend.email });

  const stolen = await call(`/api/trips/shares/accept/${inviteToken}`, {
    token: interloperToken,
    method: "POST",
  });
  assert.equal(stolen.status, 403);
});
