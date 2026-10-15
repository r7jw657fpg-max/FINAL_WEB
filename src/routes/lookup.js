// Trace-ID-Suche: Die Trace-ID eines Kleidungsstücks ist die GPS-Nummer seines Fundorts
// ("47.37810, 8.54620"). Eingaben mit Komma/Punkt, Leerzeichen oder Semikolon werden toleriert.
import { add, json } from "../lib.js";

// ~30 m Spielraum, damit auf wenige Nachkommastellen gerundete Eingaben noch treffen.
const TOLERANCE = 0.0003;

function parseNumbers(input) {
  const numbers = (String(input).match(/-?\d{1,3}(?:[.,]\d+)?/g) || []).map(n => Number(n.replace(",", ".")));
  return numbers.length >= 2 ? numbers.slice(0, 2) : null;
}

async function findPoint(env, lat, lng, isAdmin) {
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const { results } = await env.DB.prepare(
    "SELECT p.id, p.trace_id, p.lat, p.lng FROM points p JOIN traces t ON t.id = p.trace_id " +
    "WHERE (t.visible = 1 OR ?) AND ABS(p.lat - ?) < ? AND ABS(p.lng - ?) < ?"
  ).bind(isAdmin ? 1 : 0, lat, TOLERANCE, lng, TOLERANCE).all();
  const distance = (p) => Math.abs(p.lat - lat) + Math.abs(p.lng - lng);
  return results.sort((a, b) => distance(a) - distance(b))[0] || null;
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
