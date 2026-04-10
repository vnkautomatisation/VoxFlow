-- ============================================================
--  VoxFlow -- Migration 023 -- Email inbound + IVR indexes
--  Ajoute le support du webhook email entrant et des lookups
--  IVR/Queue pour les handlers TwiML.
--  A executer dans Supabase SQL Editor.
-- ============================================================

-- ── organizations.inbound_email ─────────────────────────────────
-- Adresse email de reception pour le webhook /omni/webhook/email
-- Permet d'identifier automatiquement l'org depuis le champ "to"
-- de l'email entrant (fallback si ?orgId=... n'est pas fourni).
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS inbound_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_inbound_email
  ON organizations(inbound_email)
  WHERE inbound_email IS NOT NULL;

-- ── ivr_configs: index pour lookup webhook TwiML ─────────────
-- Le handler GET /telephony/twiml/ivr/:id fait un select par id.
-- L'index sur (id) existe déjà via PRIMARY KEY mais on ajoute
-- l'index org_id pour les listes admin.
CREATE INDEX IF NOT EXISTS idx_ivr_configs_org
  ON ivr_configs(organization_id);

-- ── queues: index org pour les listes admin ─────────────────
CREATE INDEX IF NOT EXISTS idx_queues_org
  ON queues(organization_id);

-- ── email_tickets: index sur message_id pour dedupe webhook ─
-- Evite les doublons si le même email arrive deux fois du vendor
-- (retry, delay, etc.). message_id est déjà UNIQUE via la migration 007
-- mais on ajoute explicitement l'index pour le lookup rapide.
CREATE INDEX IF NOT EXISTS idx_email_tickets_message_id
  ON email_tickets(message_id)
  WHERE message_id IS NOT NULL;

SELECT 'Migration 023 Email inbound + IVR/Queue indexes executee !' AS message;
