-- ============================================================
--  VoxFlow -- Migration 044 -- Multi-service subscriptions
--  Nouveau modele: services separes (Telephonie, Dialer, Robot) + add-ons
--  Tous les prix en CAD (cents)
-- ============================================================

-- ── 1) Ajouter service_type et billing_cycle a plan_definitions ──
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'TELEPHONY';
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS features_list TEXT[] DEFAULT '{}';
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS highlight BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_plan_definitions_service_type ON plan_definitions(service_type);

-- ── 2) Supprimer les anciens plans et inserer les nouveaux ──
DELETE FROM plan_definitions WHERE id IN ('STARTER','BASIC','CONFORT','PRO','ENTERPRISE','TRIAL');

INSERT INTO plan_definitions (id, name, description, price_monthly, price_yearly, currency, max_agents, max_dids, max_calls_month, features, is_default, is_public, sort_order, service_type, features_list, highlight)
VALUES
-- ═══ TELEPHONIE D'ENTREPRISE ═══
('TEL_BASIC', 'Basic', 'Appels entrants, 1 numero DID, messagerie vocale, dialer HTML, historique 30j', 1400, 14000, 'CAD', 5, 1, NULL,
  '{"inbound_calls":true,"outbound_calls":false,"call_recording":false,"voicemails":true,"ivr_basic":false,"supervision":false,"crm_basic":false,"history":true,"click_to_call":false,"ai_transcription":false,"analytics":false,"api_access":false,"workflow_builder":false,"webhooks":false,"sla_guarantee":false,"priority_support":false}'::jsonb,
  TRUE, TRUE, 1, 'TELEPHONY',
  ARRAY['Appels entrants','1 numero DID','Messagerie vocale','Dialer HTML','Historique 30j'], FALSE),

('TEL_CONFORT', 'Confort', 'Appels sortants illimites CA/US, IVR basique, supervision live, CRM integre, historique 1 an', 3500, 35000, 'CAD', 15, 5, NULL,
  '{"inbound_calls":true,"outbound_calls":true,"call_recording":false,"voicemails":true,"ivr_basic":true,"supervision":true,"crm_basic":true,"history":true,"click_to_call":false,"ai_transcription":false,"analytics":false,"api_access":false,"workflow_builder":false,"webhooks":false,"sla_guarantee":false,"priority_support":false}'::jsonb,
  FALSE, TRUE, 2, 'TELEPHONY',
  ARRAY['+ Appels sortants illimites CA/US','+ IVR basique','+ Supervision live','+ CRM integre','+ Historique 1 an'], FALSE),

('TEL_PREMIUM', 'Premium', 'Illimite CA/US/FR, enregistrement appels, IA transcription Whisper, resume IA post-appel, analytics recharts, click-to-call CRM', 5500, 55000, 'CAD', 50, 15, NULL,
  '{"inbound_calls":true,"outbound_calls":true,"call_recording":true,"voicemails":true,"ivr_basic":true,"supervision":true,"crm_basic":true,"history":true,"click_to_call":true,"ai_transcription":true,"analytics":true,"api_access":false,"workflow_builder":false,"webhooks":false,"sla_guarantee":false,"priority_support":false}'::jsonb,
  FALSE, TRUE, 3, 'TELEPHONY',
  ARRAY['+ Illimite CA/US/FR','+ Enregistrement appels','+ IA transcription Whisper','+ Resume IA post-appel','+ Analytics recharts','+ Click-to-call CRM'], TRUE),

('TEL_PRO', 'Pro', 'Pays europeens illimite, workflow builder, API acces complet, webhooks custom, SLA 99.9%, support prioritaire', 8000, 80000, 'CAD', NULL, NULL, NULL,
  '{"inbound_calls":true,"outbound_calls":true,"call_recording":true,"voicemails":true,"ivr_basic":true,"supervision":true,"crm_basic":true,"history":true,"click_to_call":true,"ai_transcription":true,"analytics":true,"api_access":true,"workflow_builder":true,"webhooks":true,"sla_guarantee":true,"priority_support":true}'::jsonb,
  FALSE, TRUE, 4, 'TELEPHONY',
  ARRAY['+ Pays europeens illimite','+ Workflow builder','+ API acces complet','+ Webhooks custom','+ SLA 99.9%','+ Support prioritaire'], FALSE),

-- ═══ PREDICTIVE DIALER ═══
('DIALER_CA_US', 'Dialer CA/US', 'Campagnes sortantes, import CSV, detection repondeur, ratio ajustable, CRM integre, appels entrants inclus', 8000, 80000, 'CAD', NULL, NULL, NULL,
  '{"predictive_dialer":true,"outbound_calls":true,"inbound_calls":true,"csv_import":true,"amd_detection":true,"ratio_adjustment":true,"crm_basic":true}'::jsonb,
  FALSE, TRUE, 10, 'DIALER',
  ARRAY['Campagnes sortantes','Import CSV','Detection repondeur','Ratio ajustable','CRM integre','Appels entrants inclus'], FALSE),

('DIALER_FR_MOBILE', 'Dialer France Mobile', 'Tout Dialer CA/US + appels France fixes & mobiles illimites, presence locale FR, recyclage prospects auto', 11000, 110000, 'CAD', NULL, NULL, NULL,
  '{"predictive_dialer":true,"outbound_calls":true,"inbound_calls":true,"csv_import":true,"amd_detection":true,"ratio_adjustment":true,"crm_basic":true,"france_mobile":true,"local_presence":true,"prospect_recycling":true}'::jsonb,
  FALSE, TRUE, 11, 'DIALER',
  ARRAY['Tout Dialer CA/US','+ Appels France fixes & mobiles illimites','Presence locale FR','Recyclage prospects auto'], FALSE),

