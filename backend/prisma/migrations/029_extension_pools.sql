-- ============================================================
--  VoxFlow -- Migration 029 -- Extension pool (Phase B)
--  A executer dans Supabase SQL Editor
--
--  But : gerer un pool d'extensions SIP (201..999) disponibles pour
--  auto-attribution lors de l'onboarding d'une nouvelle organisation.
--
--  Fonctionnement :
--   1. Le pool global (organization_id IS NULL) contient une plage
--      d'extensions libres (ex: 201..999 = 799 slots).
--   2. Quand une org cree une extension via /client/extensions, le
--      backend allocate_next_extension() trouve le premier slot FREE
--      et le RESERVE a l'org.
--   3. Quand l'extension est detruite, le slot repasse en FREE.
--
--  Eviter les conflits : chaque slot a un status explicite, une
--  UNIQUE constraint sur (extension_number) au niveau global, et un
--  lock advisory pour serialiser les allocations concurrentes.
-- ============================================================

-- ── 1) Table extension_pools ─────────────────────────────────
CREATE TABLE IF NOT EXISTS extension_pools (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  extension_number    TEXT NOT NULL,
  organization_id     TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  -- allocated_to_ext : FK vers la row extensions reelle si allouee
  allocated_to_ext_id TEXT REFERENCES extensions(id)    ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'FREE'
    CHECK (status IN ('FREE', 'RESERVED', 'ALLOCATED', 'RETIRED')),
  reserved_at         TIMESTAMPTZ,
  reserved_until      TIMESTAMPTZ,  -- TTL des reservations (evite les fuites)
  allocated_at        TIMESTAMPTZ,
  released_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un numero d'extension est unique dans l'ensemble du pool global
  UNIQUE(extension_number)
);

CREATE INDEX IF NOT EXISTS idx_ext_pools_status  ON extension_pools(status);
CREATE INDEX IF NOT EXISTS idx_ext_pools_org     ON extension_pools(organization_id);
CREATE INDEX IF NOT EXISTS idx_ext_pools_alloc   ON extension_pools(allocated_to_ext_id);

-- ── 2) Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_extension_pools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS extension_pools_updated_at_trigger ON extension_pools;
CREATE TRIGGER extension_pools_updated_at_trigger
  BEFORE UPDATE ON extension_pools
  FOR EACH ROW
  EXECUTE FUNCTION trigger_extension_pools_updated_at();

-- ── 3) Seed : 201..999 = 799 slots libres ─────────────────────
-- (200 est reserve pour le OWNER VNK, 100-199 pour tests internes)
-- Ces slots sont crees UNIQUEMENT s'ils n'existent pas deja, pour
-- que la migration soit idempotente.
INSERT INTO extension_pools (extension_number, status)
SELECT LPAD(n::text, 3, '0'), 'FREE'
FROM generate_series(201, 999) n
ON CONFLICT (extension_number) DO NOTHING;

-- ── 4) Fonction allocate_next_extension() ─────────────────────
-- Trouve le premier slot FREE, le reserve a l'org, et retourne le
-- numero. Utilise pg_advisory_xact_lock pour serialiser les appels
-- concurrents (deux orgs qui allouent en meme temps n'obtiendront
-- jamais le meme numero).
CREATE OR REPLACE FUNCTION allocate_next_extension(p_org_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_ext_number TEXT;
BEGIN
  -- Lock exclusif sur le scope de la fonction (key arbitraire 42424242)
  PERFORM pg_advisory_xact_lock(42424242);

  SELECT extension_number INTO v_ext_number
  FROM extension_pools
  WHERE status = 'FREE'
  ORDER BY extension_number ASC
  LIMIT 1
  FOR UPDATE;

  IF v_ext_number IS NULL THEN
    RAISE EXCEPTION 'extension_pool_exhausted';
  END IF;

  UPDATE extension_pools
  SET status           = 'RESERVED',
      organization_id  = p_org_id,
      reserved_at      = NOW(),
      reserved_until   = NOW() + INTERVAL '5 minutes'
  WHERE extension_number = v_ext_number;

  RETURN v_ext_number;
END;
$$ LANGUAGE plpgsql;

-- ── 5) Fonction release_extension() ───────────────────────────
-- Remet un slot en FREE quand l'extension est supprimee.
CREATE OR REPLACE FUNCTION release_extension(p_ext_number TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE extension_pools
  SET status              = 'FREE',
      organization_id     = NULL,
      allocated_to_ext_id = NULL,
      reserved_at         = NULL,
      reserved_until      = NULL,
      allocated_at        = NULL,
      released_at         = NOW()
  WHERE extension_number = p_ext_number;
END;
$$ LANGUAGE plpgsql;

-- ── 6) RLS : OWNER/OWNER_STAFF voient tout, orgs voient leurs slots ──
ALTER TABLE extension_pools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_extension_pools ON extension_pools;
CREATE POLICY org_extension_pools ON extension_pools
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND role IN ('OWNER', 'OWNER_STAFF')
    )
  );
