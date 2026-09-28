# Cutting from Memory

Cloudflare Worker (D1 + R2) mit statischem Frontend, ohne Build-Schritt.

## Aufbau

| Bereich | Dateien |
|---|---|
| Landing Page (Header, Look-Raster, Lupe) | `public/index.html`, `public/css/landing.css`, `public/js/landing.js` |
| Trace-Seite `/trace/<id>` (Karte, Marker, Overlay) | `public/trace.html`, `public/css/trace.css`, `public/js/trace-{main,map,viewer}.js` |
| Admin `/admin` (Basic Auth) | `public/admin/*` |
| Gemeinsam | `public/css/base.css`, `public/js/common.js` |
| Worker / API | `src/index.js` (Einstieg), `src/lib.js` (Router, Helfer), `src/auth.js`, `src/routes/*.js` |
| Datenbank | `schema.sql` (frische DB), `migrations/` (Umstieg von v1) |

**Datenmodell:** ein Look ist ein Trace. Ein Trace hat Punkte (`commission` = Startpunkt, genau einer pro Trace; `lost_and_found`; `scan`), ein Punkt hat beliebig viele Medien (Bild, Video, 3D-Modell `.glb`, Audio) und optional Werkstatt-Fotos. Landing-Header (Intro, Logo, Hintergrund) steht in `settings`.

## Lokal starten

```bash
npm install
echo "ADMIN_PASSWORD=lokal-test" > .dev.vars      # nicht im Git
npx wrangler d1 execute karten-db --local --file schema.sql
npx wrangler dev                                   # http://localhost:8787
```

Ohne R2-Zugangsdaten laufen Uploads lokal über den Worker (`/api/dev-upload`). Neue Looks sind zunächst unsichtbar; im Admin auf "Visible" stellen oder mit `/trace/<id>?preview` ansehen.

## Live schalten (v1 -> v2)

1. Datenbank umstellen: `npx wrangler d1 execute karten-db --remote --file migrations/0002_v2.sql`
2. `npx wrangler deploy`
3. Wenn alles läuft: `migrations/0003_drop_v1.sql` entfernt die alten Tabellen.

Der alte Stand (lineare Story, Look Builder) liegt im Git-Tag `v1-linear-story`.
