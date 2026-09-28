// Seiteneinstellungen: Intro-Text, Logo und Hintergrundbild der Landing Page.
import { add, json, str } from "../lib.js";

const SETTING_KEYS = ["intro", "logo_url", "background_url"];

add("GET", "/api/settings", async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const out = {};
  SETTING_KEYS.forEach(key => { out[key] = ""; });
  results.forEach(row => { if (SETTING_KEYS.includes(row.key)) out[row.key] = row.value || ""; });
  return json(out);
});

add("PUT", "/api/settings/:key", async ({ env, params, body }) => {
  if (!SETTING_KEYS.includes(params.key)) return json({ error: "Unbekannter Schlüssel" }, 400);
  const data = await body();
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(params.key, str(data.value)).run();
  return json({ ok: true });
}, { admin: true });
