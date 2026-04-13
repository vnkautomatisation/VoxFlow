-- ============================================================
--  VoxFlow -- Migration 052 -- Predictive Dialer plans + tables
-- ============================================================

-- 1) Colonnes supplementaires plan_definitions
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS max_lines_per_agent INTEGER DEFAULT 3;

-- 2) Upsert 3 plans DIALER
INSERT INTO plan_definitions (
  id, name, description, price_monthly, price_yearly, currency,
  service_type, billing_cycle, is_public, sort_order,
  features, features_list, highlight,
  destinations, max_concurrent_calls, max_lines_per_agent
)
VALUES
(
  'DIALER_CA_US', 'Canada / USA',
  'Illimite fixes et mobiles Canada et USA — Predictive Dialer',
  8000, 80000, 'CAD', 'dialer', 'monthly', TRUE, 1,
  '{"outbound":true,"inbound":true,"amd":true,"csv_import":true,"crm":true,"supervision":true,"recording":true}'::jsonb,
  ARRAY['Appels sortants illimites CA/USA','Appels entrants illimites','Import CSV prospects','Detection repondeur AMD','Ratio appels ajustable','Scripts d''appel par campagne','Recyclage prospects automatique','CRM integre','Supervision live','Enregistrements','Statistiques campagnes','Export resultats CSV','RGPD liste noire','Presence locale numeros CA/USA'],
  FALSE,
  '["Canada fixes et mobiles","USA fixes et mobiles"]'::jsonb,
  5, 3
),
(
  'DIALER_CA_US_FR', 'Canada / USA / France',
  'Illimite fixes et mobiles Canada, USA et France — Predictive Dialer',
  11000, 110000, 'CAD', 'dialer', 'monthly', TRUE, 2,
  '{"outbound":true,"inbound":true,"amd":true,"csv_import":true,"crm":true,"supervision":true,"recording":true,"france":true}'::jsonb,
  ARRAY['Appels sortants illimites CA/USA','Appels sortants illimites France','Appels entrants illimites','Import CSV prospects','Detection repondeur AMD','Ratio appels ajustable','Scripts d''appel par campagne','Recyclage prospects automatique','CRM integre','Supervision live','Enregistrements','Statistiques campagnes','Export resultats CSV','RGPD liste noire','Presence locale numeros CA/USA','Presence locale numeros France'],
  TRUE,
  '["Canada fixes et mobiles","USA fixes et mobiles","France fixes et mobiles"]'::jsonb,
  10, 5
),
(
  'DIALER_INTL', 'International',
  'Illimite fixes et mobiles Canada, USA, France et Europe 30+ pays',
  14500, 145000, 'CAD', 'dialer', 'monthly', TRUE, 3,
  '{"outbound":true,"inbound":true,"amd":true,"csv_import":true,"crm":true,"supervision":true,"recording":true,"france":true,"europe":true,"api":true}'::jsonb,
  ARRAY['Appels sortants illimites CA/USA','Appels sortants illimites France','Appels sortants illimites Europe 30+ pays','Appels entrants illimites','Import CSV prospects','Detection repondeur AMD','Ratio appels ajustable','Scripts d''appel par campagne','Recyclage prospects automatique','CRM integre','Supervision live','Enregistrements','Statistiques campagnes','Export resultats CSV','RGPD liste noire','Presence locale numeros CA/USA','Presence locale numeros France','Presence locale numeros Europe'],
  FALSE,
  '["Canada fixes et mobiles","USA fixes et mobiles","France fixes et mobiles","Europe 30+ pays fixes et mobiles"]'::jsonb,
  20, 10
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features, features_list = EXCLUDED.features_list,
  highlight = EXCLUDED.highlight, sort_order = EXCLUDED.sort_order,
  destinations = EXCLUDED.destinations,
  max_concurrent_calls = EXCLUDED.max_concurrent_calls,
  max_lines_per_agent = EXCLUDED.max_lines_per_agent,
  updated_at = NOW();

-- 3) org_dialer_subscriptions
CREATE TABLE IF NOT EXISTS org_dialer_subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  plan_code                   TEXT NOT NULL,
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
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) dialer_campaigns
CREATE TABLE IF NOT EXISTS dialer_campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  status              TEXT DEFAULT 'draft',
  plan_code           TEXT,
  total_contacts      INTEGER DEFAULT 0,
  called              INTEGER DEFAULT 0,
  answered_human      INTEGER DEFAULT 0,
  answered_machine    INTEGER DEFAULT 0,
  no_answer           INTEGER DEFAULT 0,
  failed              INTEGER DEFAULT 0,
  blacklisted         INTEGER DEFAULT 0,
  talk_time_seconds   INTEGER DEFAULT 0,
  avg_call_duration   DECIMAL(10,2) DEFAULT 0,
  ratio               DECIMAL(4,2) DEFAULT 1.0,
  max_attempts        INTEGER DEFAULT 3,
  script_id           UUID,
  scheduled_at        TIMESTAMPTZ,
  timezone            TEXT DEFAULT 'America/Toronto',
  caller_id           TEXT,
  created_by          TEXT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialer_campaigns_org ON dialer_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_dialer_campaigns_status ON dialer_campaigns(status);

-- 5) dialer_contacts
CREATE TABLE IF NOT EXISTS dialer_contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL REFERENCES dialer_campaigns(id) ON DELETE CASCADE,
  organization_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone                 TEXT NOT NULL,
  first_name            TEXT,
  last_name             TEXT,
  company               TEXT,
  custom_fields         JSONB DEFAULT '{}'::jsonb,
  status                TEXT DEFAULT 'pending',
  call_attempts         INTEGER DEFAULT 0,
  call_duration_seconds DECIMAL(10,2) DEFAULT 0,
  twilio_call_sid       TEXT,
  last_attempt_at       TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialer_contacts_campaign ON dialer_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dialer_contacts_status ON dialer_contacts(status);

-- 6) dialer_blacklist
CREATE TABLE IF NOT EXISTS dialer_blacklist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone             TEXT NOT NULL,
  reason            TEXT,
  added_by          TEXT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, phone)
);

SELECT 'Migration 052 OK -- Predictive Dialer plans + tables' AS message;
