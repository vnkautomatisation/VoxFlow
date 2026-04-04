-- ============================================================
--  VoxFlow — Migration 001 — Table users
--  À exécuter dans Supabase SQL Editor
--  supabase.com → ton projet → SQL Editor → New query
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table organizations (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'STARTER' CHECK (plan IN ('STARTER', 'PRO', 'ENTERPRISE')),
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Table users
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'AGENT' CHECK (role IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT')),
  password_hash   TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role);

-- Table phone_numbers
CREATE TABLE IF NOT EXISTS phone_numbers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number          TEXT UNIQUE NOT NULL,
  twilio_sid      TEXT UNIQUE NOT NULL,
  country         TEXT DEFAULT 'CA',
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Table queues (files d'attente)
CREATE TABLE IF NOT EXISTS queues (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  description     TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Table calls (historique des appels)
CREATE TABLE IF NOT EXISTS calls (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  twilio_sid      TEXT UNIQUE NOT NULL,
  from_number     TEXT NOT NULL,
  to_number       TEXT NOT NULL,
  duration        INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'RINGING',
  direction       TEXT NOT NULL DEFAULT 'INBOUND',
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  queue_id        TEXT REFERENCES queues(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  recording_url   TEXT,
  transcription   TEXT,
  ai_summary      TEXT,
  notes           TEXT
);

-- Table subscriptions (Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  stripe_id           TEXT UNIQUE NOT NULL,
  status              TEXT NOT NULL,
  plan                TEXT NOT NULL,
  organization_id     TEXT UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_period_end  TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) — isolation multi-tenant
ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;

-- Policies RLS — le service role bypass tout (notre backend)
-- Les utilisateurs ne voient que leurs données

SELECT 'Migration 001 executee avec succes !' AS message;
