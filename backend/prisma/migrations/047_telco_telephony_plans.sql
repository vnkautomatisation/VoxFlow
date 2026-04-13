-- ============================================================
--  VoxFlow -- Migration 047 -- TELCO telephony plans
--  Nouveaux plan codes TELCO_* avec destinations, sms_included,
--  et colonnes Stripe multi-price (monthly/yearly)
-- ============================================================

-- 1) Nouvelles colonnes sur plan_definitions
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS destinations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS sms_included INTEGER DEFAULT 0;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;

-- 2) Ajouter stripe_customer_id sur org_subscriptions si absent
ALTER TABLE org_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 3) Features communes telephonie
-- Toutes identiques pour les 4 plans TELCO_*

-- 4) Upsert des 4 plans TELCO_*
INSERT INTO plan_definitions (
  id, name, description, price_monthly, price_yearly, currency,
  service_type, billing_cycle, is_public, sort_order,
  features, features_list, highlight,
  destinations, sms_included
)
VALUES
-- TELCO_INBOUND
(
  'TELCO_INBOUND', 'Entrants', 'Appels entrants illimites uniquement. Sortants factures a la minute.',
  1900, 19000, 'CAD',
  'TELEPHONY', 'monthly', TRUE, 1,
  '{"inbound_calls":true,"outbound_calls":false,"voicemails":true,"ivr_basic":true,"supervision":true,"crm_basic":true,"history":true}'::jsonb,
  ARRAY[
    'Appels entrants illimites','1 numero DID inclus','Messagerie vocale','IVR 1 niveau',
    'Dialer web et app','Files d''attente ACD','Supervision live agents','Ecoute et soufflage',
    'CRM integre','Prospects et calendrier','Modeles et devis','Journal d''appels',
    'Enregistrements','Statistiques','Applications et integrations','Parc telephonique',
    'Support email','Historique 30 jours'
  ],
  FALSE,
  '[]'::jsonb,
  200
),
-- TELCO_CA_US
(
  'TELCO_CA_US', 'Canada / USA', 'Illimite fixes et mobiles Canada et USA',
  3500, 35000, 'CAD',
  'TELEPHONY', 'monthly', TRUE, 2,
  '{"inbound_calls":true,"outbound_calls":true,"voicemails":true,"ivr_basic":true,"supervision":true,"crm_basic":true,"history":true}'::jsonb,
  ARRAY[
    'Appels entrants illimites','1 numero DID inclus','Messagerie vocale','IVR 1 niveau',
    'Dialer web et app','Files d''attente ACD','Supervision live agents','Ecoute et soufflage',
    'CRM integre','Prospects et calendrier','Modeles et devis','Journal d''appels',
    'Enregistrements','Statistiques','Applications et integrations','Parc telephonique',
    'Support email','Historique 30 jours'
  ],
  FALSE,
  '["Canada fixes et mobiles","USA fixes et mobiles"]'::jsonb,
  500
),
-- TELCO_CA_US_FR
(
  'TELCO_CA_US_FR', 'Canada / USA / France', 'Illimite fixes et mobiles Canada, USA et France',
  5000, 50000, 'CAD',
  'TELEPHONY', 'monthly', TRUE, 3,
  '{"inbound_calls":true,"outbound_calls":true,"voicemails":true,"ivr_basic":true,"supervision":true,"crm_basic":true,"history":true}'::jsonb,
  ARRAY[
    'Appels entrants illimites','1 numero DID inclus','Messagerie vocale','IVR 1 niveau',
    'Dialer web et app','Files d''attente ACD','Supervision live agents','Ecoute et soufflage',
    'CRM integre','Prospects et calendrier','Modeles et devis','Journal d''appels',
    'Enregistrements','Statistiques','Applications et integrations','Parc telephonique',
    'Support email','Historique 30 jours'
  ],
  TRUE,
  '["Canada fixes et mobiles","USA fixes et mobiles","France fixes et mobiles"]'::jsonb,
  1000
),
-- TELCO_INTL
(
  'TELCO_INTL', 'International', 'Illimite fixes et mobiles Canada, USA, France et Europe 30+ pays',
  7500, 75000, 'CAD',
  'TELEPHONY', 'monthly', TRUE, 4,
  '{"inbound_calls":true,"outbound_calls":true,"voicemails":true,"ivr_basic":true,"supervision":true,"crm_basic":true,"history":true}'::jsonb,
  ARRAY[
    'Appels entrants illimites','1 numero DID inclus','Messagerie vocale','IVR 1 niveau',
    'Dialer web et app','Files d''attente ACD','Supervision live agents','Ecoute et soufflage',
    'CRM integre','Prospects et calendrier','Modeles et devis','Journal d''appels',
    'Enregistrements','Statistiques','Applications et integrations','Parc telephonique',
    'Support email','Historique 30 jours'
  ],
  FALSE,
  '["Canada fixes et mobiles","USA fixes et mobiles","France fixes et mobiles","Europe 30+ pays fixes et mobiles"]'::jsonb,
  2000
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  features_list = EXCLUDED.features_list,
  highlight = EXCLUDED.highlight,
  sort_order = EXCLUDED.sort_order,
  destinations = EXCLUDED.destinations,
  sms_included = EXCLUDED.sms_included,
  updated_at = NOW();

SELECT 'Migration 047 OK -- 4 TELCO plans upserted' AS message;
