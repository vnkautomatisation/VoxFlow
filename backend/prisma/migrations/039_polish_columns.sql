-- Migration 039 — Colonnes polish (musique attente custom, sentiment, DNC auto)

-- Musique attente custom par queue
ALTER TABLE queues ADD COLUMN IF NOT EXISTS hold_music_url TEXT;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS announce_position BOOLEAN DEFAULT false;

-- Sentiment sur les calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive','neutral','negative'));
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(3,2);

-- DNC auto-check flag sur les campagnes
ALTER TABLE robot_campaigns ADD COLUMN IF NOT EXISTS auto_dnc_check BOOLEAN DEFAULT true;

-- Overflow inter-org
ALTER TABLE queues ADD COLUMN IF NOT EXISTS overflow_org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS overflow_after_seconds INTEGER DEFAULT 300;
