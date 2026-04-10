-- ============================================================
--  VoxFlow -- Migration 026 -- SSO OAuth (Google / Microsoft)
--  Les utilisateurs qui se connectent via SSO n'ont pas de mot
--  de passe local. password_hash devient NULLABLE et on ajoute
--  un champ auth_providers pour tracker la méthode de création.
--  A executer dans Supabase SQL Editor.
-- ============================================================

-- ── 1) password_hash nullable pour les users SSO ──────────────
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- ── 2) auth_providers TEXT[] pour tracker les méthodes ────────
-- Exemples: ['password'], ['google'], ['password', 'google']
-- Un même user peut avoir plusieurs méthodes (lier un compte
-- existant à un provider SSO plus tard).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_providers TEXT[] DEFAULT ARRAY['password']::TEXT[];

-- ── 3) avatar_url depuis le provider OAuth (Google profile) ──
-- Déjà ajouté en migration 020, mais on s'assure qu'il existe.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ── 4) Index pour lookup rapide par provider ─────────────────
CREATE INDEX IF NOT EXISTS idx_users_auth_providers
  ON users USING GIN (auth_providers);

-- ── 5) Backfill : les users existants ont 'password' ─────────
UPDATE users
  SET auth_providers = ARRAY['password']::TEXT[]
  WHERE auth_providers IS NULL OR auth_providers = '{}';

SELECT 'Migration 026 SSO OAuth executee !' AS message;
