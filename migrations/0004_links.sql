-- Verlinkungen zwischen Punkten eines Traces (z.B. ein Lost-&-Found-Stück repariert ein Commission-Stück).
-- Ein Eintrag gilt für beide Seiten und wird an beiden Punkten angezeigt.
--   npx wrangler d1 execute karten-db --remote --file migrations/0004_links.sql
CREATE TABLE IF NOT EXISTS point_links (
  id TEXT PRIMARY KEY,
  point_a TEXT NOT NULL,
  point_b TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',   -- Begründung der Verlinkung
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS point_links_a ON point_links (point_a);
CREATE INDEX IF NOT EXISTS point_links_b ON point_links (point_b);
