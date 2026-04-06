-- ============================================================
--  VoxFlow -- Migration 008 -- IA Avancee + Dialer Phase 8
-- ============================================================

-- Table campagnes power dialer
CREATE TABLE IF NOT EXISTS dialer_campaigns (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT DEFAULT 'DRAFT', -- DRAFT | ACTIVE | PAUSED | COMPLETED
  type            TEXT DEFAULT 'POWER', -- POWER | PREDICTIVE | AUTO
  from_number     TEXT,
  max_attempts    INTEGER DEFAULT 3,
  retry_delay     INTEGER DEFAULT 3600,
  dial_ratio      DECIMAL(3,1) DEFAULT 1.0,
  script_id       TEXT REFERENCES call_scripts(id) ON DELETE SET NULL,
  total_contacts  INTEGER DEFAULT 0,
  dialed_count    INTEGER DEFAULT 0,
  answered_count  INTEGER DEFAULT 0,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Table contacts dans campagne
CREATE TABLE IF NOT EXISTS dialer_contacts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id     TEXT NOT NULL REFERENCES dialer_campaigns(id) ON DELETE CASCADE,
  contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  phone_number    TEXT NOT NULL,
  name            TEXT,
  status          TEXT DEFAULT 'PENDING', -- PENDING | DIALING | ANSWERED | NO_ANSWER | BUSY | FAILED | DNC
  attempts        INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  call_id         TEXT REFERENCES calls(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_campaign ON dialer_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dc_status   ON dialer_contacts(status);

-- Table coaching IA
CREATE TABLE IF NOT EXISTS ai_coaching (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id         TEXT REFERENCES calls(id) ON DELETE SET NULL,
  period          TEXT DEFAULT 'WEEKLY', -- DAILY | WEEKLY | MONTHLY
  score           INTEGER DEFAULT 0,
  metrics         JSONB DEFAULT '{}',
  strengths       TEXT[] DEFAULT '{}',
  improvements    TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_agent ON ai_coaching(agent_id);
CREATE INDEX IF NOT EXISTS idx_coaching_org   ON ai_coaching(organization_id);

-- Table scoring qualite appels
CREATE TABLE IF NOT EXISTS call_quality_scores (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  call_id         TEXT UNIQUE NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  overall_score   INTEGER DEFAULT 0, -- 0-100
  greeting_score  INTEGER DEFAULT 0,
  empathy_score   INTEGER DEFAULT 0,
  resolution_score INTEGER DEFAULT 0,
  closing_score   INTEGER DEFAULT 0,
  talk_ratio      DECIMAL(4,2) DEFAULT 0,
  silence_ratio   DECIMAL(4,2) DEFAULT 0,
  interruptions   INTEGER DEFAULT 0,
  keywords_found  TEXT[] DEFAULT '{}',
  issues_detected TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Colonnes IA supplementaires sur calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS auto_tags     TEXT[] DEFAULT '{}';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS keywords      TEXT[] DEFAULT '{}';

SELECT 'Migration 008 IA + Dialer executee !' AS message;
