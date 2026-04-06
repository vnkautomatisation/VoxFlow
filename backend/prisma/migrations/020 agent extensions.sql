-- ================================================================
--  Migration 020 — Agent extensions & assignments
--  Ajouter les colonnes pour les extensions, numéros DID,
--  files assignées, compétences et objectifs sur les agents
-- ================================================================

-- Extension téléphonique interne (ex: 201, 202...)
ALTER TABLE users ADD COLUMN IF NOT EXISTS extension TEXT;

-- Numéro DID Twilio assigné directement à l'agent (ex: +15141234567)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Files d'attente assignées à l'agent (tableau d'IDs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS queue_ids UUID[] DEFAULT '{}';

-- Compétences/skills de l'agent (ex: ['français', 'support', 'ventes'])
ALTER TABLE users ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Objectifs journaliers (appels cibles, durée moyenne cible)
ALTER TABLE users ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT '{"calls": 30, "duration": 300}';

-- Index sur extension pour les lookups rapides
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_extension_org
  ON users (extension, organization_id)
  WHERE extension IS NOT NULL;

-- Index sur phone_number pour les lookups rapides
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number
  ON users (phone_number)
  WHERE phone_number IS NOT NULL;

-- Vérification
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('extension', 'phone_number', 'queue_ids', 'skills', 'goals')
ORDER BY column_name;