-- ============================================================
-- MIGRATION : correction des bugs - centre-essalam
-- À exécuter UNE SEULE FOIS sur la base Railway
-- ============================================================

-- 1. S'assurer que la table user_sessions existe
--    (évite le bug de session perdue après chaque POST)
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `session_id` VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  `expires`    INT(11) UNSIGNED NOT NULL,
  `data`       MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- 2. Diagnostic : voir les tlmid sans matière liée
--    (À titre informatif, ne modifie rien)
SELECT 
  s.id, 
  s.full_name, 
  l.name AS niveau,
  'aucune matière liée' AS probleme
FROM students s
JOIN levels l ON s.level_id = l.id
WHERE s.id NOT IN (SELECT DISTINCT student_id FROM student_subjects);

-- 3. Optionnel : lier automatiquement les élèves orphelins à TOUTES les matières
--    DÉCOMMENTEZ les lignes ci-dessous SEULEMENT si vous voulez que
--    les élèves sans matière apparaissent dans TOUTES les matières.
--    (Recommandé uniquement si vous n'avez pas le temps de les lier manuellement)

-- INSERT IGNORE INTO student_subjects (student_id, subject_id)
-- SELECT s.id, sub.id
-- FROM students s
-- CROSS JOIN subjects sub
-- WHERE s.id NOT IN (SELECT DISTINCT student_id FROM student_subjects);

-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
