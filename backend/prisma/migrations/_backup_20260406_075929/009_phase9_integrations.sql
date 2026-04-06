-- ============================================================
--  VoxFlow -- Migration 009 -- Integrations & API Phase 9
-- ============================================================

-- Table API Keys (acces API publique)
CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_hash        TEXT UNIQUE NOT NULL,
  key_prefix      TEXT NOT NULL,
  permissions     TEXT[] DEFAULT '{}',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT true,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apikeys_org  ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_hash ON api_keys(key_hash);

-- Table webhooks sortants
CREATE TABLE IF NOT EXISTS webhooks (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT,
  events          TEXT[] DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  retry_count     INTEGER DEFAULT 3,
  timeout_ms      INTEGER DEFAULT 5000,
  last_triggered_at TIMESTAMPTZ,
  last_status     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);

-- Table webhook_logs (historique des envois)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  webhook_id  TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  payload     JSONB,
  status_code INTEGER,
  response    TEXT,
  duration_ms INTEGER,
  success     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whlogs_webhook ON webhook_logs(webhook_id);

-- Table integrations (connexions CRM externes)
CREATE TABLE IF NOT EXISTS integrations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL, -- HUBSPOT | SALESFORCE | ZAPIER | ZENDESK | GOOGLE_CALENDAR
  name            TEXT NOT NULL,
  status          TEXT DEFAULT 'ACTIVE',
  config          JSONB DEFAULT '{}',
  credentials     JSONB DEFAULT '{}',
  last_sync_at    TIMESTAMPTZ,
  sync_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, type)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);

-- Table sync_logs (historique synchronisations)
CREATE TABLE IF NOT EXISTS sync_logs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  integration_id  TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL, -- IN | OUT | BOTH
  entity          TEXT NOT NULL, -- CONTACT | CALL | DEAL | TICKET
  records_synced  INTEGER DEFAULT 0,
  records_failed  INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'SUCCESS',
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'Migration 009 Integrations executee !' AS message;
