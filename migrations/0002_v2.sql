-- v2: Looks (= Traces) mit klickbaren Punkten. Ersetzt die lineare Timeline.
-- Läuft NUR beim Umstieg auf v2. Die alten Tabellen (routes, trace_steps,
-- step_items, process_entries) bleiben zunächst bestehen, bis v1 abgelöst ist
-- (danach: 0003_drop_v1.sql).
--   npx wrangler d1 execute karten-db --remote --file migrations/0002_v2.sql

-- Tote v1-Tabellen mit anderem Aufbau (vom Code nicht mehr genutzt, Namen werden neu vergeben).
DROP TABLE IF EXISTS point_entries;
DROP TABLE IF EXISTS points;

CREATE TABLE traces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  look_image_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE points (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  category TEXT NOT NULL,            -- commission | lost_and_found | scan
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  item_comment TEXT NOT NULL DEFAULT '',  -- Kommentar für die Werkstatt-Ansicht
  lng REAL NOT NULL,
  lat REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX points_trace ON points (trace_id);

CREATE TABLE point_media (
  id TEXT PRIMARY KEY,
  point_id TEXT NOT NULL,
  kind TEXT NOT NULL,                -- image | video | model | audio
  url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX point_media_point ON point_media (point_id);

CREATE TABLE workshop_entries (
  id TEXT PRIMARY KEY,
  point_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'change',  -- raw (unbearbeitet) | change (Änderungen)
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  x REAL NOT NULL DEFAULT 0.5,          -- 0..1, Anteil der Canvas-Breite
  y REAL NOT NULL DEFAULT 0.5,          -- 0..1, Anteil der Canvas-Höhe
  created_at TEXT NOT NULL
);
CREATE INDEX workshop_entries_point ON workshop_entries (point_id);

-- settings bleibt: Schlüssel intro, logo_url, background_url.
INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_url', ''), ('background_url', '');
