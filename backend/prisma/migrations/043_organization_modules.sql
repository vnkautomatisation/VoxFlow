-- ============================================================
--  VoxFlow -- Migration 043 -- Organization Modules + Seed modules
--  A executer dans Supabase SQL Editor
--
--  But : permettre aux organisations de souscrire a des modules
--  vendus separement (Predictive Dialer, Robot d'appel, Pack IA,
--  Numeros supplementaires). Les modules sont des produits de la
--  table products (migration 030) avec category ADDON/SERVICE.
-- ============================================================

-- ── 1) Table organization_modules ───────────────────────────
CREATE TABLE IF NOT EXISTS organization_modules (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_sku       TEXT NOT NULL REFERENCES products(sku),
  quantity          INTEGER NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED')),
  activated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at      TIMESTAMPTZ,
  stripe_subscription_item_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, product_sku)
);

CREATE INDEX IF NOT EXISTS idx_org_modules_org    ON organization_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_modules_sku    ON organization_modules(product_sku);
CREATE INDEX IF NOT EXISTS idx_org_modules_status ON organization_modules(status);

-- ── 2) Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_org_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS org_modules_updated_at_trigger ON organization_modules;
CREATE TRIGGER org_modules_updated_at_trigger
  BEFORE UPDATE ON organization_modules
  FOR EACH ROW
  EXECUTE FUNCTION trigger_org_modules_updated_at();

-- ── 3) Seed modules dans products ────────────────────────────
-- Ces produits sont achetables separement du forfait de base.
-- Prix en cents CAD. billing_unit stocke dans description pour
-- le frontend (per_user, per_number, flat).
INSERT INTO products (sku, category, name, description, price_monthly, setup_fee, is_active, sort_order)
VALUES
  ('MODULE-PREDICTIVE', 'ADDON',
   'Predictive Dialer',
   'Composition predictive automatique pour vos campagnes sortantes. Augmentez le taux de connexion et la productivite de vos agents.|per_user',
   5000, 0, true, 100),
  ('MODULE-ROBOT', 'ADDON',
   'Robot d''appel',
   'Robot dialer autonome pour diffusion de messages pre-enregistres a grande echelle (150 000 appels/heure).|per_user',
   7500, 0, true, 101),
  ('MODULE-AI-PACK', 'SERVICE',
   'Pack IA',
   'Transcription automatique, analyse de sentiment et coaching agent par intelligence artificielle.|per_user',
   1500, 0, true, 102),
  ('MODULE-EXTRA-DID', 'ADDON',
   'Numeros supplementaires',
   'Ajoutez des numeros DID additionnels (locaux ou sans-frais) a votre forfait.|per_number',
   500, 0, true, 103)
ON CONFLICT (sku) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  is_active    = EXCLUDED.is_active,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = NOW();

-- ── 4) RLS pour organization_modules ─────────────────────────
ALTER TABLE organization_modules ENABLE ROW LEVEL SECURITY;

-- Clients voient seulement les modules de leur org
DROP POLICY IF EXISTS read_org_modules ON organization_modules;
CREATE POLICY read_org_modules ON organization_modules
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role IN ('OWNER', 'OWNER_STAFF')
    )
  );

DROP POLICY IF EXISTS write_org_modules ON organization_modules;
CREATE POLICY write_org_modules ON organization_modules
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = auth.uid()::text AND role IN ('ADMIN', 'OWNER', 'OWNER_STAFF')
    )
  );

-- ── 5) Verification ──────────────────────────────────────────
SELECT
  'Migration 043 OK -- organization_modules + ' || COUNT(*) || ' modules seeds' AS message
FROM products
WHERE sku LIKE 'MODULE-%';
