// Trace-ID-Suche: Die Trace-ID eines Kleidungsstücks ist die GPS-Nummer seines Fundorts
// ("47.37810, 8.54620"). Eingaben mit Komma/Punkt, Leerzeichen oder Semikolon werden toleriert.
import { add, json } from "../lib.js";

// ~30 m Spielraum, damit auf wenige Nachkommastellen gerundete Eingaben noch treffen.
const TOLERANCE = 0.0003;

function parseNumbers(input) {
  const numbers = (String(input).match(/-?\d{1,3}(?:[.,]\d+)?/g) || []).map(n => Number(n.replace(",", ".")));
  return numbers.length >= 2 ? numbers.slice(0, 2) : null;
}

// Der Look, in dem das Stück gezeigt wird: bevorzugt sein Ursprungs-Look, sonst ein Look, der es einbindet.
async function visibleTraceFor(env, point, isAdmin) {
  const row = await env.DB.prepare(
    "SELECT t.id FROM traces t WHERE (t.visible = 1 OR ?) " +
    "AND (t.id = ? OR t.id IN (SELECT trace_id FROM trace_point_refs WHERE point_id = ?)) " +
    "ORDER BY CASE WHEN t.id = ? THEN 0 ELSE 1 END, t.sort_order LIMIT 1"
  ).bind(isAdmin ? 1 : 0, point.trace_id, point.id, point.trace_id).first();
  return row ? row.id : null;
}

async function findPoint(env, lat, lng, isAdmin) {
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const { results } = await env.DB.prepare(
    "SELECT id, trace_id, lat, lng FROM points WHERE ABS(lat - ?) < ? AND ABS(lng - ?) < ?"
  ).bind(lat, TOLERANCE, lng, TOLERANCE).all();
  const distance = (p) => Math.abs(p.lat - lat) + Math.abs(p.lng - lng);
  for (const point of results.sort((a, b) => distance(a) - distance(b))) {
    const traceId = await visibleTraceFor(env, point, isAdmin);
    if (traceId) return { ...point, trace_id: traceId };
  }
  return null;
}

add("GET", "/api/lookup", async ({ env, url, isAdmin }) => {
  const numbers = parseNumbers(url.searchParams.get("id") || "");
  if (!numbers) return json({ error: "Please enter the GPS number, e.g. 47.37810, 8.54620." }, 400);

  // Reihenfolge Breite/Länge, sonst vertauscht (Länge/Breite) probieren.
  const [first, second] = numbers;
  const point = await findPoint(env, first, second, isAdmin) || await findPoint(env, second, first, isAdmin);
  if (!point) return json({ error: "No garment found for this Trace-ID." }, 404);
  return json({ trace_id: point.trace_id, point_id: point.id });
});
