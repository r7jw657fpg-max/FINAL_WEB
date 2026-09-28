-- Datenbank-Schema v2 (Cloudflare D1 "karten-db") für eine frische Datenbank.
-- Lokal: npx wrangler d1 execute karten-db --local --file schema.sql
-- Live-Umstieg von v1: migrations/0002_v2.sql (danach optional migrations/0003_drop_v1.sql).
-- Der v1-Stand steht im Git-Tag v1-linear-story.

-- Looks: jeder Look ist genau ein Trace (eine Karte mit Punkten).
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  look_image_url TEXT NOT NULL DEFAULT '',   -- hochaufgelöstes Look-Foto (Landing Page, Lupe)
  sort_order INTEGER NOT NULL DEFAULT 0,     -- Reihenfolge auf der Landing Page
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Punkte auf der Karte eines Traces. Pro Trace genau ein 'commission' (Startpunkt).
CREATE TABLE IF NOT EXISTS points (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  category TEXT NOT NULL,                    -- commission | lost_and_found | scan
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  item_comment TEXT NOT NULL DEFAULT '',     -- Kommentar für die Werkstatt-Ansicht
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,     -- Reihenfolge für den "Weiter"-Button
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS points_trace ON points (trace_id);

-- Medien eines Punkts (beliebig viele).
CREATE TABLE IF NOT EXISTS point_media (
  id TEXT PRIMARY KEY,
  point_id TEXT NOT NULL,
  kind TEXT NOT NULL,                        -- image | video | model | audio
  url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS point_media_point ON point_media (point_id);

-- Werkstatt: frei platzierte Fotos pro Punkt.
CREATE TABLE IF NOT EXISTS workshop_entries (
  id TEXT PRIMARY KEY,
  point_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'change',       -- raw (unbearbeitet) | change (Änderungen)
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  x REAL NOT NULL DEFAULT 0.5,               -- 0..1, Anteil der Canvas-Breite
  y REAL NOT NULL DEFAULT 0.5,               -- 0..1, Anteil der Canvas-Höhe
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workshop_entries_point ON workshop_entries (point_id);

-- Verlinkungen zwischen zwei Punkten desselben Traces; gilt für beide Seiten.
CREATE TABLE IF NOT EXISTS point_links (
  id TEXT PRIMARY KEY,
  point_a TEXT NOT NULL,
  point_b TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',             -- Begründung der Verlinkung
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS point_links_a ON point_links (point_a);
CREATE INDEX IF NOT EXISTS point_links_b ON point_links (point_b);

-- Seiteneinstellungen: intro (Header-Text), logo_url, background_url.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
