-- ============================================================
--  VoxFlow -- Migration 025 -- Trial 14 jours
--  Tout nouveau client qui s'inscrit via /register obtient
--  automatiquement un essai gratuit de 14 jours.
--  A executer dans Supabase SQL Editor.
-- ============================================================

-- ── organizations.trial_ends_at ─────────────────────────────
-- Date/heure de fin de l'essai. NULL = pas d'essai actif (compte payant
-- ou premium). Quand trial_ends_at < NOW() et status='TRIAL', le compte
-- est soft-suspended (blocage upgrade wall côté frontend).
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ── organizations.trial_started_at ──────────────────────────
-- Timestamp de début d'essai pour afficher "Essai commencé le X".
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- ── Index pour les checks d'expiration (batch jobs) ─────────
-- Permet de trouver rapidement les orgs en essai dont le trial se termine
-- bientôt (pour envoyer des emails de rappel J-3, J-1).
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends
  ON organizations(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL AND status = 'TRIAL';

-- ── Update status enum check: ajouter 'TRIAL' si manquant ──
-- (L'enum type est déjà TRIAL dans les types TS, mais le CHECK DB
-- pourrait ne pas l'avoir. On s'assure qu'il est inclus.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'organizations_status_check'
  ) THEN
    ALTER TABLE organizations DROP CONSTRAINT organizations_status_check;
  END IF;

  ALTER TABLE organizations
    ADD CONSTRAINT organizations_status_check
    CHECK (status IN ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'));
END $$;

-- ── Backfill: les orgs existantes sans status TRIAL restent ACTIVE ─
-- (Ne pas toucher les orgs déjà payantes)

SELECT 'Migration 025 Trial 14 jours executee !' AS message;
