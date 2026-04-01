-- ============================================================
-- Migration complète — table payments
-- Ajoute les colonnes manquantes SANS risque d'erreur
-- À exécuter via Railway → Database → Query
-- ============================================================

-- subject_id
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  subject_id INT NULL AFTER student_id;

-- payment_month
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  payment_month VARCHAR(20) NULL AFTER payment_date;

-- payment_year
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  payment_year INT NULL AFTER payment_month;

-- Clé étrangère subject_id (optionnel, ignorer si déjà existante)
ALTER TABLE payments ADD CONSTRAINT fk_payments_subject
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;

-- Vérifier le résultat :
DESCRIBE payments;
