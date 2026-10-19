// Lost-&-Found-Fundorte in weiteren Looks einbinden (ein Datensatz, Änderungen gelten überall).
import { add, json, str } from "../lib.js";
import { nextPointOrder } from "./points.js";

// Fundorte anderer Looks, die in diesem Look noch fehlen (für die Auswahl im Admin).
add("GET", "/api/shareable", async ({ env, url }) => {
  const traceId = url.searchParams.get("trace_id") || "";
  const { results } = await env.DB.prepare(
    "SELECT p.id, p.title, p.lat, p.lng, t.id AS home_trace_id, t.title AS home_title, " +
    "(SELECT m.url FROM point_media m WHERE m.point_id = p.id AND m.kind = 'image' ORDER BY m.sort_order LIMIT 1) AS thumb " +
    "FROM points p JOIN traces t ON t.id = p.trace_id " +
    "WHERE p.category = 'lost_and_found' AND p.trace_id != ? " +
    "AND p.id NOT IN (SELECT point_id FROM trace_point_refs WHERE trace_id = ?) " +
    "ORDER BY t.sort_order, p.sort_order"
  ).bind(traceId, traceId).all();
  return json(results);
}, { admin: true });

add("POST", "/api/traces/:id/shared", async ({ env, params, body }) => {
  const data = await body();
  const pointId = str(data.point_id);
  const point = await env.DB.prepare("SELECT id, trace_id, category FROM points WHERE id = ?").bind(pointId).first();
  const trace = await env.DB.prepare("SELECT id FROM traces WHERE id = ?").bind(params.id).first();
  if (!point || !trace) return json({ error: "Nicht gefunden" }, 404);
  if (point.category !== "lost_and_found") return json({ error: "Nur Lost-&-Found-Punkte können in mehreren Looks vorkommen." }, 400);
  if (point.trace_id === params.id) return json({ error: "Dieser Punkt gehört schon zu diesem Look." }, 409);

  const existing = await env.DB.prepare("SELECT 1 AS x FROM trace_point_refs WHERE trace_id = ? AND point_id = ?").bind(params.id, pointId).first();
  if (existing) return json({ error: "Dieser Punkt ist schon eingebunden." }, 409);

  const sortOrder = await nextPointOrder(env, params.id);
  await env.DB.prepare(
    "INSERT INTO trace_point_refs (trace_id, point_id, sort_order, created_at) VALUES (?, ?, ?, ?)"
  ).bind(params.id, pointId, sortOrder, new Date().toISOString()).run();
  return json({ ok: true, sort_order: sortOrder }, 201);
}, { admin: true });

// Entfernt den Punkt nur aus diesem Look; der Punkt selbst und seine anderen Looks bleiben.
add("DELETE", "/api/traces/:id/shared/:pointId", async ({ env, params }) => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM trace_point_refs WHERE trace_id = ? AND point_id = ?").bind(params.id, params.pointId),
    // Die eigenen Änderungen dieses Looks am Punkt gehen mit.
    env.DB.prepare("DELETE FROM workshop_entries WHERE point_id = ? AND trace_id = ?").bind(params.pointId, params.id),
    // Verlinkungen zu Punkten, die nur in diesem Look liegen, gelten ohne den Punkt nicht mehr.
    env.DB.prepare(
      "DELETE FROM point_links WHERE (point_a = ? AND point_b IN (SELECT id FROM points WHERE trace_id = ?)) " +
      "OR (point_b = ? AND point_a IN (SELECT id FROM points WHERE trace_id = ?))"
    ).bind(params.pointId, params.id, params.pointId, params.id),
  ]);
  return json({ ok: true });
}, { admin: true });
