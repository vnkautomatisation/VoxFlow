-- 042 : Agent heartbeat pour detection presence reelle
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
