-- ============================================================
--  VoxFlow -- Migration 022 -- Multicanal integrations
--  Ajoute le tracking provider (Twilio SIDs + delivery status)
--  et les index webhooks pour les SMS/WhatsApp entrants.
--  A executer dans Supabase SQL Editor.
-- ============================================================

-- ── messages: SID externe (Twilio, SendGrid, etc.) + horodatage statut ─
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS provider_sid        TEXT,
  ADD COLUMN IF NOT EXISTS provider_status_at  TIMESTAMPTZ;

-- Index pour retrouver un message par provider SID lors des webhooks
-- (Twilio status callback, delivery receipts, etc.)
CREATE INDEX IF NOT EXISTS idx_msg_provider_sid
  ON messages(provider_sid)
  WHERE provider_sid IS NOT NULL;

-- ── conversations: index sur metadata->>phone pour les webhooks SMS/WhatsApp ─
-- Accelere la recherche "conversation existante par numero" dans les webhooks
-- entrants. On cree un index fonctionnel sur la cle phone du JSONB.
CREATE INDEX IF NOT EXISTS idx_conv_metadata_phone
  ON conversations((metadata->>'phone'))
  WHERE metadata ? 'phone';

CREATE INDEX IF NOT EXISTS idx_conv_metadata_email
  ON conversations((metadata->>'email'))
  WHERE metadata ? 'email';

-- ── messages: index composite pour recuperer les messages recents d'une conv ─
-- Remplace l'index idx_msg_conv existant par un index qui inclut created_at
-- pour accelerer le "SELECT * FROM messages WHERE conversation_id = X ORDER BY created_at DESC".
CREATE INDEX IF NOT EXISTS idx_msg_conv_created
  ON messages(conversation_id, created_at DESC);

-- ── contacts: lookup rapide par phone/email pour auto-linkage dans webhooks ─
-- Ces index existent probablement deja via la migration 005 mais on les cree
-- avec IF NOT EXISTS pour etre idempotent.
CREATE INDEX IF NOT EXISTS idx_contacts_phone_lookup
  ON contacts(organization_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_email_lookup
  ON contacts(organization_id, email)
  WHERE email IS NOT NULL;

SELECT 'Migration 022 Multicanal integrations executee !' AS message;
