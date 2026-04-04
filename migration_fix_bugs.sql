-- ============================================================
-- MIGRATION : correction des bugs - centre-essalam
-- À exécuter UNE SEULE FOIS sur la base Railway
-- ============================================================

-- 1. S'assurer que la table user_sessions existe
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `session_id` VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  `expires`    INT(11) UNSIGNED NOT NULL,
  `data`       MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- 2. DIAGNOSTIC : voir les élèves sans matière liée (ex: adam)
--    Ces élèves apparaissent dans la liste du prof mais ne sont pas enregistrés
SELECT 
  s.id, 
  s.full_name, 
  l.name AS niveau,
  'aucune matière liée → non enregistré dans attendance' AS probleme
FROM students s
JOIN levels l ON s.level_id = l.id
WHERE s.id NOT IN (SELECT DISTINCT student_id FROM student_subjects);

-- 3. CORRECTION AUTOMATIQUE : lier les élèves orphelins à toutes les matières
--    DÉCOMMENTEZ pour corriger automatiquement
-- INSERT IGNORE INTO student_subjects (student_id, subject_id)
-- SELECT s.id, sub.id
-- FROM students s
-- CROSS JOIN subjects sub
-- WHERE s.id NOT IN (SELECT DISTINCT student_id FROM student_subjects);

-- 4. OU : lier un élève spécifique à une matière spécifique
--    Remplacez X par l'id de l'élève et Y par l'id de la matière
-- INSERT IGNORE INTO student_subjects (student_id, subject_id) VALUES (X, Y);
