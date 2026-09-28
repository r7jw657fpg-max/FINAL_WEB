// Medien eines Punkts (Bild, Video, 3D-Modell, Audio) und Werkstatt-Fotos.
import { add, json, newId, nextSortOrder, num, reorderStatements, str } from "../lib.js";

const MEDIA_KINDS = ["image", "video", "model", "audio"];
const WORKSHOP_KINDS = ["raw", "change"];

add("POST", "/api/points/:id/media", async ({ env, params, body }) => {
  const data = await body();
  const kind = str(data.kind);
  if (!MEDIA_KINDS.includes(kind) || !str(data.url)) return json({ error: "kind/url ungültig" }, 400);
  const id = newId("media");
  const sortOrder = await nextSortOrder(env, "point_media", "point_id", params.id);
  await env.DB.prepare(
    "INSERT INTO point_media (id, point_id, kind, url, caption, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, params.id, kind, data.url, str(data.caption), sortOrder, new Date().toISOString()).run();
  return json({ id, sort_order: sortOrder }, 201);
}, { admin: true });

add("POST", "/api/points/:id/media/reorder", async ({ env, params, body }) => {
  const { ids } = await body();
  await env.DB.batch(reorderStatements(env, "point_media", ids, "point_id", params.id));
  return json({ ok: true });
}, { admin: true });

add("PUT", "/api/media/:id", async ({ env, params, body }) => {
  const data = await body();
  await env.DB.prepare("UPDATE point_media SET caption = ? WHERE id = ?").bind(str(data.caption), params.id).run();
  return json({ ok: true });
}, { admin: true });

add("DELETE", "/api/media/:id", async ({ env, params }) => {
  await env.DB.prepare("DELETE FROM point_media WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}, { admin: true });

add("GET", "/api/points/:id/workshop", async ({ env, params }) => {
  const { results } = await env.DB.prepare(
    "SELECT * FROM workshop_entries WHERE point_id = ? ORDER BY created_at"
  ).bind(params.id).all();
  return json(results);
});

add("POST", "/api/points/:id/workshop", async ({ env, params, body }) => {
  const data = await body();
  const kind = WORKSHOP_KINDS.includes(data.kind) ? data.kind : "change";
  const id = newId("workshop");
  await env.DB.prepare(
    "INSERT INTO workshop_entries (id, point_id, kind, image_url, caption, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, params.id, kind, str(data.image_url), str(data.caption), num(data.x, 0.5), num(data.y, 0.5), new Date().toISOString()).run();
  return json({ id }, 201);
}, { admin: true });

add("PUT", "/api/workshop/:id", async ({ env, params, body }) => {
  const data = await body();
  const existing = await env.DB.prepare("SELECT * FROM workshop_entries WHERE id = ?").bind(params.id).first();
  if (!existing) return json({ error: "Nicht gefunden" }, 404);
  await env.DB.prepare("UPDATE workshop_entries SET caption = ?, x = ?, y = ? WHERE id = ?").bind(
    str(data.caption, existing.caption), num(data.x, existing.x), num(data.y, existing.y), params.id
  ).run();
  return json({ ok: true });
}, { admin: true });

add("DELETE", "/api/workshop/:id", async ({ env, params }) => {
  await env.DB.prepare("DELETE FROM workshop_entries WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}, { admin: true });
