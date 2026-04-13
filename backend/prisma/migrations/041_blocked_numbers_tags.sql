-- 041 : Blocked numbers + call tags
-- ════════════════════════════════════════════════════════════

-- ── 1. Table blocked_numbers ──────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_numbers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone           TEXT NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(organization_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_blocked_numbers_org ON blocked_numbers(organization_id);
CREATE INDEX IF NOT EXISTS idx_blocked_numbers_phone ON blocked_numbers(phone);

-- ── 2. Tags sur les appels (JSONB) ────────────────────────
ALTER TABLE calls ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