-- ═══ ROBOT D'APPEL MASSE ═══
('ROBOT', 'Robot d''appel', '150k appels/h, TTS dynamique, message vocal pre-enregistre, IVR post-robot (touche 1 → agent), RGPD liste noire, export resultats', 13500, NULL, 'CAD', NULL, NULL, 150000,
  '{"robot_dialer":true,"tts_dynamic":true,"pre_recorded":true,"ivr_post_robot":true,"blacklist_rgpd":true,"export_results":true}'::jsonb,
  FALSE, TRUE, 20, 'ROBOT',
  ARRAY['150k appels/h','TTS dynamique','Message vocal pre-enregistre','IVR post-robot (touche 1 -> agent)','RGPD liste noire','Export resultats'], FALSE)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency, max_agents = EXCLUDED.max_agents,
  max_dids = EXCLUDED.max_dids, max_calls_month = EXCLUDED.max_calls_month,
  features = EXCLUDED.features, is_default = EXCLUDED.is_default,
  is_public = EXCLUDED.is_public, sort_order = EXCLUDED.sort_order,
  service_type = EXCLUDED.service_type, features_list = EXCLUDED.features_list,
  highlight = EXCLUDED.highlight, updated_at = NOW();

-- ── 3) Update products (add-ons) avec nouveaux prix CAD ──
DELETE FROM products WHERE sku IN ('ADDON_DID','ADDON_RECORDING','ADDON_AI_TRANSCRIPTION','ADDON_SMS','ADDON_CRM_INTEGRATIONS','ADDON_MOBILE_APP');

INSERT INTO products (sku, name, description, category, price_monthly, setup_fee, is_active, sort_order)
VALUES
  ('ADDON_DID',               'Numero DID additionnel',  'Local / Gratuit / International|per_unit',       'ADDON', 700,  0, TRUE, 1),
  ('ADDON_RECORDING',         'Enregistrement etendu',   'Stockage 3 ans + export|per_user',               'ADDON', 700,  0, TRUE, 2),
  ('ADDON_AI_TRANSCRIPTION',  'IA transcription',        'Whisper + resume auto|per_user',                  'ADDON', 1100, 0, TRUE, 3),
  ('ADDON_SMS',               'SMS bidirectionnel',      '+ cout par SMS selon pays|per_unit',              'ADDON', 1400, 0, TRUE, 4),
  ('ADDON_CRM_INTEGRATIONS',  'Integrations CRM',       'HubSpot, Salesforce, Pipedrive|per_unit',         'ADDON', 2000, 0, TRUE, 5)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly, setup_fee = EXCLUDED.setup_fee,
  is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order;

-- ── 4) Table org_subscriptions (multi-service) ──
CREATE TABLE IF NOT EXISTS org_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id           TEXT NOT NULL REFERENCES plan_definitions(id),
  service_type      TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  billing_cycle     TEXT NOT NULL DEFAULT 'monthly',
  status            TEXT NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT,
  stripe_price_id   TEXT,
  unit_price        INTEGER NOT NULL DEFAULT 0,
  trial_ends_at     TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_subs_org ON org_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subs_status ON org_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_org_subs_service ON org_subscriptions(service_type);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION trigger_org_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS org_subscriptions_updated_at ON org_subscriptions;
CREATE TRIGGER org_subscriptions_updated_at
  BEFORE UPDATE ON org_subscriptions FOR EACH ROW
  EXECUTE FUNCTION trigger_org_subscriptions_updated_at();

-- ── 5) Table billing_events (audit trail) ──
CREATE TABLE IF NOT EXISTS billing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  description       TEXT,
  amount            INTEGER DEFAULT 0,
  currency          TEXT DEFAULT 'CAD',
  stripe_event_id   TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org ON billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at DESC);

-- ── 6) Ajouter colonnes manquantes a support_tickets ──
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ── 7) Enhance did_numbers / phone_numbers ──
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'CA';
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS action_target TEXT;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS monthly_cost INTEGER DEFAULT 700;

-- ── 8) Ajouter promo codes tracking ──
CREATE TABLE IF NOT EXISTS promo_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,
  type              TEXT NOT NULL DEFAULT 'percent',
  value             INTEGER NOT NULL DEFAULT 0,
  max_uses          INTEGER,
  current_uses      INTEGER NOT NULL DEFAULT 0,
  expires_at        TIMESTAMPTZ,
  stripe_coupon_id  TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 9) Migrate existing orgs to new plan structure ──
-- Map old plans to new ones
UPDATE organizations SET plan = 'TEL_BASIC' WHERE plan IN ('STARTER','BASIC','TRIAL');
UPDATE organizations SET plan = 'TEL_CONFORT' WHERE plan = 'CONFORT';
UPDATE organizations SET plan = 'TEL_PREMIUM' WHERE plan = 'PREMIUM';
UPDATE organizations SET plan = 'TEL_PRO' WHERE plan IN ('PRO','ENTERPRISE');

-- Ensure all orgs have a valid plan
UPDATE organizations SET plan = 'TEL_BASIC' WHERE plan IS NULL OR plan NOT IN (SELECT id FROM plan_definitions);

SELECT 'Migration 044 OK -- multi-service subscriptions' AS message;
