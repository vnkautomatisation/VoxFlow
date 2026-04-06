-- ============================================================
--  VoxFlow — Migration 002 — Tables Admin Phase 3
--  A executer dans Supabase SQL Editor
-- ============================================================

-- Table agents (profils agents lies aux users)
CREATE TABLE IF NOT EXISTS agents (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'OFFLINE',
  extension       TEXT,
  max_calls       INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);

-- Table queues mise a jour avec plus de champs
ALTER TABLE queues ADD COLUMN IF NOT EXISTS max_wait_time INTEGER DEFAULT 300;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS strategy TEXT DEFAULT 'ROUND_ROBIN';
ALTER TABLE queues ADD COLUMN IF NOT EXISTS music_on_hold TEXT DEFAULT 'default';
ALTER TABLE queues ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- Table queue_agents (agents assignes aux files)
CREATE TABLE IF NOT EXISTS queue_agents (
  id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  UNIQUE(queue_id, agent_id)
);

-- Table ivr_configs (menus vocaux)
CREATE TABLE IF NOT EXISTS ivr_configs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  welcome_message TEXT,
  timeout         INTEGER DEFAULT 5,
  max_retries     INTEGER DEFAULT 3,
  nodes           JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Table schedules (horaires ouverture)
CREATE TABLE IF NOT EXISTS schedules (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  timezone        TEXT DEFAULT 'America/Toronto',
  hours           JSONB DEFAULT '{}',
  holidays        JSONB DEFAULT '[]',
  closed_message  TEXT DEFAULT 'Nous sommes fermes. Rappellez-nous pendant nos heures d ouverture.',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Table call_scripts (scripts agents)
CREATE TABLE IF NOT EXISTS call_scripts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  content         TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  queue_id        TEXT REFERENCES queues(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'Migration 002 executee avec succes !' AS message;
