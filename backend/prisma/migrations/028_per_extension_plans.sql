-- ============================================================
--  VoxFlow -- Migration 028 -- Per-extension plans (Phase B)
--  A executer dans Supabase SQL Editor
--
--  But : permettre l'attribution d'un plan (plan_definitions) par
--  extension SIP plutot que par organisation. Chaque extension peut
--  avoir son propre forfait, status et capabilities, avec un cout
--  additionnel par mois.
--
--  Cas d'usage :
--   - Un client veut 10 extensions STARTER + 2 extensions PRO pour
--     ses superviseurs sans payer PRO pour tout le monde.
--   - Feature gating au niveau extension (useFeatures hook lit ext.plan)
--   - Billing prorate par extension (migration billing Phase B later)
--
--  Fallback : si extensions.plan_id IS NULL, on herite du plan de
--  l'organisation (organizations.plan).
-- ============================================================

-- ── 1) Ajouter plan_id / status / capabilities / cost_per_month ──
ALTER TABLE extensions
  ADD COLUMN IF NOT EXISTS plan_id         TEXT REFERENCES plan_definitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING')),
  ADD COLUMN IF NOT EXISTS capabilities    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_per_month  INTEGER NOT NULL DEFAULT 0;
  -- cost_per_month en CENTS CAD (meme unite que plan_definitions.price_monthly)

-- Index pour les requetes de billing / feature gating
CREATE INDEX IF NOT EXISTS idx_extensions_plan_id ON extensions(plan_id);
CREATE INDEX IF NOT EXISTS idx_extensions_status  ON extensions(status);

-- ── 2) Backfill : extensions existantes heritent du plan de l'org ──
-- organizations.plan est un TEXT qui reference plan_definitions.id
-- (via migration 027). On copie cette valeur dans extensions.plan_id
-- pour les extensions qui n'ont pas encore de plan explicite.
UPDATE extensions ext
SET plan_id = org.plan
FROM organizations org
WHERE ext.organization_id = org.id
  AND ext.plan_id IS NULL
  AND org.plan IS NOT NULL;

-- ── 3) Trigger updated_at (reutilise le pattern de migration 027) ──
CREATE OR REPLACE FUNCTION trigger_extensions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS extensions_updated_at_trigger ON extensions;
CREATE TRIGGER extensions_updated_at_trigger
  BEFORE UPDATE ON extensions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_extensions_updated_at();

-- ── 4) RLS : une extension est visible par son org ────────────
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_extensions ON extensions;
CREATE POLICY org_extensions ON extensions
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()::text
  ));

-- ── 5) View helper : features effectives par extension ────────
-- Retourne le plan effectif d'une extension (son plan propre si defini,
-- sinon le plan de l'organisation). Utile pour le feature gating.
CREATE OR REPLACE VIEW v_extension_plans AS
SELECT
  e.id                     AS extension_id,
  e.organization_id,
  e.extension_number,
  e.user_id,
  COALESCE(e.plan_id, o.plan) AS effective_plan_id,
  p.features               AS features,
  p.max_calls_month        AS max_calls_month,
  e.status                 AS status,
  e.cost_per_month         AS cost_per_month
FROM extensions e
JOIN organizations o ON o.id = e.organization_id
LEFT JOIN plan_definitions p ON p.id = COALESCE(e.plan_id, o.plan);
