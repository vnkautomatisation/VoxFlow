-- ============================================================
--  VoxFlow -- Migration 034 -- Security hardening + FK fixes
--  A executer dans Supabase SQL Editor
--
--  But : corriger les problemes detectes par l'audit des migrations
--  001-033 :
--   1. Type mismatch critique : audio_files.id UUID -> TEXT
--   2. Type mismatch critique : users.queue_ids UUID[] -> TEXT[]
--   3. RLS manquante sur 30+ tables (data leak massif)
--   4. FK sans index (perf)
--   5. Triggers updated_at manquants
--
--  Cette migration est IDEMPOTENTE et peut etre re-executee sans risque.
--  Toutes les operations utilisent IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1 — Fix type mismatches critiques
-- ══════════════════════════════════════════════════════════════

-- ── 1.1) users.queue_ids UUID[] -> TEXT[] ────────────────────
-- Les IDs de queues sont TEXT (gen_random_uuid()::text), pas UUID.
-- Le UUID[] de la migration 020 ne peut pas referencer les vrais IDs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'queue_ids'
      AND data_type = 'ARRAY'
      AND udt_name = '_uuid'
  ) THEN
    ALTER TABLE users
      ALTER COLUMN queue_ids TYPE TEXT[] USING ARRAY[]::TEXT[];
  END IF;
END $$;

-- ── 1.2) audio_files.id UUID -> TEXT (si la table existe) ────
-- La migration 021 a cree audio_files avec id UUID, ce qui casse
-- toutes les FK potentielles depuis queues.hold_music_id (TEXT).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audio_files'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_files'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    -- Drop les FK qui pointent vers audio_files.id avant le retype
    ALTER TABLE queues
      DROP CONSTRAINT IF EXISTS queues_hold_music_id_fkey;

    -- Retype audio_files.id
    ALTER TABLE audio_files
      ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE audio_files
      ALTER COLUMN id TYPE TEXT USING id::TEXT;
    ALTER TABLE audio_files
      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

    -- Retype queues.hold_music_id si elle existe en UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'queues'
        AND column_name = 'hold_music_id'
        AND data_type = 'uuid'
    ) THEN
      ALTER TABLE queues
        ALTER COLUMN hold_music_id TYPE TEXT USING hold_music_id::TEXT;
    END IF;

    -- Recreer la FK
    ALTER TABLE queues
      ADD CONSTRAINT queues_hold_music_id_fkey
      FOREIGN KEY (hold_music_id) REFERENCES audio_files(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 2 — RLS sur toutes les tables sensibles
-- ══════════════════════════════════════════════════════════════

-- Helper : policy org-scoped generique reutilisable
-- Pattern : la row est visible si l'organization_id est celui de l'user
-- authentifie (users.id = auth.uid()::text), OU si l'user est OWNER/
-- OWNER_STAFF (acces multi-org pour le support).

-- ── 2.1) Tables avec organization_id direct ──────────────────
DO $$
DECLARE
  t TEXT;
  tables_with_org_id TEXT[] := ARRAY[
    'agents', 'queue_agents', 'ivr_configs', 'schedules', 'call_scripts',
    'sms_messages', 'ai_summaries',
    'callbacks', 'queue_stats', 'routing_rules',
    'contacts', 'contact_activities', 'contact_tags',
    'conversations', 'email_tickets', 'canned_responses',
    'dialer_campaigns', 'ai_coaching', 'call_quality_scores',
    'api_keys', 'webhooks', 'integrations', 'sync_logs',
    'audit_logs',
    'voicemails'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_org_id LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = t
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'organization_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS org_%I ON %I', t, t);
      EXECUTE format($p$
        CREATE POLICY org_%I ON %I
        USING (
          organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()::text
          )
          OR EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
              AND role IN ('OWNER', 'OWNER_STAFF')
          )
        )
      $p$, t, t);
    END IF;
  END LOOP;
END $$;

-- ── 2.2) Tables avec FK indirecte (via join) ─────────────────
-- dialer_contacts : via dialer_campaigns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'dialer_contacts'
  ) THEN
    ALTER TABLE dialer_contacts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS org_dialer_contacts ON dialer_contacts;
    CREATE POLICY org_dialer_contacts ON dialer_contacts
      USING (campaign_id IN (
        SELECT id FROM dialer_campaigns
        WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()::text
        )
      ));
  END IF;
END $$;

-- messages : via conversations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'messages'
  ) THEN
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS org_messages ON messages;
    CREATE POLICY org_messages ON messages
      USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()::text
        )
      ));
  END IF;
