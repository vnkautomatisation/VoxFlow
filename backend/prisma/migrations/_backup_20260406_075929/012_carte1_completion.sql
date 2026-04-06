-- Migration 012 - Carte 1 completion
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url  TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_sid  TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription  TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS duration       INTEGER DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ended_at       TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS quality_score  INTEGER;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS twilio_sid     TEXT;

CREATE INDEX IF NOT EXISTS idx_calls_twilio ON calls(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_calls_org    ON calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent  ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_date   ON calls(started_at);

CREATE TABLE IF NOT EXISTS voicemails (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  twilio_sid      TEXT,
  from_number     TEXT,
  to_number       TEXT,
  recording_url   TEXT,
  transcription   TEXT,
  duration        INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'NEW',
  agent_id        TEXT,
  contact_id      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vm_org    ON voicemails(organization_id);
CREATE INDEX IF NOT EXISTS idx_vm_status ON voicemails(status);

SELECT 'Migration 012 OK' AS message;
