-- ============================================================
--  VoxFlow -- Migration 050 -- DID Number Management
--  Tables: did_pricing, did_orders, did_identities,
--  did_porting_requests
-- ============================================================

-- 1) did_pricing
CREATE TABLE IF NOT EXISTS did_pricing (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code              TEXT NOT NULL,
  country_name              TEXT NOT NULL,
  region                    TEXT,
  area_code                 TEXT,
  did_type                  TEXT NOT NULL DEFAULT 'local',
  price_monthly             DECIMAL(10,2) NOT NULL,
  setup_fee                 DECIMAL(10,2) DEFAULT 0,
  requires_address          BOOLEAN DEFAULT FALSE,
  requires_documents        BOOLEAN DEFAULT FALSE,
  provisioning_time         TEXT DEFAULT 'instant',
  provisioning_description  TEXT,
  is_available              BOOLEAN DEFAULT TRUE,
  sort_order                INTEGER DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_did_pricing_country ON did_pricing(country_code);

-- 2) did_identities (before did_orders because FK)
CREATE TABLE IF NOT EXISTS did_identities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  company             TEXT,
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  state               TEXT,
  postal_code         TEXT,
  country_code        TEXT,
  document_type       TEXT,
  document_url        TEXT,
  status              TEXT DEFAULT 'pending',
  rejection_reason    TEXT,
  reviewed_by         TEXT REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_did_identities_org ON did_identities(organization_id);
CREATE INDEX IF NOT EXISTS idx_did_identities_status ON did_identities(status);

-- 3) did_orders
CREATE TABLE IF NOT EXISTS did_orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number                TEXT,
  country_code                TEXT,
  region                      TEXT,
  area_code                   TEXT,
  did_type                    TEXT DEFAULT 'local',
  twilio_sid                  TEXT,
  stripe_subscription_item_id TEXT,
  assigned_action_type        TEXT,
  assigned_action_id          TEXT,
  assigned_action_label       TEXT,
  description                 TEXT,
  identity_id                 UUID REFERENCES did_identities(id),
  monthly_cost                DECIMAL(10,2),
  is_free_included            BOOLEAN DEFAULT FALSE,
  status                      TEXT DEFAULT 'pending',
  purchased_at                TIMESTAMPTZ,
  suspended_at                TIMESTAMPTZ,
  canceled_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_did_orders_org ON did_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_did_orders_status ON did_orders(status);
CREATE INDEX IF NOT EXISTS idx_did_orders_phone ON did_orders(phone_number);

-- 4) did_porting_requests
CREATE TABLE IF NOT EXISTS did_porting_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number              TEXT NOT NULL,
  current_carrier           TEXT NOT NULL,
  account_number            TEXT,
  pin                       TEXT,
  authorized_name           TEXT NOT NULL,
  address                   TEXT NOT NULL,
  city                      TEXT,
  state                     TEXT,
  postal_code               TEXT,
  country_code              TEXT DEFAULT 'CA',
  document_url              TEXT,
  status                    TEXT DEFAULT 'submitted',
  rejection_reason          TEXT,
  estimated_completion_date DATE,
  submitted_at              TIMESTAMPTZ DEFAULT NOW(),
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_did_porting_org ON did_porting_requests(organization_id);

-- 5) Seed did_pricing
INSERT INTO did_pricing (country_code, country_name, did_type, price_monthly, requires_address, requires_documents, provisioning_time, provisioning_description, sort_order)
VALUES
  ('CA', 'Canada',      'local',    4.00, FALSE, FALSE, 'instant', NULL, 1),
  ('US', 'Etats-Unis',  'local',    4.00, FALSE, FALSE, 'instant', NULL, 2),
  ('FR', 'France',      'local',    7.00, TRUE,  TRUE,  '24h',     'Adresse francaise requise', 3),
  ('GB', 'Royaume-Uni', 'local',    7.00, TRUE,  FALSE, '24h',     NULL, 4),
  ('BE', 'Belgique',    'local',    7.00, TRUE,  TRUE,  '24h',     NULL, 5),
  ('DE', 'Allemagne',   'local',    8.00, TRUE,  TRUE,  '24h',     NULL, 6),
  ('ES', 'Espagne',     'local',    7.00, TRUE,  TRUE,  '24h',     NULL, 7),
  ('IT', 'Italie',      'local',    7.00, TRUE,  TRUE,  '24h',     NULL, 8),
  ('CH', 'Suisse',      'local',    9.00, TRUE,  TRUE,  '24h',     NULL, 9),
  ('NL', 'Pays-Bas',    'local',    7.00, TRUE,  FALSE, '24h',     NULL, 10),
  ('AU', 'Australie',   'local',    8.00, TRUE,  TRUE,  '24h',     'Required In Region', 11),
  ('IL', 'Israel',      'local',    9.00, TRUE,  TRUE,  '3-5days', NULL, 12),
  ('IN', 'Inde',        'local',   10.00, TRUE,  TRUE,  '3-5days', NULL, 13),
  ('CA', 'Canada',      'tollfree', 9.00, FALSE, FALSE, 'instant', NULL, 14),
  ('US', 'Etats-Unis',  'tollfree', 9.00, FALSE, FALSE, 'instant', NULL, 15)
ON CONFLICT DO NOTHING;

SELECT 'Migration 050 OK -- DID management tables + pricing' AS message;
