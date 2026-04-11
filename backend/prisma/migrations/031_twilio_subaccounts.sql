-- ============================================================
--  VoxFlow -- Migration 031 -- Twilio subaccount par org (Phase B)
--  A executer dans Supabase SQL Editor
--
--  But : decoupler le compte Twilio VNK (master) des comptes Twilio
--  de chaque organisation cliente. Chaque org possede son propre
--  SUBACCOUNT Twilio avec Account SID / Auth Token / TwiML App SID /
--  API Key propres.
--
--  Avantages :
--   - Isolation : chaque org paie sa conso directement a Twilio via
--     le subaccount (ou VNK facture avec markup si billing central)
--   - Securite : compromission d'une org ne donne pas acces aux
--     autres
--   - Conformite : chaque subaccount a ses propres callers verifies,
--     ses propres SIDs, ses propres recordings (RLS Twilio native)
--   - Webhooks par org : voice_url / status_callback propres a l'org
--
--  Securite credentials : pgcrypto chiffre les secrets (auth_token,
--  api_secret). La clef de chiffrement est dans une variable d'env
--  Supabase (app.settings.twilio_enc_key). Les devs n'ont jamais
--  acces aux secrets clairs.
-- ============================================================

-- Activer pgcrypto si pas deja fait
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1) Table org_twilio_config ───────────────────────────────
-- Une row par organisation. UNIQUE sur organization_id pour
-- garantir 1-to-1. Les credentials sont stockes en BYTEA chiffre.
CREATE TABLE IF NOT EXISTS org_twilio_config (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identifiants publics (pas chiffres)
  account_sid           TEXT NOT NULL,             -- AC..... (Subaccount SID)
  parent_account_sid    TEXT,                      -- AC..... (VNK master)
  twiml_app_sid         TEXT,                      -- AP.....
  api_key_sid           TEXT,                      -- SK.....
  friendly_name         TEXT,

  -- Secrets chiffres (jamais retournes par l'API)
  auth_token_enc        BYTEA,                     -- chiffre avec pgp_sym_encrypt
  api_secret_enc        BYTEA,                     -- chiffre avec pgp_sym_encrypt

  -- Webhooks configurables par org
  voice_webhook_url     TEXT,
  sms_webhook_url       TEXT,
  status_callback_url   TEXT,

  -- Config globale
  default_caller_id     TEXT,                      -- numero affiche par defaut
  recording_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  recording_consent     BOOLEAN NOT NULL DEFAULT FALSE,  -- prompt de consentement actif
  max_concurrent_calls  INTEGER NOT NULL DEFAULT 10,

  -- Statut du subaccount
  status                TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED', 'PROVISIONING')),
  provisioned_at        TIMESTAMPTZ,
  last_sync_at          TIMESTAMPTZ,                -- derniere sync status/billing

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_twilio_status      ON org_twilio_config(status);
CREATE INDEX IF NOT EXISTS idx_org_twilio_account_sid ON org_twilio_config(account_sid);

-- ── 2) Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_org_twilio_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS org_twilio_config_updated_at_trigger ON org_twilio_config;
CREATE TRIGGER org_twilio_config_updated_at_trigger
  BEFORE UPDATE ON org_twilio_config
  FOR EACH ROW
  EXECUTE FUNCTION trigger_org_twilio_config_updated_at();

-- ── 3) Helpers de chiffrement ────────────────────────────────
-- Les fonctions encrypt_twilio_secret() et decrypt_twilio_secret()
-- utilisent une clef symetrique stockee dans current_setting().
-- Le backend (service role) peut lire les secrets ; le renderer
-- (anon/authenticated role) ne peut pas (policy RLS).
--
-- Setup cote Supabase : dans dashboard > Database > Settings,
-- ajouter dans custom config :
--   app.settings.twilio_enc_key = '<32-byte random hex key>'

CREATE OR REPLACE FUNCTION encrypt_twilio_secret(plain TEXT)
RETURNS BYTEA AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := current_setting('app.settings.twilio_enc_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'twilio_enc_key not configured in Supabase';
  END IF;
  RETURN pgp_sym_encrypt(plain, v_key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_twilio_secret(cipher BYTEA)
RETURNS TEXT AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := current_setting('app.settings.twilio_enc_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'twilio_enc_key not configured in Supabase';
  END IF;
  RETURN pgp_sym_decrypt(cipher, v_key);
END;
$$ LANGUAGE plpgsql;

-- ── 4) RLS : une org voit uniquement sa row ──────────────────
-- OWNER/OWNER_STAFF voient tout (support, monitoring).
-- L'ADMIN d'une org voit la row (sans les secrets decryptes — le
-- backend filtre).
ALTER TABLE org_twilio_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_twilio_select ON org_twilio_config;
CREATE POLICY org_twilio_select ON org_twilio_config
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND role IN ('OWNER', 'OWNER_STAFF')
    )
  );

-- Seul le service_role backend peut ecrire (pas d'UPDATE direct
-- depuis le frontend — toujours via un endpoint POST /owner/twilio).
DROP POLICY IF EXISTS org_twilio_write ON org_twilio_config;
CREATE POLICY org_twilio_write ON org_twilio_config
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()::text
      AND role IN ('OWNER', 'OWNER_STAFF')
  ));

-- ── 5) View safe (sans les secrets) ──────────────────────────
-- Vue utilisee par le frontend /admin/numbers pour afficher les
-- infos non sensibles du subaccount sans exposer auth_token.
CREATE OR REPLACE VIEW v_org_twilio_safe AS
SELECT
  id,
  organization_id,
  account_sid,
  twiml_app_sid,
  api_key_sid,
  friendly_name,
  voice_webhook_url,
  default_caller_id,
  recording_enabled,
  recording_consent,
  max_concurrent_calls,
  status,
  provisioned_at,
  last_sync_at,
  created_at,
  updated_at
FROM org_twilio_config;
