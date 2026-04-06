-- ============================================================
--  VoxFlow -- Migration 010 -- Securite Phase 10
-- ============================================================

-- Table 2FA
CREATE TABLE IF NOT EXISTS two_factor_auth (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret          TEXT NOT NULL,
  is_enabled      BOOLEAN DEFAULT false,
  backup_codes    TEXT[] DEFAULT '{}',
  enabled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Table sessions actives
CREATE TABLE IF NOT EXISTS user_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT UNIQUE NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  location        TEXT,
  is_active       BOOLEAN DEFAULT true,
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user   ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);

-- Table audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  resource        TEXT,
  resource_id     TEXT,
  details         JSONB DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org    ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date   ON audit_logs(created_at);

-- Colonne 2FA sur users
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip  TEXT;

SELECT 'Migration 010 Securite executee !' AS message;
