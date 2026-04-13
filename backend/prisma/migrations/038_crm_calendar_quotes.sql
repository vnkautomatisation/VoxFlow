-- Migration 038 — CRM calendrier + devis + templates email

CREATE TABLE IF NOT EXISTS appointments (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id       TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  agent_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')),
  location         TEXT,
  reminder_minutes INTEGER DEFAULT 15,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointments_org  ON appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_agent ON appointments(agent_id);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_appointments ON appointments;
CREATE POLICY org_appointments ON appointments USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text));

CREATE TABLE IF NOT EXISTS quotes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id       TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  number           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED')),
  items            JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 14.975,
  tax_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  valid_until      DATE,
  notes            TEXT,
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  pdf_url          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_quotes ON quotes;
CREATE POLICY org_quotes ON quotes USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text));

CREATE TABLE IF NOT EXISTS email_templates (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  subject          TEXT NOT NULL,
  body_html        TEXT NOT NULL DEFAULT '',
  variables        JSONB DEFAULT '[]'::jsonb,
  category         TEXT DEFAULT 'general',
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_tpl_org ON email_templates(organization_id);
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_email_templates ON email_templates;
CREATE POLICY org_email_templates ON email_templates USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()::text));
