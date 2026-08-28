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

           return new Response(
        "Debug-Info: ADMIN_PASSWORD ist " +
        (env.ADMIN_PASSWORD === undefined ? "NICHT gesetzt (Binding fehlt)" : "gesetzt, Länge: " + env.ADMIN_PASSWORD.length),
        { status: 401 }
      );
    }

    return env.ASSETS.fetch(request);
  },
};
