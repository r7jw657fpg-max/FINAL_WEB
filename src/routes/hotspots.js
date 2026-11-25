// Hotspots auf dem Look-Foto: pro Look und Piece ein Punkt. Der Admin speichert alle Positionen eines Looks auf einmal.
import { add, json, num } from "../lib.js";

add("PUT", "/api/traces/:id/hotspots", async ({ env, params, body }) => {
  const data = await body();
  const spots = data && typeof data.spots === "object" && data.spots ? data.spots : {};
  const trace = await env.DB.prepare("SELECT id FROM traces WHERE id = ?").bind(params.id).first();
  if (!trace) return json({ error: "Nicht gefunden" }, 404);

  // Nur Pieces, die im Look vorkommen (eigene oder eingebundene).
  const { results } = await env.DB.prepare(
    "SELECT id FROM points WHERE trace_id = ? UNION SELECT point_id FROM trace_point_refs WHERE trace_id = ?"
  ).bind(params.id, params.id).all();
  const allowed = new Set(results.map(r => r.id));

  const rows = Object.entries(spots)
    .filter(([pointId]) => allowed.has(pointId))
    .map(([pointId, s]) => ({ pointId, x: Math.max(0, Math.min(100, num(s && s.x, 50))), y: Math.max(0, Math.min(100, num(s && s.y, 50))) }));

  await env.DB.batch([
    env.DB.prepare("DELETE FROM look_hotspots WHERE trace_id = ?").bind(params.id),
    ...rows.map(r => env.DB.prepare("INSERT INTO look_hotspots (trace_id, point_id, x, y) VALUES (?, ?, ?, ?)").bind(params.id, r.pointId, r.x, r.y)),
  ]);
  return json({ ok: true, saved: rows.length });
}, { admin: true });
