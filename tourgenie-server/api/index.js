// Vercel's entry point into the API.
//
// The app itself is built in src/app.js and knows nothing about how it is
// served; server.js runs it as a long-lived process, this runs it as a
// serverless function. The only thing that has to change between the two is
// when the database connection is opened: a process connects once at boot,
// a function has no boot, so it connects on the first request a container
// handles and keeps that connection for every later one.
import "dotenv/config";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

let ready = null;

function ensureDb() {
  // Cleared on failure: a rejected promise cached here would turn one
  // transient Atlas outage into a permanently broken container.
  if (!ready) {
    ready = connectDB().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export default async function handler(req, res) {
  await ensureDb();
  return app(req, res);
}
