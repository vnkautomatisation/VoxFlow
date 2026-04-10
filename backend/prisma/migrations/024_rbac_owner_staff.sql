-- ============================================================
--  VoxFlow -- Migration 024 -- RBAC: OWNER_STAFF + permissions
--  A executer dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Ajout du role OWNER_STAFF ─────────────────────────────
-- OWNER_STAFF = employes de VNK Automatisation qui ont acces au portail
-- Owner mais avec certains champs cach\u00e9s (revenus d\u00e9taill\u00e9s, actions
-- destructives). Ils peuvent voir les organisations clients, g\u00e9rer les
-- tickets support, mais ne voient PAS les revenus bruts ou les
-- credentials Twilio.
--
-- On supprime l'ancienne contrainte CHECK puis on la recr\u00e9e avec le
-- nouveau role autorise. On utilise DO block pour \u00eatre idempotent.
DO $$
BEGIN
  -- Drop ancien CHECK s'il existe
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;

  -- Recreer le CHECK avec OWNER_STAFF
  ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('OWNER', 'OWNER_STAFF', 'ADMIN', 'SUPERVISOR', 'AGENT'));
END $$;

-- ── 2. Colonne permissions pour RBAC fin ─────────────────────
-- Stockage libre de permissions granulaires (ex: ["calls:read",
-- "contacts:write", "reports:export"]). Sert aux scenarios ou le role
-- seul ne suffit pas (ex: SUPERVISOR qui peut exporter les rapports
-- mais pas les autres SUPERVISOR de la meme org).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

-- Index partiel pour les lookups par permission (rare mais utile)
CREATE INDEX IF NOT EXISTS idx_users_permissions
  ON users USING GIN (permissions)
  WHERE permissions IS NOT NULL AND array_length(permissions, 1) > 0;

-- ── 3. Colonne is_owner_staff (deprecated fallback) ──────────
-- Flag bool pour les queries legacy qui cherchent "est-ce un staff owner?"
-- sans vouloir faire un enum check. Trigger pour le maintenir sync avec role.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_owner_staff BOOLEAN GENERATED ALWAYS AS (role = 'OWNER_STAFF') STORED;

-- ── 4. Index pour les lookups par role (acceleration auth checks) ─
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_org_role
  ON users(organization_id, role)
  WHERE organization_id IS NOT NULL;

-- ── 5. Audit: tracer qui a créé qui ─────────────────────────
-- Pour les checks "OWNER peut créer un ADMIN" ou "ADMIN peut créer un
-- AGENT dans sa propre org", on trace le createur. Permet plus tard
-- d'auditer les actions (qui a créé le compte X).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_created_by
  ON users(created_by)
  WHERE created_by IS NOT NULL;

SELECT 'Migration 024 RBAC OWNER_STAFF + permissions executee !' AS message;
