-- ============================================================
--  VoxFlow -- Migration 006 -- Routage ACD Phase 5
--  A executer dans Supabase SQL Editor
-- ============================================================

-- Ajouter colonnes avancees aux queues
ALTER TABLE queues ADD COLUMN IF NOT EXISTS max_wait_time    INTEGER DEFAULT 300;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS max_queue_size   INTEGER DEFAULT 50;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS overflow_queue_id TEXT;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS priority         INTEGER DEFAULT 1;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS is_vip           BOOLEAN DEFAULT false;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS hold_music_url   TEXT;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS callback_enabled BOOLEAN DEFAULT true;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS sla_threshold    INTEGER DEFAULT 20;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'ACTIVE';

-- Ajouter skills aux agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills          TEXT[] DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS priority        INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_concurrent  INTEGER DEFAULT 1;

-- Ajouter colonnes aux queue_agents
ALTER TABLE queue_agents ADD COLUMN IF NOT EXISTS skill_level INTEGER DEFAULT 1;
ALTER TABLE queue_agents ADD COLUMN IF NOT EXISTS priority    INTEGER DEFAULT 1;

-- Table callbacks (rappels automatiques)
CREATE TABLE IF NOT EXISTS callbacks (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number    TEXT NOT NULL,
  caller_name     TEXT,
  queue_id        TEXT REFERENCES queues(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'PENDING',
  priority        INTEGER DEFAULT 1,
  scheduled_at    TIMESTAMPTZ,
  attempted_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  agent_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_callbacks_org    ON callbacks(organization_id);
CREATE INDEX IF NOT EXISTS idx_callbacks_status ON callbacks(status);
CREATE INDEX IF NOT EXISTS idx_callbacks_phone  ON callbacks(phone_number);

-- Table queue_stats (metriques temps reel)
CREATE TABLE IF NOT EXISTS queue_stats (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  queue_id        TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  date            DATE DEFAULT CURRENT_DATE,
  calls_offered   INTEGER DEFAULT 0,
  calls_answered  INTEGER DEFAULT 0,
  calls_abandoned INTEGER DEFAULT 0,
  calls_sla       INTEGER DEFAULT 0,
  avg_wait_time   INTEGER DEFAULT 0,
  avg_handle_time INTEGER DEFAULT 0,
  max_wait_time   INTEGER DEFAULT 0,
  UNIQUE(queue_id, date)
);

-- Table routing_rules (regles de routage avancees)
CREATE TABLE IF NOT EXISTS routing_rules (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  priority        INTEGER DEFAULT 1,
  conditions      JSONB DEFAULT '{}',
  action          TEXT NOT NULL,
  action_value    TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Mettre a jour la table schedules pour les horaires par jour
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS closed_message TEXT DEFAULT 'Nous sommes fermes. Nos heures sont du lundi au vendredi de 9h a 17h.';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS holiday_dates  JSONB DEFAULT '[]';

SELECT 'Migration 006 Routage ACD executee !' AS message;
