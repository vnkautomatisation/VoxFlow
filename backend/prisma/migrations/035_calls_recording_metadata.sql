-- ============================================================
--  VoxFlow -- Migration 035 -- Colonnes metadata recording calls
--  A executer dans Supabase SQL Editor
--
--  But : completer la table calls pour accepter les metadata
--  d'enregistrement Twilio (duration, status) et l'extension
--  de l'agent qui a pris l'appel.
--
--  Necessaire pour que le callback Twilio /voice/recording et
--  /voice/status puissent persister les donnees reelles.
-- ============================================================

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS recording_duration INTEGER,
  ADD COLUMN IF NOT EXISTS recording_status   TEXT,
  ADD COLUMN IF NOT EXISTS agent_extension    TEXT;

-- Index pour retrouver rapidement un call par CallSid Twilio
-- (deja UNIQUE sur twilio_sid via 001, on ajoute un index partiel
-- qui exclue les rows sans SID pour accelerer le /voice/status lookup)
CREATE INDEX IF NOT EXISTS idx_calls_twilio_sid_active
  ON calls(twilio_sid) WHERE twilio_sid IS NOT NULL;
