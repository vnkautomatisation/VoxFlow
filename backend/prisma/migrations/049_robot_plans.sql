-- ============================================================
--  VoxFlow -- Migration 049 -- Robot d'appel masse
--  Plans ROBOT_*, tables org_robot_subscriptions, robot_minutes_usage,
--  robot_campaigns, robot_contacts, robot_blacklist, robot_credits
-- ============================================================

-- 1) Nouvelles colonnes sur plan_definitions
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS minutes_included INTEGER DEFAULT 0;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS max_concurrent_calls INTEGER DEFAULT 20;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS max_contacts_per_campaign INTEGER DEFAULT 10000;

-- 2) Upsert 3 ROBOT plans
INSERT INTO plan_definitions (
  id, name, description, price_monthly, price_yearly, currency,
  service_type, billing_cycle, is_public, sort_order,
  features, features_list, highlight,
  minutes_included, overage_rate, max_concurrent_calls, max_contacts_per_campaign
)
VALUES
(
  'ROBOT_STARTER', 'Robot Starter', '2000 minutes incluses par mois',
  4900, 49000, 'CAD', 'robot', 'monthly', TRUE, 1,
  '{"tts":true,"audio":true,"ivr":true,"amd":true,"gdpr":true,"export":true}'::jsonb,
  ARRAY['2000 minutes incluses','TTS dynamique francais et anglais','Audio pre-enregistre MP3','IVR post-appel touche 1 agent','AMD detection repondeur','RGPD liste noire auto','Export resultats CSV','Rapport par campagne','20 appels simultanes max','10 000 contacts par campagne'],
  FALSE, 2000, 0.0500, 20, 10000
),
(
  'ROBOT_BUSINESS', 'Robot Business', '8000 minutes incluses par mois',
  12900, 129000, 'CAD', 'robot', 'monthly', TRUE, 2,
  '{"tts":true,"audio":true,"ivr":true,"amd":true,"gdpr":true,"export":true,"webhook":true,"transfer":true,"multi_campaign":true}'::jsonb,
  ARRAY['8000 minutes incluses','Tout Robot Starter inclus','100 appels simultanes max','100 000 contacts par campagne','Campagnes multiples simultanees','Transfert vers agent en direct','Webhook resultats temps reel','Rapport detaille par campagne','Support prioritaire'],
  TRUE, 8000, 0.0400, 100, 100000
),
(
  'ROBOT_ENTERPRISE', 'Robot Enterprise', '25000 minutes incluses par mois',
  29900, 299000, 'CAD', 'robot', 'monthly', TRUE, 3,
  '{"tts":true,"audio":true,"ivr":true,"amd":true,"gdpr":true,"export":true,"webhook":true,"transfer":true,"multi_campaign":true,"api":true,"sla":true,"local_presence":true}'::jsonb,
  ARRAY['25000 minutes incluses','Tout Robot Business inclus','500 appels simultanes max','Contacts illimites par campagne','Numeros de presence locale','API acces complet','SLA 99.9%','Support dedie','Onboarding personnalise'],
  FALSE, 25000, 0.0300, 500, 0
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features, features_list = EXCLUDED.features_list,
  highlight = EXCLUDED.highlight, sort_order = EXCLUDED.sort_order,
  minutes_included = EXCLUDED.minutes_included, overage_rate = EXCLUDED.overage_rate,
  max_concurrent_calls = EXCLUDED.max_concurrent_calls,
  max_contacts_per_campaign = EXCLUDED.max_contacts_per_campaign,
  updated_at = NOW();

-- 3) org_robot_subscriptions
CREATE TABLE IF NOT EXISTS org_robot_subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
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
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) robot_minutes_usage
CREATE TABLE IF NOT EXISTS robot_minutes_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month             DATE NOT NULL,
  minutes_used      DECIMAL(10,2) DEFAULT 0,
  minutes_included  INTEGER DEFAULT 0,
  minutes_overage   DECIMAL(10,2) DEFAULT 0,
  overage_amount    DECIMAL(10,2) DEFAULT 0,
  overage_invoiced  BOOLEAN DEFAULT FALSE,
  alert_80_sent     BOOLEAN DEFAULT FALSE,
  alert_100_sent    BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, month)
);

-- 5) robot_campaigns (new unified table)
CREATE TABLE IF NOT EXISTS robot_campaigns_v2 (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  plan_code               TEXT,
  gdpr_consent_confirmed  BOOLEAN DEFAULT FALSE,
  message_type            TEXT NOT NULL DEFAULT 'tts',
  message_content         TEXT,
  message_audio_url       TEXT,
  language                TEXT DEFAULT 'fr',
  after_answer_action     TEXT DEFAULT 'hangup',
  after_answer_action_id  TEXT,
  after_answer_action_type TEXT,
  caller_id               TEXT,
  max_attempts            INTEGER DEFAULT 3,
  scheduled_at            TIMESTAMPTZ,
  timezone                TEXT DEFAULT 'America/Toronto',
  status                  TEXT DEFAULT 'draft',
  total_contacts          INTEGER DEFAULT 0,
  called                  INTEGER DEFAULT 0,
  answered_human          INTEGER DEFAULT 0,
  answered_machine        INTEGER DEFAULT 0,
  no_answer               INTEGER DEFAULT 0,
  failed                  INTEGER DEFAULT 0,
  blacklisted             INTEGER DEFAULT 0,
  minutes_used            DECIMAL(10,2) DEFAULT 0,
  twilio_call_sids        JSONB DEFAULT '[]'::jsonb,
  created_by              TEXT REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robot_campaigns_v2_org ON robot_campaigns_v2(organization_id);
CREATE INDEX IF NOT EXISTS idx_robot_campaigns_v2_status ON robot_campaigns_v2(status);

-- 6) robot_contacts
CREATE TABLE IF NOT EXISTS robot_contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL REFERENCES robot_campaigns_v2(id) ON DELETE CASCADE,
  organization_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone                 TEXT NOT NULL,
  first_name            TEXT,
  last_name             TEXT,
  custom_fields         JSONB DEFAULT '{}'::jsonb,
  status                TEXT DEFAULT 'pending',
  call_attempts         INTEGER DEFAULT 0,
  call_duration_seconds DECIMAL(10,2) DEFAULT 0,
  twilio_call_sid       TEXT,
  last_attempt_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robot_contacts_campaign ON robot_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_robot_contacts_status ON robot_contacts(status);

-- 7) robot_blacklist
CREATE TABLE IF NOT EXISTS robot_blacklist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone             TEXT NOT NULL,
  reason            TEXT,
  added_by          TEXT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, phone)
);

-- 8) robot_credits
CREATE TABLE IF NOT EXISTS robot_credits (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  minutes_purchased         INTEGER NOT NULL,
  amount_paid               DECIMAL(10,2),
  stripe_payment_intent_id  TEXT UNIQUE,
  status                    TEXT DEFAULT 'active',
  minutes_remaining         INTEGER,
  expires_at                TIMESTAMPTZ DEFAULT NOW() + INTERVAL '12 months',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robot_credits_org ON robot_credits(organization_id);

SELECT 'Migration 049 OK -- robot plans + tables' AS message;
