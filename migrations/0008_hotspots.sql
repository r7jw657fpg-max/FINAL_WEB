-- Hotspots auf dem Look-Foto: pro Look und Piece ein Punkt (Prozent des Fotos), plus Körperzone je Piece
-- für die automatische Platzierung. Rein ergänzend. Setzt 0007_piece_specs.sql voraus (nur zur Reihenfolge, keine Abhängigkeit).
--   npx wrangler d1 execute karten-db --remote --file migrations/0008_hotspots.sql
ALTER TABLE points ADD COLUMN zone TEXT NOT NULL DEFAULT '';   -- head | torso | legs | feet | accessory | '' (automatisch)
CREATE TABLE IF NOT EXISTS look_hotspots (
  trace_id TEXT NOT NULL,
  point_id TEXT NOT NULL,
  x REAL NOT NULL,                 -- 0..100, Anteil der Foto-Breite
  y REAL NOT NULL,                 -- 0..100, Anteil der Foto-Höhe
  PRIMARY KEY (trace_id, point_id)
);
