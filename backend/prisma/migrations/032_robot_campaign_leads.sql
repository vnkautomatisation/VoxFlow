-- ============================================================
--  VoxFlow -- Migration 032 -- Robot campaign leads + scheduling (Phase B)
--  A executer dans Supabase SQL Editor
--
--  But :
--   1. Enrichir robot_campaigns (migration 015) avec les colonnes
--      necessaires a l'execution : script_id, dial_rate, schedule,
--      timezone, retries, DNC list.
--   2. Creer campaign_leads pour lier des contacts a des campagnes
--      robot avec tracking individuel (attempts, next_retry_at, etc.)
--   3. Creer dnd_lists pour la gestion Do-Not-Call (obligation legale
--      CRTC au Canada, FCC aux USA).
-- ============================================================

-- ── 1) Enrichir robot_campaigns ──────────────────────────────
ALTER TABLE robot_campaigns
  ADD COLUMN IF NOT EXISTS script_id        TEXT REFERENCES agent_scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dial_rate        INTEGER NOT NULL DEFAULT 10,
  -- dial_rate = calls per minute (throttle, evite rate limit Twilio)
  ADD COLUMN IF NOT EXISTS schedule_start   TIME DEFAULT '09:00:00',
  ADD COLUMN IF NOT EXISTS schedule_end     TIME DEFAULT '20:00:00',
  -- fenetre horaire (timezone ci-dessous) — LEGAL : CRTC interdit
  -- les appels avant 9h et apres 21h30 heure locale du destinataire
  ADD COLUMN IF NOT EXISTS timezone         TEXT NOT NULL DEFAULT 'America/Montreal',
  ADD COLUMN IF NOT EXISTS max_attempts     INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS retry_delay_sec  INTEGER NOT NULL DEFAULT 3600,  -- 1 heure
  ADD COLUMN IF NOT EXISTS dnd_list_id      TEXT,
  ADD COLUMN IF NOT EXISTS started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dnc_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by       TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_robot_campaigns_script  ON robot_campaigns(script_id);
CREATE INDEX IF NOT EXISTS idx_robot_campaigns_created ON robot_campaigns(created_by);

-- ── 2) Table dnd_lists (Do-Not-Call) ─────────────────────────
CREATE TABLE IF NOT EXISTS dnd_lists (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  is_global        BOOLEAN NOT NULL DEFAULT FALSE,
  -- is_global = appliquee a TOUTES les campagnes de l'org
  source           TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'import', 'opt_out', 'complaint', 'crtc_registry')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dnd_lists_org    ON dnd_lists(organization_id);
CREATE INDEX IF NOT EXISTS idx_dnd_lists_global ON dnd_lists(is_global);

-- ── 3) Table dnd_entries (numeros dans une DNC list) ─────────
CREATE TABLE IF NOT EXISTS dnd_entries (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  list_id          TEXT NOT NULL REFERENCES dnd_lists(id) ON DELETE CASCADE,
  phone_number     TEXT NOT NULL,
  reason           TEXT,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(list_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_dnd_entries_list  ON dnd_entries(list_id);
CREATE INDEX IF NOT EXISTS idx_dnd_entries_phone ON dnd_entries(phone_number);

-- ── 4) FK tardive robot_campaigns.dnd_list_id → dnd_lists ────
-- (dnd_lists doit exister avant la FK)
ALTER TABLE robot_campaigns
  DROP CONSTRAINT IF EXISTS fk_robot_campaigns_dnd_list;
ALTER TABLE robot_campaigns
  ADD CONSTRAINT fk_robot_campaigns_dnd_list
  FOREIGN KEY (dnd_list_id) REFERENCES dnd_lists(id) ON DELETE SET NULL;

-- ── 5) Table campaign_leads ──────────────────────────────────
-- Chaque lead est UNE tentative de contact dans UNE campagne.
-- Un meme contact peut etre dans plusieurs campagnes (rows distinctes).
CREATE TABLE IF NOT EXISTS campaign_leads (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id      TEXT NOT NULL REFERENCES robot_campaigns(id) ON DELETE CASCADE,
  contact_id       TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  phone_number     TEXT NOT NULL,
  name             TEXT,
  status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'DIALING', 'ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'DNC', 'COMPLETED', 'VOICEMAIL')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_attempt_at  TIMESTAMPTZ,
  next_retry_at    TIMESTAMPTZ,
  call_id          TEXT REFERENCES calls(id) ON DELETE SET NULL,
  -- Derniere row calls liee (pour retrouver le recording, transcription)
  keypress         TEXT,
  -- Si l'IVR demande une touche (ex: "1 pour parler a un agent"),
  -- on stocke la touche pressee
  notes            TEXT,
  tags             TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index critiques pour la query d'execution :
--  "SELECT * FROM campaign_leads WHERE campaign_id = X AND status = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= NOW()) ORDER BY created_at LIMIT N"
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_status ON campaign_leads(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_next_retry      ON campaign_leads(next_retry_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_campaign_leads_phone           ON campaign_leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_contact         ON campaign_leads(contact_id);

-- ── 6) Triggers updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_dnd_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dnd_lists_updated_at_trigger ON dnd_lists;
CREATE TRIGGER dnd_lists_updated_at_trigger
  BEFORE UPDATE ON dnd_lists
  FOR EACH ROW EXECUTE FUNCTION trigger_dnd_lists_updated_at();

CREATE OR REPLACE FUNCTION trigger_campaign_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_leads_updated_at_trigger ON campaign_leads;
CREATE TRIGGER campaign_leads_updated_at_trigger
  BEFORE UPDATE ON campaign_leads
  FOR EACH ROW EXECUTE FUNCTION trigger_campaign_leads_updated_at();

-- ── 7) RLS ───────────────────────────────────────────────────
ALTER TABLE dnd_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnd_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_dnd_lists ON dnd_lists;
CREATE POLICY org_dnd_lists ON dnd_lists
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()::text
  ));

DROP POLICY IF EXISTS org_dnd_entries ON dnd_entries;
CREATE POLICY org_dnd_entries ON dnd_entries
  USING (list_id IN (
    SELECT id FROM dnd_lists
    WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()::text
    )
  ));

DROP POLICY IF EXISTS org_campaign_leads ON campaign_leads;
CREATE POLICY org_campaign_leads ON campaign_leads
  USING (campaign_id IN (
    SELECT id FROM robot_campaigns
    WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()::text
    )
  ));

-- ── 8) View v_campaign_progress ──────────────────────────────
-- Donne un resume rapide d'une campagne (%, ETA, dernier lead).
CREATE OR REPLACE VIEW v_campaign_progress AS
SELECT
  c.id                       AS campaign_id,
  c.organization_id,
  c.name,
  c.status                   AS campaign_status,
  c.total_contacts,
  c.called_count,
  c.answered_count,
  c.failed_count,
  c.dnc_count,
  COUNT(l.id) FILTER (WHERE l.status = 'PENDING')    AS pending_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'COMPLETED')  AS completed_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'ANSWERED')   AS answered_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'DNC')        AS dnc_leads,
  MAX(l.last_attempt_at)     AS last_activity_at
FROM robot_campaigns c
LEFT JOIN campaign_leads l ON l.campaign_id = c.id
GROUP BY c.id;
