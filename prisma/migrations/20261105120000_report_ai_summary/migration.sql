-- Bilan IA ajoute au rapport (texte stocke dans `summary`).
ALTER TABLE `Report` ADD COLUMN `aiSummary` BOOLEAN NOT NULL DEFAULT false;
