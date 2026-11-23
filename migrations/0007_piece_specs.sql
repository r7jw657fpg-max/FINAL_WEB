-- Datenblatt-Felder pro Piece (Material, Zusammensetzung, Zustand, Fundtag, Status). Rein ergänzend, Standardwert leer.
--   npx wrangler d1 execute karten-db --remote --file migrations/0007_piece_specs.sql
ALTER TABLE points ADD COLUMN material TEXT NOT NULL DEFAULT '';
ALTER TABLE points ADD COLUMN composition TEXT NOT NULL DEFAULT '';
ALTER TABLE points ADD COLUMN condition TEXT NOT NULL DEFAULT '';
ALTER TABLE points ADD COLUMN found_on TEXT NOT NULL DEFAULT '';
ALTER TABLE points ADD COLUMN status TEXT NOT NULL DEFAULT '';
