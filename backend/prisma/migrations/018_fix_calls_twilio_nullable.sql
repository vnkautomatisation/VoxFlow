-- ============================================================
--  VoxFlow -- Migration 018 -- Fix twilio_sid nullable
--  Rend calls.twilio_sid nullable pour les appels test
--  sans vrai Twilio SID (mode développement)
-- ============================================================

-- Retirer la contrainte NOT NULL sur twilio_sid
ALTER TABLE calls ALTER COLUMN twilio_sid DROP NOT NULL;

-- Même chose pour phone_numbers
ALTER TABLE phone_numbers ALTER COLUMN twilio_sid DROP NOT NULL;

-- Index pour éviter les doublons NULL (NULL != NULL en SQL)
-- On garde UNIQUE mais les NULLs sont autorisés
-- (PostgreSQL UNIQUE ignore les NULLs par défaut, donc OK)

-- Optionnel : générer un twilio_sid fictif si absent pour les tests
-- UPDATE calls SET twilio_sid = 'TEST_' || gen_random_uuid()::text WHERE twilio_sid IS NULL;

SELECT 'Migration 018 OK — twilio_sid nullable' AS message;
