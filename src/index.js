// Einstieg des Workers: Admin-Schutz, Dateien, Trace-Seite, API-Routen, statische Seiten.
import { routes, json } from "./lib.js";
import { isAuthenticated, unauthorized } from "./auth.js";
import { serveFile } from "./routes/files.js";
import "./routes/settings.js";
import "./routes/traces.js";
import "./routes/points.js";
import "./routes/media.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const isAdmin = isAuthenticated(request, env);

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      if (!isAdmin) return unauthorized();
      return env.ASSETS.fetch(request);
    }

    if (url.pathname.startsWith("/files/") && method === "GET") {
      return serveFile(request, env, decodeURIComponent(url.pathname.slice("/files/".length)));
    }

    // Eigene URL pro Look: /trace/<id> liefert die Trace-Seite, die ID liest sie selbst aus dem Pfad.
    if (url.pathname.startsWith("/trace/") && method === "GET") {
      return env.ASSETS.fetch(new Request(new URL("/trace", url), request));
    }

    for (const route of routes) {
      if (route.method !== method) continue;
      const match = url.pathname.match(route.re);
      if (!match) continue;
      if (route.admin && !isAdmin) return unauthorized();
      try {
        return await route.handler({
          request, env, url, isAdmin,
          params: match.groups || {},
          body: () => request.json(),
        });
      } catch (err) {
        return json({ error: String((err && err.message) || err) }, 500);
      }
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "Nicht gefunden" }, 404);
    return env.ASSETS.fetch(request);
  },
};
