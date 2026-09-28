-- Aufräumen nach dem Umstieg auf v2: alte v1-Tabellen entfernen.
-- Erst ausführen, wenn v2 live ist und nichts mehr auf v1 zugreift.
-- (Sicherung des v1-Stands: Git-Tag v1-linear-story + db-export.sql im Backup-Ordner.)
--   npx wrangler d1 execute karten-db --remote --file migrations/0003_drop_v1.sql
DROP TABLE IF EXISTS process_entries;
DROP TABLE IF EXISTS step_items;
DROP TABLE IF EXISTS trace_steps;
DROP TABLE IF EXISTS routes;
