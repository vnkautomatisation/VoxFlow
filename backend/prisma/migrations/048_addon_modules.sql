-- ============================================================
--  VoxFlow -- Migration 048 -- Addon modules billing
--  Tables org_addons, sms_usage + 5 MODULE_* plans
-- ============================================================

-- 1) Nouvelles colonnes sur plan_definitions
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS module_type TEXT DEFAULT NULL;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS is_addon BOOLEAN DEFAULT FALSE;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS sms_overage_rate DECIMAL(10,4) DEFAULT 0;

-- 2) Table org_addons
CREATE TABLE IF NOT EXISTS org_addons (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_type                 TEXT NOT NULL,
  plan_code                   TEXT,
  stripe_subscription_id      TEXT,
  stripe_subscription_item_id TEXT,
  stripe_customer_id          TEXT,
  billing_cycle               TEXT DEFAULT 'monthly',
  status                      TEXT DEFAULT 'trialing',
  quantity                    INTEGER DEFAULT 1,
  trial_ends_at               TIMESTAMPTZ,
  current_period_start        TIMESTAMPTZ DEFAULT NOW(),
  current_period_end          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  canceled_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, module_type)
);

CREATE INDEX IF NOT EXISTS idx_org_addons_org ON org_addons(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_addons_status ON org_addons(status);
CREATE INDEX IF NOT EXISTS idx_org_addons_module ON org_addons(module_type);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trigger_org_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS org_addons_updated_at ON org_addons;
CREATE TRIGGER org_addons_updated_at
  BEFORE UPDATE ON org_addons FOR EACH ROW
  EXECUTE FUNCTION trigger_org_addons_updated_at();

-- 3) Table sms_usage
CREATE TABLE IF NOT EXISTS sms_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month             DATE NOT NULL,
  sms_sent          INTEGER DEFAULT 0,
  sms_received      INTEGER DEFAULT 0,
  sms_included      INTEGER DEFAULT 1000,
  sms_overage       INTEGER DEFAULT 0,
  overage_amount    DECIMAL(10,2) DEFAULT 0,
  overage_invoiced  BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, month)
);

CREATE INDEX IF NOT EXISTS idx_sms_usage_org ON sms_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_usage_month ON sms_usage(month DESC);

-- 4) Upsert 5 MODULE_* plans
INSERT INTO plan_definitions (
  id, name, description, price_monthly, price_yearly, currency,
  service_type, billing_cycle, is_public, sort_order,
  features, features_list, highlight,
  module_type, is_addon, sms_overage_rate
)
VALUES
-- MODULE_IA_BASIC
(
  'MODULE_IA_BASIC', 'IA Basique', 'Transcription automatique et resume post-appel',
  2000, 20000, 'CAD', 'addon', 'monthly', TRUE, 1,
  '{"transcription":true,"summary":true,"quality_score":true,"keywords":true}'::jsonb,
  ARRAY['Transcription Whisper en temps reel','Resume automatique post-appel','Score qualite agent','Detection mots-cles','Historique transcriptions 1 an','Export transcriptions CSV'],
  FALSE, 'ia_basic', TRUE, 0
),
-- MODULE_IA_COACHING
(
  'MODULE_IA_COACHING', 'IA Coaching Live', 'Coaching en temps reel pendant les appels',
  4500, 45000, 'CAD', 'addon', 'monthly', TRUE, 2,
  '{"transcription":true,"summary":true,"quality_score":true,"keywords":true,"coaching":true,"sentiment":true,"playbook":true}'::jsonb,
  ARRAY['Tout IA Basique inclus','Coaching temps reel sur ecran agent','Analyse sentiment client','Enforcement playbook automatique','Scoring appels personnalisable','Suggestions reponses en direct','Rapport coaching hebdomadaire','Alertes superviseur automatiques'],
  FALSE, 'ia_coaching', TRUE, 0
),
-- MODULE_CAMPAIGNS
(
  'MODULE_CAMPAIGNS', 'Campagnes + AMD', 'Campagnes sortantes avec detection repondeur automatique',
  2500, 25000, 'CAD', 'addon', 'monthly', TRUE, 3,
  '{"campaigns":true,"csv_import":true,"amd":true,"fax_detection":true,"ratio_adjustment":true,"scripts":true}'::jsonb,
  ARRAY['Campagnes sortantes illimitees','Import CSV prospects','Detection repondeur AMD','Detection fax et mauvais numeros','Ratio appels ajustable','Scripts d''appel par campagne','Recyclage prospects automatique','Rapport AMD detaille','Export resultats campagne'],
  FALSE, 'campaigns', TRUE, 0
),
-- MODULE_ANALYTICS
(
  'MODULE_ANALYTICS', 'Analytics+', 'Rapports avances et historique illimite',
  1500, 15000, 'CAD', 'addon', 'monthly', TRUE, 4,
  '{"advanced_reports":true,"unlimited_history":true,"heatmap":true,"trends":true,"export_csv":true,"export_pdf":true}'::jsonb,
  ARRAY['Rapports avances personnalisables','Historique donnees illimite','Heatmap volume par heure','Tendances quotidiennes et mensuelles','Stats par agent et par campagne','Export CSV et PDF','Rapports planifies par email','Tableaux de bord personnalises'],
  FALSE, 'analytics', TRUE, 0
),
-- MODULE_SMS
(
  'MODULE_SMS', 'SMS Inbox', 'Inbox SMS bidirectionnelle avec 1000 SMS inclus par mois',
  1800, 18000, 'CAD', 'addon', 'monthly', TRUE, 5,
  '{"sms_inbox":true,"templates":true,"automations":true,"bulk":true,"auto_reply":true}'::jsonb,
  ARRAY['1000 SMS inclus par mois','Inbox partagee equipe','Templates SMS reutilisables','Automations SMS CRM triggers','Campagnes SMS bulk','Reponse automatique','Historique conversations','RGPD opt-out automatique'],
  FALSE, 'sms', TRUE, 0.0180
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  features_list = EXCLUDED.features_list,
  sort_order = EXCLUDED.sort_order,
  module_type = EXCLUDED.module_type,
  is_addon = EXCLUDED.is_addon,
  sms_overage_rate = EXCLUDED.sms_overage_rate,
  updated_at = NOW();

SELECT 'Migration 048 OK -- addon modules + org_addons + sms_usage' AS message;
