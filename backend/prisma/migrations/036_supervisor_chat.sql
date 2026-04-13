-- ============================================================
--  VoxFlow -- Migration 036 -- Chat superviseur-agent (Phase B)
--  A executer dans Supabase SQL Editor
--
--  But : permettre au superviseur d'envoyer des messages texte
--  a un agent pendant un appel en cours. Messages visibles dans
--  un mini-chat overlay du dialer et dans le wallboard supervision.
--
--  Philosophie : simple polling (pas de WebSocket pour l'instant).
--  Le dialer poll GET /supervision/chat/:agentId toutes les 3s.
-- ============================================================

CREATE TABLE IF NOT EXISTS supervisor_messages (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id          TEXT REFERENCES calls(id) ON DELETE SET NULL,
  content          TEXT NOT NULL,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sup_msg_org    ON supervisor_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sup_msg_to     ON supervisor_messages(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sup_msg_call   ON supervisor_messages(call_id);

ALTER TABLE supervisor_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_supervisor_messages ON supervisor_messages;
CREATE POLICY org_supervisor_messages ON supervisor_messages
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()::text
  ));
