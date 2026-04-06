-- ============================================================
--  VoxFlow -- Migration 013 -- Portail Client
--
--  Contexte des migrations précédentes :
--    001 : organizations, users, calls, subscriptions (Stripe)
--    002 : agents, queues, ivr_configs, schedules, call_scripts
--    003 : sms_messages, ai_summaries
--    004 : auth_tokens, onboarding_progress + colonnes users/orgs
--    005 : contacts, contact_activities, contact_tags
--    006 : callbacks, queue_stats, routing_rules
--    007 : conversations, messages, email_tickets, chat_sessions
--    008 : dialer_campaigns, dialer_contacts, ai_coaching, call_quality_scores
--    009 : api_keys, webhooks, webhook_logs, integrations, sync_logs
--    010 : two_factor_auth, user_sessions, audit_logs
--    011 : colonnes VoIP sur calls, voicemails
--    012 : index supplémentaires sur calls
--
--  Cette migration ajoute :
--    - Colonnes billing sur organizations (plan/sièges/stripe sub)
--    - Table extensions (numéros de poste SIP)
--    - Table invoices (factures détaillées, distinct de subscriptions)
--    - Table support_tickets + support_messages
--    - Données de test
-- ============================================================

-- ── 1. Colonnes billing sur organizations ─────────────────────
-- NOTE: stripe_customer_id existe déjà (migration 004)
-- NOTE: plan existe déjà mais avec CHECK STARTER/PRO/ENTERPRISE
--       On drop le CHECK et on élargit les valeurs acceptées

-- Retirer l'ancienne contrainte CHECK sur plan si elle existe
DO $$
BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Mettre à jour les colonnes billing
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS seats                  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_cycle_end      TIMESTAMPTZ;

-- Remettre une contrainte CHECK élargie sur plan
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_plan_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN (
    'STARTER', 'PRO', 'ENTERPRISE',  -- valeurs legacy
    'basic', 'confort', 'premium'    -- valeurs portail client
  ));

-- ── 2. Extensions SIP (numéros de poste internes) ─────────────
CREATE TABLE IF NOT EXISTS extensions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  extension_number TEXT NOT NULL,
  label            TEXT NOT NULL DEFAULT '',
  did_number       TEXT REFERENCES phone_numbers(number) ON DELETE SET NULL,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, extension_number)
);

CREATE INDEX IF NOT EXISTS idx_extensions_org  ON extensions(organization_id);
CREATE INDEX IF NOT EXISTS idx_extensions_user ON extensions(user_id);

-- ── 3. Factures (distinct de subscriptions Stripe) ────────────
-- La table subscriptions (001) stocke l'état de l'abonnement Stripe.
-- Cette table stocke les factures individuelles avec leurs lignes.
CREATE TABLE IF NOT EXISTS invoices (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  number            TEXT NOT NULL UNIQUE,
  date              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date          TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('draft','open','paid','uncollectible','void','pending','overdue')),
  amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_tax        NUMERIC(10,2) DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'CAD',
  period            TEXT,
  items             JSONB DEFAULT '[]',
  pdf_url           TEXT,
  stripe_hosted_url TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org    ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ── 4. Tickets support (portail client) ───────────────────────
-- NOTE: email_tickets (migration 007) est pour les tickets entrants par email.
-- Cette table est pour les tickets créés depuis le portail client.
CREATE TABLE IF NOT EXISTS support_tickets (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  number           TEXT NOT NULL UNIQUE,
  subject          TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'Technique'
                     CHECK (category IN ('Téléphonie','Facturation','Compte','Technique','Autre')),
  priority         TEXT NOT NULL DEFAULT 'normal'
                     CHECK (priority IN ('low','normal','high','urgent')),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','pending','resolved','closed')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org    ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON support_tickets(user_id);

-- ── 5. Messages des tickets support ──────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_id  TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  from_role  TEXT NOT NULL CHECK (from_role IN ('user','support')),
  text       TEXT NOT NULL,
  at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);

-- ── 6. RLS sur les nouvelles tables ──────────────────────────
ALTER TABLE extensions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- ── 7. Données de test ────────────────────────────────────────

-- Mettre à jour l'org de test avec les données billing
UPDATE organizations
SET
  plan                 = 'confort',
  seats                = 3,
  subscription_status  = 'ACTIVE',
  billing_cycle_end    = NOW() + INTERVAL '30 days'
WHERE id = 'org_test_001';

-- Extensions SIP de test
INSERT INTO extensions (organization_id, extension_number, label)
SELECT 'org_test_001', '101', 'Accueil'
WHERE NOT EXISTS (SELECT 1 FROM extensions WHERE organization_id='org_test_001' AND extension_number='101');

INSERT INTO extensions (organization_id, extension_number, label)
SELECT 'org_test_001', '102', 'Support technique'
WHERE NOT EXISTS (SELECT 1 FROM extensions WHERE organization_id='org_test_001' AND extension_number='102');

INSERT INTO extensions (organization_id, extension_number, label)
SELECT 'org_test_001', '103', 'Ventes'
WHERE NOT EXISTS (SELECT 1 FROM extensions WHERE organization_id='org_test_001' AND extension_number='103');

-- Factures de test (3 mois)
INSERT INTO invoices (organization_id, number, date, due_date, status, amount, currency, period, items)
VALUES
  (
    'org_test_001',
    'VF-2026-003',
    '2026-04-01',
    '2026-04-15',
    'paid',
    177.00,
    'CAD',
    'Avril 2026',
    '[{"description":"Plan Confort — 3 sièges","qty":3,"unit_price":59.00,"total":177.00}]'
  ),
  (
    'org_test_001',
    'VF-2026-002',
    '2026-03-01',
    '2026-03-15',
    'paid',
    177.00,
    'CAD',
    'Mars 2026',
    '[{"description":"Plan Confort — 3 sièges","qty":3,"unit_price":59.00,"total":177.00}]'
  ),
  (
    'org_test_001',
    'VF-2026-001',
    '2026-02-01',
    '2026-02-15',
    'paid',
    154.50,
    'CAD',
    'Février 2026',
    '[{"description":"Plan Basic — 3 sièges","qty":3,"unit_price":29.00,"total":87.00},{"description":"Numéros DID supplémentaires","qty":3,"unit_price":2.50,"total":7.50},{"description":"Frais dépassement minutes","qty":60,"unit_price":1.00,"total":60.00}]'
  )
ON CONFLICT DO NOTHING;

SELECT 'Migration 013 Portail Client executee !' AS message;