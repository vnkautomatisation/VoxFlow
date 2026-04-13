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
CREATE TABLE IF NOT EXISTS tags (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#7b61ff',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- ── 4. Junction contact_tags (re-create si schema different)
-- La table contact_tags originale servait a la fois de definition
-- ET de junction. On cree la junction propre si elle manque.
DO $$
BEGIN
  -- Si contact_tags n a pas de colonne tag_id, c est l ancien schema
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_tags' AND column_name = 'tag_id'
  ) THEN
    -- Sauvegarder les données existantes dans tags
    INSERT INTO tags (organization_id, name, color)
    SELECT organization_id, name, color FROM contact_tags
    ON CONFLICT (organization_id, name) DO NOTHING;

    -- Recréer contact_tags comme junction
    DROP TABLE IF EXISTS contact_tags;
    CREATE TABLE contact_tags (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(contact_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_contact_tags_contact ON contact_tags(contact_id);
    CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);
  END IF;
END $$;
