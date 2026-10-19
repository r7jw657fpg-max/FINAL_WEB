-- Werkstatt-Fotos können zu einem bestimmten Look gehören: In einem Look, der einen Lost-&-Found-Fundort nur einbindet,
-- pflegt man die "Changes" individuell. '' = gehört zum Ursprungs-Look des Punkts (alle bisherigen Einträge).
-- Die unbearbeiteten Fotos (kind = 'raw') bleiben immer gemeinsam.
--   npx wrangler d1 execute karten-db --remote --file migrations/0006_workshop_per_look.sql
ALTER TABLE workshop_entries ADD COLUMN trace_id TEXT NOT NULL DEFAULT '';
