-- ============================================================
--  VoxFlow -- Migration 019 -- Dashboard Sync Events
--  Table pour synchroniser le dialer flottant avec le dashboard
--  Remplacé à terme par WebSocket Twilio réel
-- ============================================================

-- Table des événements temps réel (remplace BroadcastChannel cross-origin)
CREATE TABLE IF NOT EXISTS call_events (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_id         TEXT REFERENCES calls(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL, -- CALL_STARTED | CALL_ENDED | CALL_MISSED | STATUS_CHANGED
  payload         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_events_org   ON call_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_events_agent ON call_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_events_date  ON call_events(created_at);

-- RLS
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_call_events" ON call_events;
CREATE POLICY "org_call_events" ON call_events
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()::text
  ));

-- Purge automatique des événements > 24h (optionnel, à activer via pg_cron)
-- SELECT cron.schedule('purge-call-events', '0 * * * *',
--   \$\$ DELETE FROM call_events WHERE created_at < NOW() - INTERVAL '24 hours' \$\$
-- );

SELECT 'Migration 019 OK — Dashboard Sync Events' AS message;
