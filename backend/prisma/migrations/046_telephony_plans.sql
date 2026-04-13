-- ══════════════════════════════════════════════════════════
-- 046 — Telephony per-agent plans (Kavkom-style)
-- 4 forfaits telephonie avec prix par agent/mois
-- ══════════════════════════════════════════════════════════

-- Insert the 4 telephony plans into plan_definitions
INSERT INTO plan_definitions (id, name, description, price_monthly, price_yearly, currency, service_type, billing_cycle, is_public, sort_order, features, features_list)
VALUES
  ('ENTRANTS', 'Entrants', 'Appels entrants uniquement', 1900, 1577, 'CAD', 'TELEPHONY', 'monthly', true, 10,
   '{"inbound": true, "outbound": false}'::jsonb,
   ARRAY['Appels entrants illimites', 'Messagerie vocale', 'IVR basique', 'Historique 30j']),

  ('CANADA_USA', 'Canada/USA', 'Illimite fixes et mobiles : Canada et USA', 3500, 2905, 'CAD', 'TELEPHONY', 'monthly', true, 20,
   '{"inbound": true, "outbound": true, "destinations": ["CA", "US"]}'::jsonb,
   ARRAY['Appels entrants illimites', 'Sortants illimites CA/US', 'Fixes et mobiles', 'Supervision live']),

  ('CANADA_USA_FRANCE', 'Canada/USA/France', 'Illimite fixes et mobiles : Canada, USA et France', 5000, 4150, 'CAD', 'TELEPHONY', 'monthly', true, 30,
   '{"inbound": true, "outbound": true, "destinations": ["CA", "US", "FR"]}'::jsonb,
   ARRAY['Appels entrants illimites', 'Sortants illimites CA/US/FR', 'Fixes et mobiles', 'Enregistrement appels']),

  ('INTERNATIONAL', 'International', 'Illimite fixes et mobiles : pays Europeens', 7500, 6225, 'CAD', 'TELEPHONY', 'monthly', true, 40,
   '{"inbound": true, "outbound": true, "destinations": ["CA", "US", "FR", "EU"]}'::jsonb,
   ARRAY['Appels entrants illimites', 'Sortants illimites 33 pays', 'Fixes et mobiles', 'Support prioritaire', 'SLA 99.9%'])

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  features_list = EXCLUDED.features_list,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Ensure extensions table has plan_id column for per-agent plans
-- (already exists from migration 028, but ensure it allows our new plan codes)
-- No schema change needed — plan_id is TEXT and accepts any value.
