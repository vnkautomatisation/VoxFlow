-- ============================================================
--  VoxFlow -- Migration 005 -- CRM Contacts Phase 3
--  A executer dans Supabase SQL Editor
-- ============================================================

-- Table contacts (CRM principal)
CREATE TABLE IF NOT EXISTS contacts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Infos de base
  first_name      TEXT NOT NULL DEFAULT '',
  last_name       TEXT NOT NULL DEFAULT '',
  email           TEXT,
  phone           TEXT,
  phone_2         TEXT,
  company         TEXT,
  job_title       TEXT,
  website         TEXT,

  -- Adresse
  address         TEXT,
  city            TEXT,
  province        TEXT DEFAULT 'QC',
  country         TEXT DEFAULT 'CA',
  postal_code     TEXT,

  -- CRM
  status          TEXT DEFAULT 'LEAD',
  source          TEXT DEFAULT 'MANUAL',
  assigned_to     TEXT REFERENCES users(id) ON DELETE SET NULL,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  score           INTEGER DEFAULT 0,

  -- Pipeline
  pipeline_stage  TEXT DEFAULT 'NEW',
  deal_value      DECIMAL(10,2) DEFAULT 0,
  deal_currency   TEXT DEFAULT 'CAD',
  deal_close_date TIMESTAMPTZ,

  -- Champs personnalises (JSON flexible)
  custom_fields   JSONB DEFAULT '{}',

  -- Timestamps
  last_contact_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_contacts_org       ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone     ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email     ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company   ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned  ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_status    ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_stage     ON contacts(pipeline_stage);

-- Table contact_activities (historique 360)
CREATE TABLE IF NOT EXISTS contact_activities (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_id      TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL, -- CALL | SMS | NOTE | EMAIL | MEETING | TASK
  direction       TEXT,          -- INBOUND | OUTBOUND
  content         TEXT,
  duration        INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'COMPLETED',
  agent_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  call_id         TEXT REFERENCES calls(id) ON DELETE SET NULL,
  scheduled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_contact ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_org     ON contact_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_type    ON contact_activities(type);

-- Lier les appels aux contacts
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id);

-- Table contact_tags (tags predefinies par org)
CREATE TABLE IF NOT EXISTS contact_tags (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#6366f1',
  UNIQUE(organization_id, name)
);

-- Inserer des tags par defaut pour l org de test
INSERT INTO contact_tags (organization_id, name, color)
SELECT id, 'Client', '#16a34a' FROM organizations WHERE slug = 'entreprise-test' ON CONFLICT DO NOTHING;
INSERT INTO contact_tags (organization_id, name, color)
SELECT id, 'Prospect', '#2563eb' FROM organizations WHERE slug = 'entreprise-test' ON CONFLICT DO NOTHING;
INSERT INTO contact_tags (organization_id, name, color)
SELECT id, 'VIP', '#9333ea' FROM organizations WHERE slug = 'entreprise-test' ON CONFLICT DO NOTHING;
INSERT INTO contact_tags (organization_id, name, color)
SELECT id, 'Support', '#d97706' FROM organizations WHERE slug = 'entreprise-test' ON CONFLICT DO NOTHING;

-- Contacts de test
INSERT INTO contacts (organization_id, first_name, last_name, email, phone, company, job_title, status, pipeline_stage, tags, score)
SELECT
  o.id, 'Jean', 'Tremblay', 'jean.tremblay@acme.com', '+15141234567',
  'Acme Industries', 'Directeur TI', 'CLIENT', 'WON', ARRAY['Client','VIP'], 85
FROM organizations o WHERE o.slug = 'entreprise-test' ON CONFLICT DO NOTHING;

INSERT INTO contacts (organization_id, first_name, last_name, email, phone, company, job_title, status, pipeline_stage, tags, score)
SELECT
  o.id, 'Marie', 'Gagnon', 'marie.gagnon@startup.io', '+15149876543',
  'Startup QC', 'CEO', 'LEAD', 'QUALIFIED', ARRAY['Prospect'], 65
FROM organizations o WHERE o.slug = 'entreprise-test' ON CONFLICT DO NOTHING;

INSERT INTO contacts (organization_id, first_name, last_name, email, phone, company, status, pipeline_stage, tags, score)
SELECT
  o.id, 'Pierre', 'Bouchard', 'pierre@gmail.com', '+14381112233',
  'Freelance', 'PROSPECT', 'NEW', ARRAY['Prospect'], 30
FROM organizations o WHERE o.slug = 'entreprise-test' ON CONFLICT DO NOTHING;

SELECT 'Migration 005 CRM executee avec succes !' AS message;
