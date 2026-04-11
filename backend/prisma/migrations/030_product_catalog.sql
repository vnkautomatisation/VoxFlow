-- ============================================================
--  VoxFlow -- Migration 030 -- Product catalog + phone_numbers enrichi
--  A executer dans Supabase SQL Editor
--
--  But :
--   1. Creer une table products (catalogue de SKU vendables par VNK :
--      numeros Twilio par region, services IA, options addons).
--   2. Enrichir phone_numbers avec les colonnes necessaires au
--      "number wizard" (buy/release via Twilio) : capabilities,
--      price_per_month, status, extension_id, product_sku.
--
--  Philosophie : phone_numbers est la table d'inventaire (numeros
--  reellement possedes par une org), products est le catalogue
--  (ce qu'on peut acheter, avec prix et dispo).
-- ============================================================

-- ── 1) Table products (catalogue) ────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sku             TEXT UNIQUE NOT NULL,
  category        TEXT NOT NULL
                    CHECK (category IN ('PHONE_NUMBER', 'ADDON', 'SERVICE', 'AI_CREDIT')),
  name            TEXT NOT NULL,
  description     TEXT,
  country         TEXT,                -- ISO code, NULL pour services non-geo
  region          TEXT,                -- ex : 'Quebec', 'Ontario'
  number_type     TEXT                 -- local, tollfree, mobile, NULL si pas un numero
                    CHECK (number_type IS NULL OR number_type IN ('LOCAL', 'TOLLFREE', 'MOBILE', 'INTERNATIONAL')),
  capabilities    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- capabilities ex : { "voice": true, "sms": true, "mms": false, "whatsapp": false }
  price_monthly   INTEGER NOT NULL DEFAULT 0,  -- cents CAD
  setup_fee       INTEGER NOT NULL DEFAULT 0,  -- cents CAD, one-time
  available_qty   INTEGER,                     -- NULL = illimite
  stripe_price_id TEXT,                        -- mapping Stripe pour checkout
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_country   ON products(country);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku       ON products(sku);

-- ── 2) Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at_trigger ON products;
CREATE TRIGGER products_updated_at_trigger
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_products_updated_at();

-- ── 3) Enrichir phone_numbers ────────────────────────────────
-- La table phone_numbers (migration 001) a un schema minimaliste.
-- On ajoute les colonnes necessaires au number wizard + billing.
ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS extension_id    TEXT REFERENCES extensions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_sku     TEXT REFERENCES products(sku)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capabilities    JSONB NOT NULL DEFAULT '{"voice": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS price_monthly   INTEGER NOT NULL DEFAULT 0,  -- cents CAD
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'RELEASED', 'PENDING_PURCHASE', 'PENDING_RELEASE')),
  ADD COLUMN IF NOT EXISTS friendly_name   TEXT,
  ADD COLUMN IF NOT EXISTS region           TEXT,
  ADD COLUMN IF NOT EXISTS purchased_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_phone_numbers_status      ON phone_numbers(status);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_extension   ON phone_numbers(extension_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_product_sku ON phone_numbers(product_sku);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_country     ON phone_numbers(country);

-- Trigger updated_at sur phone_numbers
CREATE OR REPLACE FUNCTION trigger_phone_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS phone_numbers_updated_at_trigger ON phone_numbers;
CREATE TRIGGER phone_numbers_updated_at_trigger
  BEFORE UPDATE ON phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_phone_numbers_updated_at();

-- ── 4) Seed : catalogue minimal Canada/US ────────────────────
-- Prix en cents CAD, valeurs indicatives (a ajuster selon le markup
-- VNK). Ces seeds sont la juste pour que le wizard ait des options
-- par defaut au 1er demarrage ; VNK customise via /owner/products.
INSERT INTO products (sku, category, name, country, region, number_type, capabilities, price_monthly, setup_fee, is_active, sort_order)
VALUES
  -- Canada
  ('CA-LOCAL-QC',   'PHONE_NUMBER', 'Numero local Quebec',      'CA', 'Quebec',   'LOCAL',    '{"voice":true,"sms":true,"mms":true}'::jsonb, 500,  0, true, 10),
  ('CA-LOCAL-ON',   'PHONE_NUMBER', 'Numero local Ontario',     'CA', 'Ontario',  'LOCAL',    '{"voice":true,"sms":true,"mms":true}'::jsonb, 500,  0, true, 11),
  ('CA-LOCAL-BC',   'PHONE_NUMBER', 'Numero local Colombie-B.', 'CA', 'BC',       'LOCAL',    '{"voice":true,"sms":true,"mms":true}'::jsonb, 500,  0, true, 12),
  ('CA-TOLLFREE',   'PHONE_NUMBER', 'Numero sans-frais Canada', 'CA', NULL,       'TOLLFREE', '{"voice":true,"sms":true}'::jsonb,            1200, 0, true, 13),
  -- USA
  ('US-LOCAL',      'PHONE_NUMBER', 'Numero local US',          'US', NULL,       'LOCAL',    '{"voice":true,"sms":true,"mms":true}'::jsonb, 500,  0, true, 20),
  ('US-TOLLFREE',   'PHONE_NUMBER', 'Numero sans-frais US',     'US', NULL,       'TOLLFREE', '{"voice":true,"sms":true}'::jsonb,            1200, 0, true, 21),
  -- Services
  ('AI-TRANSCRIBE', 'AI_CREDIT',    'Credit transcription IA',   NULL, NULL,      NULL,       '{}'::jsonb,                                   2500, 0, true, 50),
  ('AI-SENTIMENT',  'AI_CREDIT',    'Credit analyse sentiment',  NULL, NULL,      NULL,       '{}'::jsonb,                                   1500, 0, true, 51)
ON CONFLICT (sku) DO NOTHING;

-- ── 5) Backfill phone_numbers existants ──────────────────────
-- Les numeros deja provisionnes ont status ACTIVE et price 0 par
-- defaut (grandfathered) ; VNK peut ajuster a la main via /owner/numbers.
UPDATE phone_numbers
SET status        = 'ACTIVE',
    capabilities  = '{"voice":true,"sms":true}'::jsonb
WHERE status IS NULL OR status = '';

-- ── 6) RLS : products visible par tous les connectes ─────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_products ON products;
CREATE POLICY read_products ON products
  FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::text
      AND role IN ('OWNER', 'OWNER_STAFF')
  ));

DROP POLICY IF EXISTS write_products ON products;
CREATE POLICY write_products ON products
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::text
      AND role IN ('OWNER', 'OWNER_STAFF')
  ));
