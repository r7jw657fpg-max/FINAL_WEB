import { AwsClient } from "aws4fetch";

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

// Gibt eine 401-Response zurück wenn nicht eingeloggt, sonst null.
function requireAdmin(request, env) {
  return isAuthenticated(request, env) ? null : requireAuth();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function methodNotAllowed() {
  return new Response("Method not allowed", { status: 405 });
}

function newId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      const authError = requireAdmin(request, env);
      if (authError) return authError;
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/upload-url") {
      const authError = requireAdmin(request, env);
      if (authError) return authError;
      if (method !== "POST") return methodNotAllowed();

      try {
        const body = await request.json();
        const key = Date.now() + "-" + Math.random().toString(36).substring(2, 8) + "-" + (body.filename || "file");

        const missing = [];
        if (!env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
        if (!env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
        if (!env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
        if (!env.R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");
        if (missing.length > 0) {
          return json({ error: "Fehlende R2-Umgebungsvariable(n): " + missing.join(", ") }, 500);
        }

        const client = new AwsClient({
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          service: "s3",
          region: "auto"
        });

        const r2Url = "https://" + env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com/" + env.R2_BUCKET_NAME + "/" + key;
        const signed = await client.sign(r2Url, {
          method: "PUT",
          headers: body.contentType ? { "Content-Type": body.contentType } : {},
          aws: { signQuery: true }
        });

        return json({ uploadUrl: signed.url, key: key, publicUrl: "/files/" + key });
      } catch (err) {
        return json({ error: String((err && err.message) || err) }, 500);
      }
    }

    if (url.pathname.startsWith("/files/")) {
      const key = decodeURIComponent(url.pathname.replace("/files/", ""));
      const object = await env.BUCKET.get(key);
      if (!object) return new Response("Nicht gefunden", { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");

      return new Response(object.body, { headers });
    }

    /* ===== ROUTES (Traces) ===== */

    if (url.pathname === "/api/routes") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM routes").all();
        return json(results);
      }
      if (method === "POST") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
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
      return methodNotAllowed();
    }

    if (url.pathname.match(/^\/api\/routes\/[^/]+\/steps$/)) {
      const routeId = url.pathname.split("/")[3];

      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM trace_steps WHERE route_id = ? ORDER BY position").bind(routeId).all();
        return json(results);
      }
      if (method === "POST") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
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
      return methodNotAllowed();
    }

    if (url.pathname === "/api/steps/reorder") {
      const authError = requireAdmin(request, env);
      if (authError) return authError;
      if (method !== "POST") return methodNotAllowed();
      const body = await request.json();
      for (const item of body.order) {
        await env.DB.prepare("UPDATE trace_steps SET position = ? WHERE id = ?").bind(item.position, item.id).run();
      }
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/api/steps/") && !url.pathname.includes("/items") && !url.pathname.includes("/process")) {
      const stepId = url.pathname.split("/api/steps/")[1];

      if (method === "PUT") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        const body = await request.json();
        await env.DB.prepare(
          "UPDATE trace_steps SET media_type=?, media_url=?, text_overlay=?, audio_url=?, transition=?, category=?, lng=?, lat=?, item_comment=? WHERE id=?"
        ).bind(
          body.media_type || "image", body.media_url || "", body.text_overlay || "",
          body.audio_url || "", body.transition || "cut", body.category || "weg",
          body.lng || null, body.lat || null, body.item_comment || "", stepId
        ).run();
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        await env.DB.prepare("DELETE FROM trace_steps WHERE id = ?").bind(stepId).run();
        return json({ ok: true });
      }
      return methodNotAllowed();
    }

    if (url.pathname.startsWith("/api/routes/")) {
      const routeId = url.pathname.split("/api/routes/")[1];

      if (method === "PUT") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
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
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        await env.DB.prepare("DELETE FROM trace_steps WHERE route_id = ?").bind(routeId).run();
        await env.DB.prepare("DELETE FROM routes WHERE id = ?").bind(routeId).run();
        return json({ ok: true });
      }

      return methodNotAllowed();
    }

    if (url.pathname.startsWith("/api/settings/")) {
      const key = url.pathname.split("/api/settings/")[1];

      if (method === "GET") {
        const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
        return json({ key, value: row ? row.value : "" });
      }
      if (method === "PUT") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        const body = await request.json();
        await env.DB.prepare(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        ).bind(key, body.value || "").run();
        return json({ ok: true });
      }
      return methodNotAllowed();
    }

    if (url.pathname.match(/^\/api\/steps\/[^/]+\/items$/)) {
      const stepId = url.pathname.split("/")[3];
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM step_items WHERE step_id = ? ORDER BY created_at").bind(stepId).all();
        return json(results);
      }
      if (method === "POST") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        const body = await request.json();
        const itemId = newId("item");
        await env.DB.prepare(
          "INSERT INTO step_items (id, step_id, image_url, note, created_at, category, cutout_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(itemId, stepId, body.image_url || "", body.note || "", new Date().toISOString(), body.category || "", body.cutout_url || "").run();
        return json({ id: itemId }, 201);
      }
      return methodNotAllowed();
    }

    if (url.pathname.startsWith("/api/items/")) {
      const itemId = url.pathname.split("/api/items/")[1];
      if (method === "DELETE") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        await env.DB.prepare("DELETE FROM step_items WHERE id = ?").bind(itemId).run();
        return json({ ok: true });
      }
      if (method === "PUT") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        const body = await request.json();
        await env.DB.prepare("UPDATE step_items SET image_url=?, note=?, category=?, cutout_url=? WHERE id=?")
          .bind(body.image_url || "", body.note || "", body.category || "", body.cutout_url || "", itemId).run();
        return json({ ok: true });
      }
      return methodNotAllowed();
    }

    /* ===== WERKSTATT: Prozessfotos zu einem Lost&Found-3D-Scan-Schritt ===== */

    if (url.pathname.match(/^\/api\/steps\/[^/]+\/process$/)) {
      const stepId = url.pathname.split("/")[3];
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM process_entries WHERE step_id = ? ORDER BY created_at").bind(stepId).all();
        return json(results);
      }
      if (method === "POST") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        const body = await request.json();
        const entryId = newId("process");
        await env.DB.prepare(
          "INSERT INTO process_entries (id, step_id, image_url, caption, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(entryId, stepId, body.image_url || "", body.caption || "", body.x || 0.5, body.y || 0.5, new Date().toISOString()).run();
        return json({ id: entryId }, 201);
      }
      return methodNotAllowed();
    }

    if (url.pathname.startsWith("/api/process/")) {
      const entryId = url.pathname.split("/api/process/")[1];
      if (method === "DELETE") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        await env.DB.prepare("DELETE FROM process_entries WHERE id = ?").bind(entryId).run();
        return json({ ok: true });
      }
      if (method === "PUT") {
        const authError = requireAdmin(request, env);
        if (authError) return authError;
        const body = await request.json();
        await env.DB.prepare("UPDATE process_entries SET image_url=?, caption=?, x=?, y=? WHERE id=?")
          .bind(body.image_url || "", body.caption || "", body.x || 0.5, body.y || 0.5, entryId).run();
        return json({ ok: true });
      }
      return methodNotAllowed();
    }

    return env.ASSETS.fetch(request);
  },
};
