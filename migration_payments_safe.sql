-- ============================================================
-- Migration payments — Railway MySQL
-- Exécuter via : Railway → ton projet → Database → Query
-- Compatible MySQL 5.7+ (sans IF NOT EXISTS sur ALTER COLUMN)
-- ============================================================

-- Étape 1 : ajouter payment_month si absente
SET @exists_month = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'payment_month'
);

SET @sql_month = IF(
  @exists_month = 0,
  'ALTER TABLE payments ADD COLUMN payment_month VARCHAR(20) NULL AFTER payment_date',
  'SELECT "payment_month deja presente"'
);
PREPARE stmt FROM @sql_month; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Étape 2 : ajouter payment_year si absente
SET @exists_year = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'payment_year'
);

SET @sql_year = IF(
  @exists_year = 0,
  'ALTER TABLE payments ADD COLUMN payment_year INT NULL AFTER payment_month',
  'SELECT "payment_year deja presente"'
);
PREPARE stmt FROM @sql_year; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Étape 3 : ajouter subject_id si absente
SET @exists_sub = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'subject_id'
);

SET @sql_sub = IF(
  @exists_sub = 0,
  'ALTER TABLE payments ADD COLUMN subject_id INT NULL AFTER student_id',
  'SELECT "subject_id deja presente"'
);
PREPARE stmt FROM @sql_sub; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Étape 4 : ajouter notes si absente
SET @exists_notes = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'notes'
);

SET @sql_notes = IF(
  @exists_notes = 0,
  'ALTER TABLE payments ADD COLUMN notes TEXT NULL',
  'SELECT "notes deja presente"'
);
PREPARE stmt FROM @sql_notes; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Vérification finale
DESCRIBE payments;
