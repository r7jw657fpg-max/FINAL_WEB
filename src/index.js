function isAuthenticated(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const decoded = atob(encoded);
  const [, password] = decoded.split(":");
  return password === env.ADMIN_PASSWORD;
}

function requireAuth() {
  return new Response("Zugriff verweigert", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin Bereich"' },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function newId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      if (!isAuthenticated(request, env)) return requireAuth();
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/points") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM points").all();
        return json(results);
      }
      if (method === "POST") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        const pointId = newId("point");
        await env.DB.prepare(
          "INSERT INTO points (id, title, text, lng, lat, image_url, pdf_url, visible, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          pointId, body.title || "Neuer Punkt", body.text || "",
          body.lng, body.lat, body.image_url || "", body.pdf_url || "",
          body.visible === false ? 0 : 1, new Date().toISOString()
        ).run();
        return json({ id: pointId }, 201);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname.startsWith("/api/points/")) {
      const pointId = url.pathname.split("/api/points/")[1];

      if (method === "PUT") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE points SET title=?, text=?, lng=?, lat=?, image_url=?, pdf_url=?, visible=?, updated_at=? WHERE id=?"
        ).bind(
          body.title || "", body.text || "", body.lng, body.lat,
          body.image_url || "", body.pdf_url || "",
          body.visible === false ? 0 : 1, new Date().toISOString(), pointId
        ).run();
        return json({ ok: true });
      }

      if (method === "DELETE") {
        if (!isAuthenticated(request, env)) return requireAuth();
        await env.DB.prepare("DELETE FROM points WHERE id = ?").bind(pointId).run();
        return json({ ok: true });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/routes") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM routes").all();
        return json(results);
      }
      if (method === "POST") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        const routeId = newId("route");
        await env.DB.prepare(
          "INSERT INTO routes (id, name, color, width, coordinates, visible, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          routeId, body.name || "Route", body.color || "#ff453a",
          Number(body.width || 5), JSON.stringify(body.coordinates || []),
          body.visible === false ? 0 : 1, new Date().toISOString()
        ).run();
        return json({ id: routeId }, 201);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname.startsWith("/api/routes/")) {
      const routeId = url.pathname.split("/api/routes/")[1];

      if (method === "PUT") {
        if
