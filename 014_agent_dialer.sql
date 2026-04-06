-- ============================================================
--  VoxFlow — Migration 014 — Agent + Dialer CLEAN
--  DROP POLICY avant CREATE pour éviter les conflits
--  Seulement les nouvelles tables
-- ============================================================

-- ── 1. Colonnes manquantes users ────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS extension      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_status   TEXT DEFAULT 'OFFLINE'
  CHECK (agent_status IN ('ONLINE','BREAK','OFFLINE','BUSY'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_calls    INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_talk_sec INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(agent_status);
CREATE INDEX IF NOT EXISTS idx_users_ext    ON users(extension);

-- ── 2. Colonnes manquantes calls ────────────────────────────
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_id    TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS wrap_up_tags  TEXT[];
ALTER TABLE calls ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome       TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS hold_duration INTEGER DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS muted         BOOLEAN DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recorded      BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_calls_contact   ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_status    ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);

-- ── 3. agent_sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'ONLINE'
    CHECK (status IN ('ONLINE','BREAK','OFFLINE','BUSY')),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  current_call_id TEXT,
  break_reason    TEXT,
  ip_address      TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_org    ON agent_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_agent  ON agent_sessions(agent_id);
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_agent_sessions ON agent_sessions;
CREATE POLICY org_agent_sessions ON agent_sessions
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- ── 4. call_notes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_notes (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  call_id    TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  agent_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_notes_call  ON call_notes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_agent ON call_notes(agent_id);
ALTER TABLE call_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_call_notes ON call_notes;
CREATE POLICY org_call_notes ON call_notes
  USING (agent_id IN (
    SELECT id FROM users WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  ));

-- ── 5. queue_entries ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_entries (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  queue_id        TEXT REFERENCES queues(id) ON DELETE SET NULL,
  call_id         TEXT REFERENCES calls(id) ON DELETE CASCADE,
  from_number     TEXT NOT NULL,
  caller_name     TEXT,
  status          TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','ringing','active','completed','abandoned')),
  entered_at      TIMESTAMPTZ DEFAULT NOW(),
  answered_at     TIMESTAMPTZ,
  agent_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  wait_seconds    INTEGER DEFAULT 0,
  priority        INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_queue_entries_org    ON queue_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries(status);
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_queue_entries ON queue_entries;
CREATE POLICY org_queue_entries ON queue_entries
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- ── 6. supervision_events ───────────────────────────────────
CREATE TABLE IF NOT EXISTS supervision_events (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supervisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id       TEXT REFERENCES calls(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('LISTEN','WHISPER','BARGE')),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sup_events_supervisor ON supervision_events(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_sup_events_call       ON supervision_events(call_id);
ALTER TABLE supervision_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_supervision ON supervision_events;
CREATE POLICY org_supervision ON supervision_events
  USING (supervisor_id IN (
    SELECT id FROM users WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  ));

-- ── 7. dialer_campaigns ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS dialer_campaigns (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'PREDICTIVE'
    CHECK (type IN ('PREDICTIVE','PROGRESSIVE','POWER','ROBOT')),
  status          TEXT NOT NULL DEFAULT 'PAUSED'
    CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','DRAFT')),
  caller_id       TEXT,
  calls_per_agent NUMERIC(4,1) DEFAULT 3.0,
  max_attempts    INTEGER DEFAULT 3,
  retry_delay_min INTEGER DEFAULT 60,
  schedule_start  TIME,
  schedule_end    TIME,
  timezone        TEXT DEFAULT 'America/Toronto',
  total_contacts  INTEGER DEFAULT 0,
  called_count    INTEGER DEFAULT 0,
  answered_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_org    ON dialer_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON dialer_campaigns(status);
ALTER TABLE dialer_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_campaigns ON dialer_campaigns;
CREATE POLICY org_campaigns ON dialer_campaigns
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- ── 8. dialer_contacts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS dialer_contacts (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL REFERENCES dialer_campaigns(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  custom_data JSONB DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','calling','answered','no_answer','busy','failed','do_not_call')),
  attempts    INTEGER DEFAULT 0,
  last_called TIMESTAMPTZ,
  call_id     TEXT REFERENCES calls(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dial_contacts_campaign ON dialer_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dial_contacts_status   ON dialer_contacts(status);
ALTER TABLE dialer_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_dialer_contacts ON dialer_contacts;
CREATE POLICY org_dialer_contacts ON dialer_contacts
  USING (campaign_id IN (
    SELECT id FROM dialer_campaigns WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  ));

-- ── 9. robot_campaigns ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS robot_campaigns (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PAUSED'
    CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','DRAFT')),
  tts_message     TEXT NOT NULL,
  voice           TEXT DEFAULT 'female_fr',
  caller_id       TEXT,
  total_contacts  INTEGER DEFAULT 0,
  called_count    INTEGER DEFAULT 0,
  answered_count  INTEGER DEFAULT 0,
  keypress_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_robot_org    ON robot_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_robot_status ON robot_campaigns(status);
ALTER TABLE robot_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_robot ON robot_campaigns;
CREATE POLICY org_robot ON robot_campaigns
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- ── 10. agent_scripts ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_scripts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT DEFAULT 'general',
  content         TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scripts_org ON agent_scripts(organization_id);
ALTER TABLE agent_scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_scripts ON agent_scripts;
CREATE POLICY org_scripts ON agent_scripts
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- ── 11. wrap_up_tags ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wrap_up_tags (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  color           TEXT DEFAULT '#7b61ff',
  is_active       BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_wuptags_org ON wrap_up_tags(organization_id);
ALTER TABLE wrap_up_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_wuptags ON wrap_up_tags;
CREATE POLICY org_wuptags ON wrap_up_tags
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- ── 12. Vues ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_agents_live AS
SELECT
  u.id,
  u.first_name,
  u.last_name,
  COALESCE(u.first_name || ' ' || u.last_name, u.name) AS full_name,
  u.extension,
  u.agent_status AS status,
  u.organization_id,
  s.current_call_id,
  s.updated_at AS status_updated_at,
  c.from_number AS current_call_number,
  EXTRACT(EPOCH FROM (NOW() - c.started_at))::INTEGER AS call_duration
FROM users u
LEFT JOIN agent_sessions s ON s.agent_id = u.id AND s.status != 'OFFLINE'
LEFT JOIN calls c ON c.id = s.current_call_id AND c.status = 'IN_PROGRESS'
WHERE u.role IN ('AGENT','ADMIN','SUPERVISOR');

CREATE OR REPLACE VIEW v_agent_stats_today AS
SELECT
  agent_id,
  organization_id,
  COUNT(*)                                                    AS calls_total,
  COUNT(*) FILTER (WHERE status = 'COMPLETED')                AS calls_answered,
  COUNT(*) FILTER (WHERE status IN ('NO_ANSWER','MISSED'))    AS calls_missed,
  COALESCE(SUM(duration) FILTER (WHERE status='COMPLETED'),0) AS talk_seconds,
  COALESCE(AVG(duration) FILTER (WHERE status='COMPLETED'),0)::INTEGER AS avg_duration
FROM calls
WHERE started_at >= CURRENT_DATE
GROUP BY agent_id, organization_id;

CREATE OR REPLACE VIEW v_queue_live AS
SELECT
  qe.*,
  EXTRACT(EPOCH FROM (NOW() - qe.entered_at))::INTEGER AS wait_seconds_live,
  u.first_name || ' ' || u.last_name AS agent_name
FROM queue_entries qe
LEFT JOIN users u ON u.id = qe.agent_id
WHERE qe.status IN ('waiting','ringing','active');

SELECT '=== Migration 014 OK ===' AS message;
