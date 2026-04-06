-- ============================================================
--  VoxFlow -- Migration 004 -- Onboarding Phase 2
--  A executer dans Supabase SQL Editor
-- ============================================================

-- Table tokens (verification email + reset password)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  type        TEXT NOT NULL, -- EMAIL_VERIFY | PASSWORD_RESET
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user  ON auth_tokens(user_id);

-- Table onboarding_progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_step    INTEGER DEFAULT 1,
  completed_steps JSONB DEFAULT '[]',
  completed       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter colonnes aux users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified  BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone        TEXT DEFAULT 'America/Toronto';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language        TEXT DEFAULT 'fr';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications   JSONB DEFAULT '{"email":true,"browser":true,"sms":false}';

-- Ajouter colonnes aux organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url     TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website      TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone        TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address      TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city         TEXT DEFAULT 'Montreal';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS province     TEXT DEFAULT 'QC';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country      TEXT DEFAULT 'CA';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Marquer les comptes existants comme verifies
UPDATE users SET email_verified = true WHERE email IN ('owner@voxflow.io', 'admin@test.com', 'agent@test.com');

SELECT 'Migration 004 executee avec succes !' AS message;
