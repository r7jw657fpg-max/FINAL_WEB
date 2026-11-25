# Cutting from Memory

Cloudflare Worker (D1 + R2) mit statischem Frontend, ohne Build-Schritt.

## Aufbau

| Bereich | Dateien |
|---|---|
| Landing Page (Header, Look-Raster, Lupe) | `public/index.html`, `public/css/landing.css`, `public/js/landing.js` |
| Look-Seite `/trace/<id>` (drei Ebenen: Look-Foto mit Hotspots, Piece-Netzwerk, Detail; Karte als Overlay) | `public/trace.html`, `public/css/trace.css`, `public/js/trace-{main,scene,detail,map}.js` |
| Admin `/admin` (Basic Auth) | `public/admin/*` |
| Gemeinsam | `public/css/base.css`, `public/js/common.js` |
| Worker / API | `src/index.js` (Einstieg), `src/lib.js` (Router, Helfer), `src/auth.js`, `src/routes/*.js` |
| Datenbank | `schema.sql` (frische DB), `migrations/` (Umstieg von v1) |

**Datenmodell:** ein Look ist ein Trace. Ein Trace hat Punkte (`commission` = Startpunkt, genau einer pro Trace; `lost_and_found`; `scan`), ein Punkt hat beliebig viele Medien (Bild, Video, 3D-Modell `.glb`, Audio) und optional Werkstatt-Fotos. Landing-Header (Intro, Logo, Hintergrund) steht in `settings`.

**Look-Seite (Netzwerk):** Ebene 1 zeigt das Look-Foto scharf mit Hotspots (Klickboxen) pro Piece; beim Überfahren leuchten Stränge zu den Pieces dahinter. Ebene 2 ist das Netzwerk der Pieces (Verlinkungen gestrichelt), Ebene 3 das Detail mit Datenblatt (Material, Composition, Condition, Found on, Status; leer = TBD), Story, Werkstatt-Prozess, Verwandtem und Ort. Die Ebenen sind Hash-Routen: `#net`, `#p/<pointId>`. Die Karte ist ein Overlay (Button "Map" bzw. im Detail "Open map"). Hotspot-Positionen liegen in `look_hotspots` (Prozent des Fotos); fehlen sie, platziert die Seite automatisch nach Körperzone (`points.zone` oder aus dem Titel geraten). Im Admin: Look → "Hotspots on the look photo" (Auto-place + Ziehen), Punkt → "Body zone". Theme: dunkel ist Standard, hell per Schalter oder `?t=light`; der Admin bleibt hell.

**Trace-ID:** die GPS-Nummer des Fundorts eines Kleidungsstücks (`47.37810, 8.54620`, wird im Admin pro Punkt angezeigt und im Overlay der Website). Auf der Startseite führt sie über das Feld "Trace-ID" direkt zum Stück (`/api/lookup`, toleriert Komma/Punkt, vertauschte Reihenfolge und ~30 m Rundung). Das Start-Logo wird beim Besuch einmal gezeigt, nicht beim Zurückkehren von einer Unterseite.

**Fundorte in mehreren Looks:** Ein Lost-&-Found-Punkt gehört seinem Ursprungs-Look und kann über `trace_point_refs` in beliebig viele weitere Looks eingebunden werden (Admin: im Look "Use an existing Lost & Found point"). Es ist derselbe Datensatz: Scan/Medien, Text und die unbearbeiteten Werkstatt-Fotos ("Unprocessed") gelten überall. Die "Changes" der Werkstatt pflegt jeder Look individuell (`workshop_entries.trace_id`). Verlinkungen erscheinen nur in Looks, in denen beide Punkte vorkommen. Die Trace-ID führt in den Ursprungs-Look (oder, falls der versteckt ist, in einen Look, der den Punkt einbindet).

## Lokal starten

```bash
npm install
echo "ADMIN_PASSWORD=lokal-test" > .dev.vars      # nicht im Git
npx wrangler d1 execute karten-db --local --file schema.sql
npx wrangler dev                                   # http://localhost:8787
```

Ohne R2-Zugangsdaten laufen Uploads lokal über den Worker (`/api/dev-upload`). Neue Looks sind zunächst unsichtbar; im Admin auf "Visible" stellen oder mit `/trace/<id>?preview` ansehen.

## Neue Migrationen (Redesign)

`migrations/0007_piece_specs.sql` (Datenblatt-Felder) und `migrations/0008_hotspots.sql` (Körperzone, Hotspots) sind rein additiv. Vor dem Deploy: `npx wrangler d1 execute karten-db --remote --file migrations/0007_piece_specs.sql`, dann `0008_hotspots.sql`.

## Live schalten (v1 -> v2)

1. Datenbank umstellen: `npx wrangler d1 execute karten-db --remote --file migrations/0002_v2.sql`
2. `npx wrangler deploy`
3. Wenn alles läuft: `migrations/0003_drop_v1.sql` entfernt die alten Tabellen.

Der alte Stand (lineare Story, Look Builder) liegt im Git-Tag `v1-linear-story`.
