// Gemeinsame Helfer und der kleine Router für den Worker.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function newId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);
}

export function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function str(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function safeFilename(name) {
  return String(name || "file").replace(/[^\w.\-]+/g, "_").slice(-80);
}

// Nächste sort_order für eine Tabelle, optional gefiltert nach einer Spalte.
export async function nextSortOrder(env, table, column, value) {
  const { results } = await env.DB.prepare(
    "SELECT MAX(sort_order) AS m FROM " + table + (column ? " WHERE " + column + " = ?" : "")
  ).bind(...(column ? [value] : [])).all();
  return (results[0].m === null ? -1 : results[0].m) + 1;
}

// Setzt sort_order = Position in der übergebenen ID-Liste.
export function reorderStatements(env, table, ids, scopeColumn, scopeValue) {
  return ids.map((id, index) => scopeColumn
    ? env.DB.prepare("UPDATE " + table + " SET sort_order = ? WHERE id = ? AND " + scopeColumn + " = ?").bind(index, id, scopeValue)
    : env.DB.prepare("UPDATE " + table + " SET sort_order = ? WHERE id = ?").bind(index, id));
}

/* ===== Router ===== */

export const routes = [];

// Pfad-Muster wie "/api/points/:id/media" — :name matcht genau ein Segment.
export function add(method, pattern, handler, { admin = false } = {}) {
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$");
  routes.push({ method, re, handler, admin });
}
