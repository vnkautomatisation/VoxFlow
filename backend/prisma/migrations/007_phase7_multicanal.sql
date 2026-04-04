-- ============================================================
--  VoxFlow -- Migration 007 -- Multicanal Phase 7
--  A executer dans Supabase SQL Editor
-- ============================================================

-- Table conversations (boite unifiee omnicanal)
CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL, -- WHATSAPP | CHAT | EMAIL | SMS | CALL
  status          TEXT DEFAULT 'OPEN', -- OPEN | PENDING | RESOLVED | CLOSED
  priority        TEXT DEFAULT 'NORMAL', -- LOW | NORMAL | HIGH | URGENT
  subject         TEXT,
  assigned_to     TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_org     ON conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_conv_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conv_status  ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conv_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conv_agent   ON conversations(assigned_to);

-- Table messages (messages de toutes les conversations)
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL, -- AGENT | CONTACT | SYSTEM | BOT
  sender_id       TEXT,
  content         TEXT NOT NULL,
  content_type    TEXT DEFAULT 'TEXT', -- TEXT | IMAGE | FILE | AUDIO | VIDEO | TEMPLATE
  status          TEXT DEFAULT 'SENT', -- SENT | DELIVERED | READ | FAILED
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_org  ON messages(organization_id);

-- Table email_tickets (tickets email entrants)
CREATE TABLE IF NOT EXISTS email_tickets (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  message_id      TEXT UNIQUE, -- ID email original
  from_email      TEXT NOT NULL,
  from_name       TEXT,
  to_email        TEXT,
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  status          TEXT DEFAULT 'NEW',
  priority        TEXT DEFAULT 'NORMAL',
  assigned_to     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_org ON email_tickets(organization_id);

-- Table chat_sessions (sessions chat widget)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  visitor_id      TEXT NOT NULL,
  visitor_name    TEXT,
  visitor_email   TEXT,
  page_url        TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  status          TEXT DEFAULT 'ACTIVE',
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_org     ON chat_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_visitor ON chat_sessions(visitor_id);

-- Table canned_responses (reponses predefinies)
CREATE TABLE IF NOT EXISTS canned_responses (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  shortcut        TEXT,
  content         TEXT NOT NULL,
  channel         TEXT, -- null = tous les canaux
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'Migration 007 Multicanal executee !' AS message;
