-- ============================================================
--  VoxFlow — Migration 003 — IA + SMS
--  A executer dans Supabase SQL Editor
-- ============================================================

-- Table SMS messages
CREATE TABLE IF NOT EXISTS sms_messages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  twilio_sid      TEXT UNIQUE NOT NULL,
  from_number     TEXT NOT NULL,
  to_number       TEXT NOT NULL,
  body            TEXT NOT NULL,
  direction       TEXT NOT NULL DEFAULT "OUTBOUND",
  status          TEXT NOT NULL DEFAULT "SENT",
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_org ON sms_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_from ON sms_messages(from_number);

-- Table AI summaries (résumés post-appel)
CREATE TABLE IF NOT EXISTS ai_summaries (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  call_id        TEXT UNIQUE NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  transcription  TEXT,
  summary        TEXT NOT NULL,
  sentiment      TEXT DEFAULT "NEUTRE",
  topics         JSONB DEFAULT "[]",
  resolved       BOOLEAN DEFAULT false,
  follow_up      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter colonnes AI aux appels
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_sid TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT false;

SELECT "Migration 003 executee avec succes !" AS message;
