-- ============================================================
-- Migration 017 — Agent Goals + Dialer Sync
-- Objectifs journaliers agents + fix extensions
-- ============================================================

-- ── 1. TABLE agent_goals ────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_goals (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Objectifs
  daily_calls_target  INTEGER DEFAULT 50,
  daily_answer_rate   NUMERIC(5,2) DEFAULT 80.0,  -- %
  avg_duration_max    INTEGER DEFAULT 300,          -- secondes
  daily_talk_time     INTEGER DEFAULT 14400,        -- 4h en secondes
  -- Période
  effective_from      DATE DEFAULT CURRENT_DATE,
  effective_to        DATE,
  -- Meta
  created_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, agent_id, effective_from)
);

-- ── 2. TABLE agent_daily_stats (cache stats du jour) ────────
CREATE TABLE IF NOT EXISTS agent_daily_stats (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stat_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Stats calculées
  total_calls         INTEGER DEFAULT 0,
  answered_calls      INTEGER DEFAULT 0,
  missed_calls        INTEGER DEFAULT 0,
  outbound_calls      INTEGER DEFAULT 0,
  total_talk_time     INTEGER DEFAULT 0,  -- secondes
  avg_call_duration   INTEGER DEFAULT 0,  -- secondes
  -- Login
  first_login_at      TIMESTAMPTZ,
  last_activity_at    TIMESTAMPTZ,
  total_online_time   INTEGER DEFAULT 0,  -- secondes
  -- Meta
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, agent_id, stat_date)
);

-- ── 3. FIX AGENTS — créer entrées manquantes ────────────────
-- Insérer les agents test si absents
INSERT INTO agents (user_id, organization_id, extension, status, created_at)
SELECT u.id, u.organization_id, 
  CASE u.email 
    WHEN 'agent@test.com' THEN '201'
    WHEN 'admin@test.com' THEN '202'
    ELSE '200'
  END,
  'OFFLINE', NOW()
FROM users u
WHERE u.email IN ('agent@test.com', 'admin@test.com')
  AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.user_id = u.id)
ON CONFLICT DO NOTHING;

-- Update extensions si null
UPDATE agents SET extension = '201'
WHERE user_id = (SELECT id FROM users WHERE email = 'agent@test.com')
  AND (extension IS NULL OR extension = '');

UPDATE agents SET extension = '202'
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@test.com')
  AND (extension IS NULL OR extension = '');

-- ── 4. OBJECTIFS PAR DÉFAUT pour les agents test ────────────
INSERT INTO agent_goals (organization_id, agent_id, daily_calls_target, daily_answer_rate, avg_duration_max, daily_talk_time)
SELECT 
  u.organization_id,
  u.id,
  50, 80.0, 300, 14400
FROM users u
WHERE u.email IN ('agent@test.com', 'admin@test.com')
  AND NOT EXISTS (
    SELECT 1 FROM agent_goals g 
    WHERE g.agent_id = u.id 
    AND g.effective_to IS NULL
  )
ON CONFLICT DO NOTHING;

-- ── 5. RLS ───────────────────────────────────────────────────
ALTER TABLE agent_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_goals_org" ON agent_goals;
CREATE POLICY "agent_goals_org" ON agent_goals
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()::text
  ));

DROP POLICY IF EXISTS "agent_daily_stats_org" ON agent_daily_stats;
CREATE POLICY "agent_daily_stats_org" ON agent_daily_stats
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()::text
  ));

-- ── 6. VÉRIFICATION ─────────────────────────────────────────
SELECT 
  u.email,
  u.role,
  a.extension,
  a.status,
  g.daily_calls_target,
  g.daily_answer_rate
FROM users u
LEFT JOIN agents a ON a.user_id = u.id
LEFT JOIN agent_goals g ON g.agent_id = u.id AND g.effective_to IS NULL
WHERE u.email IN ('agent@test.com', 'admin@test.com', 'owner@voxflow.io')
ORDER BY u.email;
