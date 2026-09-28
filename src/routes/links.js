// Verlinkungen zwischen zwei Punkten desselben Traces, mit einer Begründung.
import { add, json, newId, str } from "../lib.js";

add("POST", "/api/points/:id/links", async ({ env, params, body }) => {
  const data = await body();
  const targetId = str(data.target_id);
  if (!targetId || targetId === params.id) return json({ error: "Ungültiger Ziel-Punkt" }, 400);

  const { results } = await env.DB.prepare("SELECT id, trace_id FROM points WHERE id IN (?, ?)").bind(params.id, targetId).all();
  if (results.length !== 2 || results[0].trace_id !== results[1].trace_id) {
    return json({ error: "Beide Punkte müssen im selben Trace liegen." }, 400);
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM point_links WHERE (point_a = ? AND point_b = ?) OR (point_a = ? AND point_b = ?)"
  ).bind(params.id, targetId, targetId, params.id).first();
  if (existing) return json({ error: "Diese Punkte sind schon verlinkt." }, 409);

  const id = newId("link");
  await env.DB.prepare(
    "INSERT INTO point_links (id, point_a, point_b, note, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, params.id, targetId, str(data.note), new Date().toISOString()).run();
  return json({ id }, 201);
}, { admin: true });

add("PUT", "/api/links/:id", async ({ env, params, body }) => {
  const data = await body();
  await env.DB.prepare("UPDATE point_links SET note = ? WHERE id = ?").bind(str(data.note), params.id).run();
  return json({ ok: true });
}, { admin: true });

add("DELETE", "/api/links/:id", async ({ env, params }) => {
  await env.DB.prepare("DELETE FROM point_links WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}, { admin: true });
