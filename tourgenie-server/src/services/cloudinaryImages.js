// Cloudinary image hosting — the last of the six integrations the proposal
// names, and the same shape as the other five: an enrichment path, never a
// dependency. With CLOUDINARY_* unset nothing here runs, every card renders
// its gradient fallback, and no feature is missing.
//
// Deliberately no `cloudinary` npm package. The signed upload endpoint is a
// multipart POST with a SHA-1 signature, and Node has fetch, FormData, Blob
// and crypto built in — a 60-line service is cheaper to audit than a
// dependency whose only job here is to build one request.
import crypto from "node:crypto";
import { trackProvider } from "./providerStatus.js";

const API_BASE = "https://api.cloudinary.com/v1_1";

export function isConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

// Cloudinary signs the alphabetically sorted parameter list, excluding the
// file itself, api_key and resource_type. Getting the sort or the exclusions
// wrong returns a 401 that says only "Invalid Signature", so the set of
// params signed here has to be exactly the set sent below.
function sign(params, secret) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(payload + secret).digest("hex");
}

/**
 * Uploads one image and returns its https URL.
 *
 * `publicId` is the catalogue slug, so re-running an upload replaces the
 * image rather than accumulating a second copy of the same beach — which is
 * also why `invalidate` is set: without it the CDN keeps serving the old
 * file under the unchanged URL.
 *
 * Throws on a failed upload. The caller is a script run by a person, so a
 * failure should be loud there; nothing in the request path calls this.
 */
export async function uploadPlaceImage(buffer, { publicId, folder = "tourgenie/places", filename = "" }) {
  if (!isConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in tourgenie-server/.env"
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { folder, invalidate: "true", overwrite: "true", public_id: publicId, timestamp };
  const signature = sign(signed, process.env.CLOUDINARY_API_SECRET);

  const form = new FormData();
  for (const [k, v] of Object.entries(signed)) form.append(k, String(v));
  form.append("api_key", process.env.CLOUDINARY_API_KEY);
  form.append("signature", signature);
  form.append("file", new Blob([buffer]), filename || `${publicId}.jpg`);

  return trackProvider("cloudinary", async () => {
    const res = await fetch(`${API_BASE}/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Cloudinary returned ${res.status}`);
    }
    return body.secure_url;
  });
}

export default { isConfigured, uploadPlaceImage };
