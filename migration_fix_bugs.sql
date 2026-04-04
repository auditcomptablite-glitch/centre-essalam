-- ============================================================
-- MIGRATION : correction des bugs - centre-essalam
-- ============================================================

-- 1. Table user_sessions
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `session_id` VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  `expires`    INT(11) UNSIGNED NOT NULL,
  `data`       MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- 2. DIAGNOSTIC : voir les élèves avec ID = 0 (problème critique)
SELECT id, full_name, level_id FROM students WHERE id = 0;

-- 3. CORRECTION CRITIQUE : si un élève a id=0, le supprimer et le recréer
--    (AUTO_INCREMENT ne peut pas attribuer id=0 normalement)
--    Vérifiez d'abord avec la requête ci-dessus, puis :

-- Étape A : récupérer ses données
-- SELECT * FROM students WHERE id = 0;

-- Étape B : le supprimer (les FK CASCADE supprimeront aussi student_subjects)
-- DELETE FROM students WHERE id = 0;

-- Étape C : le recréer (MySQL attribuera un vrai id auto)
-- INSERT INTO students (full_name, phone, parent_phone, level_id, notes)
-- VALUES ('adam', NULL, NULL, X, NULL);  -- remplacez X par son level_id

-- Étape D : le lier à ses matières
-- INSERT IGNORE INTO student_subjects (student_id, subject_id)
-- SELECT LAST_INSERT_ID(), sub.id FROM subjects sub WHERE sub.name IN ('الرياضيات');

-- 4. DIAGNOSTIC : élèves sans matière liée
SELECT s.id, s.full_name, l.name AS niveau
FROM students s
JOIN levels l ON s.level_id = l.id
WHERE s.id NOT IN (SELECT DISTINCT student_id FROM student_subjects)
  AND s.id > 0;

-- 5. CORRECTION : lier les élèves orphelins à toutes les matières (décommenter)
-- INSERT IGNORE INTO student_subjects (student_id, subject_id)
-- SELECT s.id, sub.id FROM students s CROSS JOIN subjects sub
-- WHERE s.id NOT IN (SELECT DISTINCT student_id FROM student_subjects)
--   AND s.id > 0;
