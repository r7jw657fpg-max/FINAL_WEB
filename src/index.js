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

    if (url.pathname === "/api/upload") {
      if (!isAuthenticated(request, env)) return requireAuth();
      if (method !== "POST") return new Response("Method not allowed", { status: 405 });

      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return json({ error: "Keine Datei erhalten" }, 400);

      const key = Date.now() + "-" + Math.random().toString(36).substring(2, 8) + "-" + file.name;
      await env.BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      return json({ url: "/files/" + key });
    }

    if (url.pathname.startsWith("/files/")) {
      const key = decodeURIComponent(url.pathname.replace("/files/", ""));
      const object = await env.BUCKET.get(key);
      if (!object) return new Response("Nicht gefunden", { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);

      return new Response(object.body, { headers });
    }

    /* ===== POINTS (Lost and Found / Commission / Scan) ===== */

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
          "INSERT INTO points (id, title, lng, lat, type, route_id, visible, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          pointId, body.title || "Neues Objekt",
          body.lng, body.lat,
          body.type || "lost_and_found",
          body.route_id || null,
          body.visible === false ? 0 : 1, new Date().toISOString()
        ).run();
        return json({ id: pointId }, 201);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname.startsWith("/api/points/") && !url.pathname.includes("/entries")) {
      const pointId = url.pathname.split("/api/points/")[1];

      if (method === "PUT") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE points SET title=?, lng=?, lat=?, type=?, route_id=?, visible=?, updated_at=? WHERE id=?"
        ).bind(
          body.title || "", body.lng, body.lat,
          body.type || "lost_and_found", body.route_id || null,
          body.visible === false ? 0 : 1, new Date().toISOString(), pointId
        ).run();
        return json({ ok: true });
      }

      if (method === "DELETE") {
        if (!isAuthenticated(request, env)) return requireAuth();
        await env.DB.prepare("DELETE FROM point_entries WHERE point_id = ?").bind(pointId).run();
        await env.DB.prepare("DELETE FROM points WHERE id = ?").bind(pointId).run();
        return json({ ok: true });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    /* ===== POINT ENTRIES (Fotos + Notizen je Objekt) ===== */

    if (url.pathname.match(/^\/api\/points\/[^/]+\/entries$/)) {
      const pointId = url.pathname.split("/")[3];

      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM point_entries WHERE point_id = ? ORDER BY created_at").bind(pointId).all();
        return json(results);
      }
      if (method === "POST") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        const entryId = newId("entry");
        await env.DB.prepare(
          "INSERT INTO point_entries (id, point_id, image_url, note, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(entryId, pointId, body.image_url || "", body.note || "", new Date().toISOString()).run();
        return json({ id: entryId }, 201);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname.startsWith("/api/entries/")) {
      const entryId = url.pathname.split("/api/entries/")[1];

      if (method === "DELETE") {
        if (!isAuthenticated(request, env)) return requireAuth();
        await env.DB.prepare("DELETE FROM point_entries WHERE id = ?").bind(entryId).run();
        return json({ ok: true });
      }
      if (method === "PUT") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        await env.DB.prepare("UPDATE point_entries SET image_url=?, note=? WHERE id=?")
          .bind(body.image_url || "", body.note || "", entryId).run();
        return json({ ok: true });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    /* ===== ROUTES (Traces) ===== */

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
          "INSERT INTO routes (id, name, color, width, coordinates, visible, updated_at, duration_minutes, distance_km, notes, video_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          routeId, body.name || "Trace", body.color || "#ff453a",
          Number(body.width || 5), (typeof body.coordinates === "string" ? body.coordinates : JSON.stringify(body.coordinates || [])),
          body.visible === false ? 0 : 1, new Date().toISOString(),
          body.duration_minutes || null, body.distance_km || null,
          body.notes || "", body.video_url || ""
        ).run();
        return json({ id: routeId }, 201);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname.match(/^\/api\/routes\/[^/]+\/steps$/)) {
      const routeId = url.pathname.split("/")[3];

      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM trace_steps WHERE route_id = ? ORDER BY position").bind(routeId).all();
        return json(results);
      }
      if (method === "POST") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        const stepId = newId("step");
        const { results } = await env.DB.prepare("SELECT MAX(position) as maxPos FROM trace_steps WHERE route_id = ?").bind(routeId).all();
        const nextPos = (results[0].maxPos === null ? -1 : results[0].maxPos) + 1;
        await env.DB.prepare(
          "INSERT INTO trace_steps (id, route_id, position, media_type, media_url, text_overlay, audio_url, transition, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          stepId, routeId, nextPos, body.media_type || "image", body.media_url || "",
          body.text_overlay || "", body.audio_url || "", body.transition || "cut",
          new Date().toISOString()
        ).run();
        return json({ id: stepId, position: nextPos }, 201);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/steps/reorder") {
      if (!isAuthenticated(request, env)) return requireAuth();
      if (method !== "POST") return new Response("Method not allowed", { status: 405 });
      const body = await request.json();
      for (const item of body.order) {
        await env.DB.prepare("UPDATE trace_steps SET position = ? WHERE id = ?").bind(item.position, item.id).run();
      }
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/api/steps/")) {
      const stepId = url.pathname.split("/api/steps/")[1];

      if (method === "PUT") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE trace_steps SET media_type=?, media_url=?, text_overlay=?, audio_url=?, transition=? WHERE id=?"
        ).bind(
          body.media_type || "image", body.media_url || "", body.text_overlay || "",
          body.audio_url || "", body.transition || "cut", stepId
        ).run();
        return json({ ok: true });
      }
      if (method === "DELETE") {
        if (!isAuthenticated(request, env)) return requireAuth();
        await env.DB.prepare("DELETE FROM trace_steps WHERE id = ?").bind(stepId).run();
        return json({ ok: true });
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname.startsWith("/api/routes/")) {
      const routeId = url.pathname.split("/api/routes/")[1];

      if (method === "PUT") {
        if (!isAuthenticated(request, env)) return requireAuth();
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE routes SET name=?, color=?, width=?, coordinates=?, visible=?, updated_at=?, duration_minutes=?, distance_km=?, notes=?, video_url=? WHERE id=?"
        ).bind(
          body.name || "", body.color || "#ff453a", Number(body.width || 5),
          (typeof body.coordinates === "string" ? body.coordinates : JSON.stringify(body.coordinates || [])),
          body.visible === false ? 0 : 1, new Date().toISOString(),
          body.duration_minutes || null, body.distance_km || null,
          body.notes || "", body.video_url || "", routeId
        ).run();
        return json({ ok: true });
      }

      if (method === "DELETE") {
        if (!isAuthenticated(request, env)) return requireAuth();
        await env.DB.prepare("DELETE FROM trace_steps WHERE route_id = ?").bind(routeId).run();
        await env.DB.prepare("DELETE FROM routes WHERE id = ?").bind(routeId).run();
        return json({ ok: true });
      }

      return new Response("Method not allowed", { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
