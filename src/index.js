export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      const auth = request.headers.get("Authorization");

      if (auth) {
        const [scheme, encoded] = auth.split(" ");
        if (scheme === "Basic" && encoded) {
          const decoded = atob(encoded);
          const [, password] = decoded.split(":");
          if (password === env.ADMIN_PASSWORD) {
            return env.ASSETS.fetch(request);
          }
        }
      }

      return new Response("Zugriff verweigert", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Admin Bereich"' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
