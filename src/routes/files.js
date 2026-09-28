// Datei-Uploads nach R2 und Auslieferung der Dateien.
import { AwsClient } from "aws4fetch";
import { add, json, safeFilename } from "../lib.js";

add("POST", "/api/upload-url", async ({ env, body }) => {
  const data = await body();
  const key = Date.now() + "-" + Math.random().toString(36).substring(2, 8) + "-" + safeFilename(data.filename);
  const publicUrl = "/files/" + key;

  // Ohne R2-Zugangsdaten (z.B. lokale Entwicklung) läuft der Upload über den Worker selbst.
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID || !env.R2_BUCKET_NAME) {
    return json({ uploadUrl: "/api/dev-upload/" + encodeURIComponent(key), key, publicUrl });
  }

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const r2Url = "https://" + env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com/" + env.R2_BUCKET_NAME + "/" + key;
  const signed = await client.sign(r2Url, {
    method: "PUT",
    headers: data.contentType ? { "Content-Type": data.contentType } : {},
    aws: { signQuery: true },
  });
  return json({ uploadUrl: signed.url, key, publicUrl });
}, { admin: true });

add("PUT", "/api/dev-upload/:key", async ({ env, params, request }) => {
  await env.BUCKET.put(decodeURIComponent(params.key), request.body, {
    httpMetadata: { contentType: request.headers.get("Content-Type") || "application/octet-stream" },
  });
  return json({ ok: true });
}, { admin: true });

// Dateien aus R2, mit Range-Unterstützung (Safari braucht das für Video und Audio).
export async function serveFile(request, env, key) {
  const object = await env.BUCKET.get(key, { range: request.headers });
  if (!object) return new Response("Nicht gefunden", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  let status = 200;
  const range = request.headers.has("Range") ? object.range : undefined;
  if (range) {
    let start, end;
    if (range.suffix !== undefined) { start = object.size - range.suffix; end = object.size - 1; }
    else { start = range.offset || 0; end = range.length !== undefined ? start + range.length - 1 : object.size - 1; }
    headers.set("Content-Range", "bytes " + start + "-" + end + "/" + object.size);
    status = 206;
  }
  return new Response(object.body, { status, headers });
}
