// Punkte auf der Karte eines Traces. Pro Trace gibt es genau einen Commission-Startpunkt.
import { add, json, newId, nextSortOrder, num, reorderStatements, str } from "../lib.js";

const POINT_CATEGORIES = ["commission", "lost_and_found", "scan"];
const COMMISSION_TAKEN = { error: "Dieser Trace hat schon einen Commission-Startpunkt." };

async function commissionTaken(env, traceId, exceptPointId) {
  const row = await env.DB.prepare(
    "SELECT id FROM points WHERE trace_id = ? AND category = 'commission' AND id != ?"
  ).bind(traceId, exceptPointId || "").first();
  return !!row;
}

add("POST", "/api/traces/:id/points", async ({ env, params, body }) => {
  const data = await body();
  const category = str(data.category);
  if (!POINT_CATEGORIES.includes(category)) return json({ error: "Ungültige Kategorie" }, 400);
  const lng = num(data.lng, null), lat = num(data.lat, null);
  if (lng === null || lat === null) return json({ error: "lng/lat fehlen" }, 400);
  if (category === "commission" && await commissionTaken(env, params.id)) return json(COMMISSION_TAKEN, 409);

  const id = newId("point");
  const sortOrder = await nextSortOrder(env, "points", "trace_id", params.id);
  await env.DB.prepare(
    "INSERT INTO points (id, trace_id, category, title, text, item_comment, lng, lat, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, params.id, category, str(data.title), str(data.text), str(data.item_comment), lng, lat, sortOrder, new Date().toISOString()).run();
  return json({ id, sort_order: sortOrder }, 201);
}, { admin: true });

add("POST", "/api/traces/:id/points/reorder", async ({ env, params, body }) => {
  const { ids } = await body();
  await env.DB.batch(reorderStatements(env, "points", ids, "trace_id", params.id));
  return json({ ok: true });
}, { admin: true });

add("PUT", "/api/points/:id", async ({ env, params, body }) => {
  const data = await body();
  const existing = await env.DB.prepare("SELECT * FROM points WHERE id = ?").bind(params.id).first();
  if (!existing) return json({ error: "Nicht gefunden" }, 404);
  const category = data.category === undefined ? existing.category : str(data.category);
  if (!POINT_CATEGORIES.includes(category)) return json({ error: "Ungültige Kategorie" }, 400);
  if (category === "commission" && await commissionTaken(env, existing.trace_id, params.id)) return json(COMMISSION_TAKEN, 409);

  await env.DB.prepare(
    "UPDATE points SET category = ?, title = ?, text = ?, item_comment = ?, lng = ?, lat = ? WHERE id = ?"
  ).bind(
    category, str(data.title, existing.title), str(data.text, existing.text), str(data.item_comment, existing.item_comment),
    num(data.lng, existing.lng), num(data.lat, existing.lat), params.id
  ).run();
  return json({ ok: true });
}, { admin: true });

add("DELETE", "/api/points/:id", async ({ env, params }) => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM point_links WHERE point_a = ? OR point_b = ?").bind(params.id, params.id),
    env.DB.prepare("DELETE FROM workshop_entries WHERE point_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM point_media WHERE point_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM points WHERE id = ?").bind(params.id),
  ]);
  return json({ ok: true });
}, { admin: true });
