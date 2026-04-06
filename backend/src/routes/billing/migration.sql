-- ================================================================
--  VoxFlow — Migration: Portail Client
--  À exécuter dans Supabase SQL Editor
-- ================================================================

-- ── Extensions SIP (numéros de poste) ───────────────────────────
CREATE TABLE IF NOT EXISTS extensions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  extension_number TEXT NOT NULL,
  label            TEXT NOT NULL DEFAULT '',
  did_number       TEXT,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, extension_number)
);

CREATE INDEX IF NOT EXISTS idx_extensions_org ON extensions(organization_id);

-- ── Factures ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  number           TEXT NOT NULL,
  date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date         TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','open','paid','uncollectible','void','pending','overdue')),
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'CAD',
  period           TEXT,
  items            JSONB DEFAULT '[]',
  pdf_url          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);

-- ── Tickets support ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  number           TEXT NOT NULL UNIQUE,
  subject          TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'Technique',
  priority         TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_org ON support_tickets(organization_id);

-- ── Messages des tickets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_id   TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  from_role   TEXT NOT NULL CHECK (from_role IN ('user','support')),
  text        TEXT NOT NULL,
  at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_ticket ON support_messages(ticket_id);

-- ── Colonnes billing sur organizations ───────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan                  TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS seats                 INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status   TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_ends_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_cycle_end     TIMESTAMPTZ;

-- ── Données de test ───────────────────────────────────────────────
-- Extensions pour l'org de test
INSERT INTO extensions (organization_id, extension_number, label, did_number)
VALUES
  ('org_test_001', '101', 'Accueil',          '+15140000001'),
  ('org_test_001', '102', 'Support technique', '+15140000002'),
  ('org_test_001', '103', 'Ventes',            NULL)
ON CONFLICT (organization_id, extension_number) DO NOTHING;

-- Plan et sièges pour l'org de test
UPDATE organizations
SET plan = 'confort', seats = 3,
    subscription_status = 'active',
    billing_cycle_end = NOW() + INTERVAL '30 days'
WHERE id = 'org_test_001';