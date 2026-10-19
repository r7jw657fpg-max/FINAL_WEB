-- Ein Lost-&-Found-Fundort kann in mehreren Looks vorkommen.
-- Der Punkt gehört weiter seinem Ursprungs-Look (points.trace_id); diese Tabelle bindet ihn in weitere Looks ein.
-- Bestehende Punkte brauchen keine Migration.
--   npx wrangler d1 execute karten-db --remote --file migrations/0005_shared_points.sql
CREATE TABLE IF NOT EXISTS trace_point_refs (
  trace_id TEXT NOT NULL,
  point_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,   -- Reihenfolge innerhalb des einbindenden Looks
  created_at TEXT NOT NULL,
  PRIMARY KEY (trace_id, point_id)
);
CREATE INDEX IF NOT EXISTS trace_point_refs_point ON trace_point_refs (point_id);
