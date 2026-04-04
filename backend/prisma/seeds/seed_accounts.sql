-- ============================================================
--  VoxFlow — Seed des comptes de test
--  À exécuter dans Supabase SQL Editor
-- ============================================================

-- Organisation de test pour l'admin
INSERT INTO organizations (id, name, slug, plan, status)
VALUES (
  'org_test_001',
  'Entreprise Test SARL',
  'entreprise-test',
  'PRO',
  'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Compte OWNER (toi — VNK Automatisation)
INSERT INTO users (id, email, name, role, password_hash, organization_id, status)
VALUES (
  'user_owner_001',
  'owner@voxflow.io',
  'Owner VoxFlow',
  'OWNER',
  '$2b$12$dav70QwjbFhpeXl5qM7XL.qoWVC6aovmauKNK655frqgzPZtGaMWm',
  NULL,
  'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Compte ADMIN de test
INSERT INTO users (id, email, name, role, password_hash, organization_id, status)
VALUES (
  'user_admin_001',
  'admin@test.com',
  'Admin Test',
  'ADMIN',
  '$2b$12$dav70QwjbFhpeXl5qM7XL.qoWVC6aovmauKNK655frqgzPZtGaMWm',
  'org_test_001',
  'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Compte AGENT de test
INSERT INTO users (id, email, name, role, password_hash, organization_id, status)
VALUES (
  'user_agent_001',
  'agent@test.com',
  'Agent Test',
  'AGENT',
  '$2b$12$dav70QwjbFhpeXl5qM7XL.qoWVC6aovmauKNK655frqgzPZtGaMWm',
  'org_test_001',
  'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Vérification
SELECT id, email, name, role, status FROM users;
