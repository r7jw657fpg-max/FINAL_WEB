// Admin-Zugang per HTTP Basic Auth; das Passwort steht im Worker-Secret ADMIN_PASSWORD.

export function isAuthenticated(request, env) {
  const header = request.headers.get("Authorization");
  if (!header || !env.ADMIN_PASSWORD) return false;
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  try {
    const decoded = atob(encoded);
    return decoded.slice(decoded.indexOf(":") + 1) === env.ADMIN_PASSWORD;
  } catch (e) {
    return false;
  }
}

export function unauthorized() {
  return new Response("Zugriff verweigert", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin Bereich"' },
  });
}
