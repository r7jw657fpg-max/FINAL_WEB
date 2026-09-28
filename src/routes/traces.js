// Looks (= Traces): Landing-Page-Liste und die Trace-Seite mit Punkten und Medien.
import { add, json, newId, nextSortOrder, reorderStatements, str } from "../lib.js";
import { unauthorized } from "../auth.js";

add("GET", "/api/traces", async ({ env, url, isAdmin }) => {
  const all = url.searchParams.get("all") === "1";
  if (all && !isAdmin) return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT * FROM traces" + (all ? "" : " WHERE visible = 1") + " ORDER BY sort_order, created_at"
  ).all();
  return json(results);
});

// Neue Looks starten unsichtbar, bis sie im Admin freigegeben werden.
add("POST", "/api/traces", async ({ env, body }) => {
  const data = await body();
  const id = newId("trace");
  const sortOrder = await nextSortOrder(env, "traces");
  await env.DB.prepare(
    "INSERT INTO traces (id, title, look_image_url, sort_order, visible, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).bind(id, str(data.title, "New look"), str(data.look_image_url), sortOrder, new Date().toISOString()).run();
  return json({ id }, 201);
}, { admin: true });

add("POST", "/api/traces/reorder", async ({ env, body }) => {
  const { ids } = await body();
  await env.DB.batch(reorderStatements(env, "traces", ids));
  return json({ ok: true });
}, { admin: true });

// Ein Trace samt Punkten und deren Medien — die Trace-Seite braucht alles auf einmal.
add("GET", "/api/traces/:id", async ({ env, params, url, isAdmin }) => {
  const asAdmin = url.searchParams.get("admin") === "1";
  if (asAdmin && !isAdmin) return unauthorized();
  const trace = await env.DB.prepare("SELECT * FROM traces WHERE id = ?").bind(params.id).first();
  if (!trace || (!trace.visible && !asAdmin)) return json({ error: "Nicht gefunden" }, 404);

  const { results: points } = await env.DB.prepare(
    "SELECT p.*, (SELECT COUNT(*) FROM workshop_entries w WHERE w.point_id = p.id) AS workshop_count " +
    "FROM points p WHERE p.trace_id = ? " +
    "ORDER BY CASE p.category WHEN 'commission' THEN 0 ELSE 1 END, p.sort_order, p.created_at"
  ).bind(params.id).all();
  const { results: media } = await env.DB.prepare(
    "SELECT m.* FROM point_media m JOIN points p ON p.id = m.point_id WHERE p.trace_id = ? ORDER BY m.sort_order, m.created_at"
  ).bind(params.id).all();

  const { results: links } = await env.DB.prepare(
    "SELECT * FROM point_links WHERE point_a IN (SELECT id FROM points WHERE trace_id = ?) ORDER BY created_at"
  ).bind(params.id).all();

  const byPoint = {};
  media.forEach(m => { (byPoint[m.point_id] = byPoint[m.point_id] || []).push(m); });
  points.forEach(p => { p.media = byPoint[p.id] || []; p.links = []; });

  // Ein Link gilt für beide Seiten: an beiden Punkten mit dem jeweils anderen als Ziel.
  const pointById = Object.fromEntries(points.map(p => [p.id, p]));
  links.forEach(link => {
    if (pointById[link.point_a]) pointById[link.point_a].links.push({ id: link.id, point_id: link.point_b, note: link.note });
    if (pointById[link.point_b]) pointById[link.point_b].links.push({ id: link.id, point_id: link.point_a, note: link.note });
  });
  return json({ ...trace, points });
});

add("PUT", "/api/traces/:id", async ({ env, params, body }) => {
  const data = await body();
  const existing = await env.DB.prepare("SELECT * FROM traces WHERE id = ?").bind(params.id).first();
  if (!existing) return json({ error: "Nicht gefunden" }, 404);
  await env.DB.prepare("UPDATE traces SET title = ?, look_image_url = ?, visible = ? WHERE id = ?").bind(
    str(data.title, existing.title),
    str(data.look_image_url, existing.look_image_url),
    data.visible === undefined ? existing.visible : (data.visible ? 1 : 0),
    params.id
  ).run();
  return json({ ok: true });
}, { admin: true });

add("DELETE", "/api/traces/:id", async ({ env, params }) => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM point_links WHERE point_a IN (SELECT id FROM points WHERE trace_id = ?) OR point_b IN (SELECT id FROM points WHERE trace_id = ?)").bind(params.id, params.id),
    env.DB.prepare("DELETE FROM workshop_entries WHERE point_id IN (SELECT id FROM points WHERE trace_id = ?)").bind(params.id),
    env.DB.prepare("DELETE FROM point_media WHERE point_id IN (SELECT id FROM points WHERE trace_id = ?)").bind(params.id),
    env.DB.prepare("DELETE FROM points WHERE trace_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM traces WHERE id = ?").bind(params.id),
  ]);
  return json({ ok: true });
}, { admin: true });
