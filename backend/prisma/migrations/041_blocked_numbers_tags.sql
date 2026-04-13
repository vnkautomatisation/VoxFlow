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

-- ── 3. Table tags standalone (si absente) ─────────────────
-- Ne touche PAS a contact_tags existante (a des FK dependantes)
CREATE TABLE IF NOT EXISTS tags (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#7b61ff',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- ── 4. Ajouter tag_id dans contact_tags si absent ─────────
ALTER TABLE contact_tags ADD COLUMN IF NOT EXISTS tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE;
