-- ============================================================
--  VoxFlow — Migration 013 — Agent Dashboard + Dialer
--  Toutes les tables nécessaires aux portails agent et dialer
-- ============================================================

-- ── 1. Colonnes manquantes sur users (profil agent) ─────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS extension      TEXT;           -- poste SIP ex: 201
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_status   TEXT DEFAULT 'OFFLINE'
  CHECK (agent_status IN ('ONLINE','BREAK','OFFLINE','BUSY'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_calls    INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_talk_sec INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(agent_status);
CREATE INDEX IF NOT EXISTS idx_users_ext    ON users(extension);

-- ── 2. Colonnes manquantes sur calls ────────────────────────
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS wrap_up_tags    TEXT[];          -- ['Résolu','Vente',...]
ALTER TABLE calls ADD COLUMN IF NOT EXISTS quality_score   INTEGER;         -- 1-5
ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome         TEXT;            -- Résolu/Rappel/Escalade...
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_summary      TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS hold_duration   INTEGER DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS muted           BOOLEAN DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recorded        BOOLEAN DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS supervisor_id   TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calls_contact  ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_status   ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);

-- ── 3. Table agent_sessions (présence temps réel) ───────────
CREATE TABLE IF NOT EXISTS agent_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'ONLINE'
    CHECK (status IN ('ONLINE','BREAK','OFFLINE','BUSY')),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  current_call_id TEXT REFERENCES calls(id) ON DELETE SET NULL,
  break_reason    TEXT,
  ip_address      TEXT,
  user_agent      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_agent_active
  ON agent_sessions(agent_id) WHERE status != 'OFFLINE';
CREATE INDEX IF NOT EXISTS idx_sessions_org ON agent_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON agent_sessions(status);

-- ── 4. Table call_notes (notes pendant/après appel) ─────────
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

-- ── 5. Table queue_entries (file d'attente temps réel) ───────
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
CREATE INDEX IF NOT EXISTS idx_queue_entries_queue  ON queue_entries(queue_id);

-- ── 6. Table supervision_events (écoute/chuchotement/barge) ──
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

-- ── 7. Table dialer_campaigns (campagnes predictive/robot) ───
CREATE TABLE IF NOT EXISTS dialer_campaigns (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'PREDICTIVE'
    CHECK (type IN ('PREDICTIVE','PROGRESSIVE','POWER','ROBOT')),
  status          TEXT NOT NULL DEFAULT 'PAUSED'
    CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','DRAFT')),
  script_id       TEXT,
  caller_id       TEXT,                    -- numéro DID utilisé
  calls_per_agent NUMERIC(4,1) DEFAULT 3.0,
  max_attempts    INTEGER DEFAULT 3,
  retry_delay_min INTEGER DEFAULT 60,      -- minutes avant rappel
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

-- ── 8. Table dialer_contacts (listes d'appels) ───────────────
CREATE TABLE IF NOT EXISTS dialer_contacts (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id  TEXT NOT NULL REFERENCES dialer_campaigns(id) ON DELETE CASCADE,
  phone        TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  custom_data  JSONB DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','calling','answered','no_answer','busy','failed','do_not_call')),
  attempts     INTEGER DEFAULT 0,
  last_called  TIMESTAMPTZ,
  call_id      TEXT REFERENCES calls(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dial_contacts_campaign ON dialer_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dial_contacts_status   ON dialer_contacts(status);
CREATE INDEX IF NOT EXISTS idx_dial_contacts_phone    ON dialer_contacts(phone);

-- ── 9. Table robot_campaigns (TTS automatisé) ────────────────
CREATE TABLE IF NOT EXISTS robot_campaigns (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PAUSED'
    CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','DRAFT')),
  tts_message     TEXT NOT NULL,             -- message lu par TTS
  voice           TEXT DEFAULT 'female_fr',  -- voix TTS
  caller_id       TEXT,
  total_contacts  INTEGER DEFAULT 0,
  called_count    INTEGER DEFAULT 0,
  answered_count  INTEGER DEFAULT 0,
  keypress_count  INTEGER DEFAULT 0,         -- DTMF 1 = intéressé
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robot_org    ON robot_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_robot_status ON robot_campaigns(status);

-- ── 10. Table agent_scripts (scripts d'appel) ────────────────
CREATE TABLE IF NOT EXISTS agent_scripts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT DEFAULT 'general',
  content         TEXT NOT NULL,             -- texte du script
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scripts_org ON agent_scripts(organization_id);

-- ── 11. Table wrap_up_tags (tags de post-appel) ──────────────
CREATE TABLE IF NOT EXISTS wrap_up_tags (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  color           TEXT DEFAULT '#7b61ff',
  is_active       BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_wuptags_org ON wrap_up_tags(organization_id);

-- ── 12. Données de départ — tags par défaut ──────────────────
-- (uniquement si la table est vide pour cette org demo)
INSERT INTO wrap_up_tags (organization_id, label, color)
SELECT 'demo-org-id', label, color FROM (VALUES
  ('Résolu',    '#00d4aa'),
  ('Rappel',    '#ffb547'),
  ('Vente',     '#7b61ff'),
  ('Escalade',  '#ff4d6d'),
  ('Support',   '#38b6ff'),
  ('Annulation','#9898b8')
) AS t(label, color)
WHERE NOT EXISTS (
  SELECT 1 FROM wrap_up_tags WHERE organization_id = 'demo-org-id' LIMIT 1
);

-- ── 13. RLS — activer sur les nouvelles tables ───────────────
ALTER TABLE agent_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervision_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialer_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialer_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_campaigns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_scripts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrap_up_tags       ENABLE ROW LEVEL SECURITY;

-- ── 14. Vue utilitaire — agents en temps réel ────────────────
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
  c.from_number  AS current_call_number,
  EXTRACT(EPOCH FROM (NOW() - c.started_at))::INTEGER AS call_duration
FROM users u
LEFT JOIN agent_sessions s ON s.agent_id = u.id AND s.status != 'OFFLINE'
LEFT JOIN calls c ON c.id = s.current_call_id AND c.status = 'IN_PROGRESS'
WHERE u.role IN ('AGENT','ADMIN','SUPERVISOR');

-- ── 15. Vue — stats agent du jour ────────────────────────────
CREATE OR REPLACE VIEW v_agent_stats_today AS
SELECT
  agent_id,
  organization_id,
  COUNT(*)                                           AS calls_total,
  COUNT(*) FILTER (WHERE status = 'COMPLETED')       AS calls_answered,
  COUNT(*) FILTER (WHERE status IN ('NO_ANSWER','MISSED')) AS calls_missed,
  COALESCE(SUM(duration) FILTER (WHERE status = 'COMPLETED'), 0) AS talk_seconds,
  COALESCE(AVG(duration) FILTER (WHERE status = 'COMPLETED'), 0)::INTEGER AS avg_duration
FROM calls
WHERE started_at >= CURRENT_DATE
GROUP BY agent_id, organization_id;

-- ── 16. Vue — file d'attente live ────────────────────────────
CREATE OR REPLACE VIEW v_queue_live AS
SELECT
  qe.*,
  EXTRACT(EPOCH FROM (NOW() - qe.entered_at))::INTEGER AS wait_seconds_live,
  u.first_name || ' ' || u.last_name AS agent_name
FROM queue_entries qe
LEFT JOIN users u ON u.id = qe.agent_id
WHERE qe.status IN ('waiting','ringing','active');

SELECT '=== Migration 013 Agent + Dialer OK ===' AS message;