END $$;

-- chat_sessions : via conversations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions'
  ) THEN
    ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS org_chat_sessions ON chat_sessions;
    CREATE POLICY org_chat_sessions ON chat_sessions
      USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()::text
        )
      ));
  END IF;
END $$;

-- webhook_logs : via webhooks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_logs'
  ) THEN
    ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS org_webhook_logs ON webhook_logs;
    CREATE POLICY org_webhook_logs ON webhook_logs
      USING (webhook_id IN (
        SELECT id FROM webhooks
        WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()::text
        )
      ));
  END IF;
END $$;

-- ── 2.3) Tables user-scoped (pas org-scoped) ─────────────────
-- two_factor_auth, user_sessions, auth_tokens sont liees a un user
-- specifique (pas une org). Un user ne voit que ses propres rows.
DO $$
DECLARE
  t TEXT;
  user_scoped_tables TEXT[] := ARRAY[
    'two_factor_auth', 'user_sessions', 'auth_tokens', 'onboarding_progress'
  ];
BEGIN
  FOREACH t IN ARRAY user_scoped_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = t
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'user_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS self_%I ON %I', t, t);
      EXECUTE format($p$
        CREATE POLICY self_%I ON %I
        USING (
          user_id = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()::text
              AND role IN ('OWNER', 'OWNER_STAFF')
          )
        )
      $p$, t, t);
    END IF;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 3 — FK sans index (perf)
-- ══════════════════════════════════════════════════════════════

-- Chaque colonne FK devrait avoir son propre index pour eviter les
-- seq scans lors des lookups. Liste compilee depuis l'audit des
-- migrations 001-027.

-- agents (002)
CREATE INDEX IF NOT EXISTS idx_agents_user          ON agents(user_id);

-- contacts (005) — idx_contacts_assigned_to peut manquer
CREATE INDEX IF NOT EXISTS idx_contacts_assigned    ON contacts(assigned_to);

-- contact_activities (005)
CREATE INDEX IF NOT EXISTS idx_contact_activities_agent ON contact_activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_call  ON contact_activities(call_id);

-- dialer_contacts (008)
CREATE INDEX IF NOT EXISTS idx_dialer_contacts_contact ON dialer_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_dialer_contacts_call    ON dialer_contacts(call_id);

-- ai_coaching (008)
CREATE INDEX IF NOT EXISTS idx_ai_coaching_call    ON ai_coaching(call_id);

-- call_quality_scores (008)
CREATE INDEX IF NOT EXISTS idx_call_quality_agent  ON call_quality_scores(agent_id);

-- email_tickets (007)
CREATE INDEX IF NOT EXISTS idx_email_tickets_assigned ON email_tickets(assigned_to);

-- chat_sessions (007)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_conversation ON chat_sessions(conversation_id);

-- canned_responses (007)
CREATE INDEX IF NOT EXISTS idx_canned_responses_created_by ON canned_responses(created_by);

-- extensions (013) — did_number FK sans index
CREATE INDEX IF NOT EXISTS idx_extensions_did      ON extensions(did_number);

-- Composite indexes pour les queries critiques
-- Historique appels par org (tri desc sur started_at)
CREATE INDEX IF NOT EXISTS idx_calls_org_started
  ON calls(organization_id, started_at DESC);

-- Lookup email par org (login / unique check)
CREATE INDEX IF NOT EXISTS idx_users_email_org
  ON users(email, organization_id);

-- Contacts lookup par org + phone (CRM enrichment sur incoming calls)
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone
  ON contacts(organization_id, phone);


-- ══════════════════════════════════════════════════════════════
-- SECTION 4 — Triggers updated_at manquants
-- ══════════════════════════════════════════════════════════════

-- Fonction generique reutilisable (si pas deja creee ailleurs)
CREATE OR REPLACE FUNCTION tf_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attache le trigger a toutes les tables qui ont updated_at sans trigger
DO $$
DECLARE
  t TEXT;
  tables_with_updated_at TEXT[] := ARRAY[
    'organizations', 'users', 'queues', 'contacts', 'call_scripts',
    'ivr_configs', 'dialer_campaigns', 'robot_campaigns',
    'api_keys', 'webhooks', 'integrations', 'audio_files',
    'voicemails', 'agents', 'conversations', 'email_tickets'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_updated_at LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_%I_updated_at ON %I', t, t);
      EXECUTE format($p$
        CREATE TRIGGER tr_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION tf_set_updated_at()
      $p$, t, t);
    END IF;
  END LOOP;
END $$;
