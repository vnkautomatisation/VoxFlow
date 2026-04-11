-- ============================================================
--  VoxFlow -- Migration 027 -- Plan Definitions (features par forfait)
--  A executer dans Supabase SQL Editor
--
--  But : permettre au OWNER de CRUD des forfaits (plans) et de
--  definir pour chacun les features activees (outbound_calls,
--  messaging, ai, recording, etc.) via un JSONB. Les plans servent
--  de source de verite pour le gating UI dialer + backend enforcement.
-- ============================================================

-- ── 1) Table plan_definitions ────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_definitions (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  price_monthly     INTEGER NOT NULL DEFAULT 0,  -- en cents CAD
  price_yearly      INTEGER,                     -- optionnel (cents CAD)
  currency          TEXT NOT NULL DEFAULT 'CAD',
  max_agents        INTEGER,                     -- NULL = illimite
  max_dids          INTEGER,                     -- NULL = illimite
  max_calls_month   INTEGER,                     -- NULL = illimite
  features          JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  is_public         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  stripe_price_id   TEXT,                        -- pour mapping Stripe
  created_by        TEXT REFERENCES users(id)   ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_definitions_is_public  ON plan_definitions(is_public);
CREATE INDEX IF NOT EXISTS idx_plan_definitions_is_default ON plan_definitions(is_default);
CREATE INDEX IF NOT EXISTS idx_plan_definitions_sort_order ON plan_definitions(sort_order);

-- ── 2) Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_plan_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_definitions_updated_at_trigger ON plan_definitions;
CREATE TRIGGER plan_definitions_updated_at_trigger
  BEFORE UPDATE ON plan_definitions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_plan_definitions_updated_at();

-- ── 3) Seed des 5 plans par defaut + TRIAL ───────────────────
-- Les features sont un JSONB booleen par feature. Les clefs sont
-- utilisees par le middleware requireFeature() et le frontend
-- useFeatures() hook. Extensible sans migration (JSONB).

