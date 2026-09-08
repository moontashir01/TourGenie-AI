// Vercel's entry point into the API, for the single-project deployment.
//
// The whole repository deploys as one Vercel project: the client builds to
// static files and this function serves every /api/* path beside them. That
// means client and API share an origin, so there is no CORS preflight to get
// wrong and no CLIENT_URL to keep in step with a second deployment's URL.
//
// tourgenie-server/api/index.js is the same file for the two-project layout,
// where the server is deployed on its own. Both exist; whichever vercel.json
// is in force decides which one is used.
// No dotenv here, deliberately. This file sits at the repository root, where
// there is no node_modules to resolve it from, and it would buy nothing:
// Vercel puts the project's environment variables straight into process.env.
// The local entry points (server.js and tourgenie-server/api/index.js) still
// load .env, because there the file is how the values arrive.
import app from "../tourgenie-server/src/app.js";
import { connectDB } from "../tourgenie-server/src/config/db.js";

let ready = null;

// A process connects once at boot; a function has no boot, so it connects on
// the first request a container handles and reuses that connection after.
// Cleared on failure, so one transient Atlas outage cannot leave a container
// permanently holding a rejected promise.
function ensureDb() {
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
