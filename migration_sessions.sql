-- ============================================================
-- Migration table sessions — Railway MySQL
-- Exécuter chaque ALTER séparément dans Railway → Database → Query
-- ============================================================

-- Requête 1 :
ALTER TABLE sessions ADD COLUMN session_time TIME NULL AFTER session_date;

-- Requête 2 :
ALTER TABLE sessions ADD COLUMN notes TEXT NULL AFTER session_time;

-- Vérification :
DESCRIBE sessions;