INSERT INTO plan_definitions (id, name, description, price_monthly, max_agents, max_dids, features, is_default, is_public, sort_order)
VALUES
-- ───────────── STARTER (trial par defaut, entrant seulement) ─────────────
(
  'STARTER',
  'Starter',
  'Parfait pour demarrer : reception d''appels, agents, historique et contacts. Pas d''appels sortants.',
  0, 3, 1,
  '{
    "outbound_calls": false,
    "inbound_calls": true,
    "queues": true,
    "agents_supervision": true,
    "history": true,
    "voicemails": true,
    "contacts_search": true,
    "messaging": false,
    "call_recording": false,
    "ai_transcription": false,
    "ai_sentiment": false,
    "robot_dialer": false,
    "crm_basic": true,
    "crm_advanced": false,
    "reports_basic": true,
    "reports_advanced": false,
    "api_access": false,
    "white_label": false
  }'::jsonb,
  TRUE, TRUE, 1
),
-- ───────────── BASIC (entrant + multicanal) ─────────────
(
  'BASIC',
  'Basic',
  'Ajoute le multicanal (SMS/WhatsApp/Chat/Email) a l''entrant. Toujours pas d''appels sortants.',
  2900, 5, 3,
  '{
    "outbound_calls": false,
    "inbound_calls": true,
    "queues": true,
    "agents_supervision": true,
    "history": true,
    "voicemails": true,
    "contacts_search": true,
    "messaging": true,
    "call_recording": false,
    "ai_transcription": false,
    "ai_sentiment": false,
    "robot_dialer": false,
    "crm_basic": true,
    "crm_advanced": false,
    "reports_basic": true,
    "reports_advanced": false,
    "api_access": false,
    "white_label": false
  }'::jsonb,
  FALSE, TRUE, 2
),
-- ───────────── CONFORT (appels sortants + enregistrement + IA) ─────────────
(
  'CONFORT',
  'Confort',
  'Forfait complet : appels entrants et sortants, enregistrement, transcription IA.',
  5900, 15, 10,
  '{
    "outbound_calls": true,
    "inbound_calls": true,
    "queues": true,
    "agents_supervision": true,
    "history": true,
    "voicemails": true,
    "contacts_search": true,
    "messaging": true,
    "call_recording": true,
    "ai_transcription": true,
    "ai_sentiment": false,
    "robot_dialer": false,
    "crm_basic": true,
    "crm_advanced": false,
    "reports_basic": true,
    "reports_advanced": false,
    "api_access": false,
    "white_label": false
  }'::jsonb,
  FALSE, TRUE, 3
),
-- ───────────── PRO (Confort + agents illimites + CRM avance) ─────────────
(
  'PRO',
  'Pro',
  'Equipes moyennes : agents illimites, CRM avance, analyse de sentiment, rapports avances.',
  9900, 50, 25,
  '{
    "outbound_calls": true,
    "inbound_calls": true,
    "queues": true,
    "agents_supervision": true,
    "history": true,
    "voicemails": true,
    "contacts_search": true,
    "messaging": true,
    "call_recording": true,
    "ai_transcription": true,
    "ai_sentiment": true,
    "robot_dialer": false,
    "crm_basic": true,
    "crm_advanced": true,
    "reports_basic": true,
    "reports_advanced": true,
    "api_access": true,
    "white_label": false
  }'::jsonb,
  FALSE, TRUE, 4
),
-- ───────────── ENTERPRISE (tout + robot dialer + white label) ─────────────
(
  'ENTERPRISE',
  'Enterprise',
  'Tout inclus : robot dialer (predictive dialer), API, white label, support dedie.',
  29900, NULL, NULL,
  '{
    "outbound_calls": true,
    "inbound_calls": true,
    "queues": true,
    "agents_supervision": true,
    "history": true,
    "voicemails": true,
    "contacts_search": true,
    "messaging": true,
    "call_recording": true,
    "ai_transcription": true,
    "ai_sentiment": true,
    "robot_dialer": true,
    "crm_basic": true,
    "crm_advanced": true,
    "reports_basic": true,
    "reports_advanced": true,
    "api_access": true,
    "white_label": true
  }'::jsonb,
  FALSE, TRUE, 5
),
-- ───────────── TRIAL (essai 14j, identique a STARTER mais non-public) ─────────────
(
  'TRIAL',
  'Essai 14 jours',
  'Essai gratuit 14 jours avec les fonctionnalites du forfait Starter.',
  0, 3, 1,
  '{
    "outbound_calls": false,
    "inbound_calls": true,
    "queues": true,
    "agents_supervision": true,
    "history": true,
    "voicemails": true,
    "contacts_search": true,
    "messaging": false,
    "call_recording": false,
    "ai_transcription": false,
    "ai_sentiment": false,
    "robot_dialer": false,
    "crm_basic": true,
    "crm_advanced": false,
    "reports_basic": true,
    "reports_advanced": false,
    "api_access": false,
    "white_label": false
  }'::jsonb,
  FALSE, FALSE, 0
)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  description       = EXCLUDED.description,
  price_monthly     = EXCLUDED.price_monthly,
  max_agents        = EXCLUDED.max_agents,
  max_dids          = EXCLUDED.max_dids,
  features          = EXCLUDED.features,
  is_default        = EXCLUDED.is_default,
  is_public         = EXCLUDED.is_public,
  sort_order        = EXCLUDED.sort_order,
  updated_at        = NOW();

-- ── 4) Normaliser organizations.plan en majuscules ──────────
-- Les plans legacy etaient stockes en minuscules ("basic", "confort")
-- avec un CHECK constraint qui ne permet que ces 3 valeurs. On drop
-- le CHECK d'abord, on normalise ensuite, et la FK virtuelle vers
-- plan_definitions sert de nouvelle source de verite.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;

UPDATE organizations
SET plan = UPPER(plan)
WHERE plan IS NOT NULL
  AND plan != UPPER(plan);

-- Mapping des anciens IDs non reconnus vers STARTER par securite
UPDATE organizations
SET plan = 'STARTER'
WHERE plan IS NULL
   OR plan NOT IN (SELECT id FROM plan_definitions);

-- ── 5) Verification finale ───────────────────────────────────
SELECT
  'Migration 027 OK -- ' || COUNT(*) || ' forfaits crees' AS message
FROM plan_definitions;
