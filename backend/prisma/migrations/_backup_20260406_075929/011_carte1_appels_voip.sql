-- ============================================================
--  VoxFlow -- Migration 011 -- Carte 1 Appels VoIP Reels
-- ============================================================

-- Colonnes manquantes sur calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS twilio_sid       TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url    TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_sid    TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription    TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS conference_name  TEXT;

-- Table voicemails
CREATE TABLE IF NOT EXISTS voicemails (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  twilio_sid      TEXT,
  from_number     TEXT NOT NULL,
  to_number       TEXT,
  recording_url   TEXT,
  transcription   TEXT,
  duration        INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'NEW', -- NEW | LISTENED | ARCHIVED
  agent_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voicemails_org    ON voicemails(organization_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_status ON voicemails(status);

-- Index sur twilio_sid pour les webhooks rapides
CREATE INDEX IF NOT EXISTS idx_calls_twilio_sid ON calls(twilio_sid);

SELECT 'Migration 011 Appels VoIP Reels executee !' AS message;
