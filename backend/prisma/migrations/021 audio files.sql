-- ================================================================
--  Migration 021 — Audio files (musique d'attente, messages IVR)
--  Permet aux clients d'uploader et gérer leurs fichiers audio :
--  musique d'attente, messages IVR, annonces, voicemails
-- ================================================================

CREATE TABLE IF NOT EXISTS audio_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,           -- URL Supabase Storage ou CDN
  type            TEXT NOT NULL DEFAULT 'hold_music'
                  CHECK (type IN ('hold_music', 'ivr_message', 'voicemail_greeting', 'announcement', 'other')),
  duration        INTEGER DEFAULT 0,       -- durée en secondes
  file_size       INTEGER DEFAULT 0,       -- taille en bytes
  mime_type       TEXT DEFAULT 'audio/mpeg',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index organisation
CREATE INDEX IF NOT EXISTS idx_audio_files_org
  ON audio_files (organization_id, type);

-- Assigner une musique d'attente à une file (optionnel)
ALTER TABLE queues ADD COLUMN IF NOT EXISTS hold_music_id UUID REFERENCES audio_files(id) ON DELETE SET NULL;

-- Assigner un message IVR audio à un nœud (stocké dans nodes JSONB)
-- Pas de migration nécessaire — géré via le JSONB nodes dans ivr_configs

-- Vérification
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'audio_files'
ORDER BY ordinal_position;