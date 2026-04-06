-- ============================================================
-- Migration 016 — Fix agents + extensions test
-- Crée les entrées agents si absentes + assigne extensions
-- ============================================================

-- 1. Créer entrée agent pour agent@test.com si absente
INSERT INTO agents (
  user_id,
  organization_id,
  extension,
  status,
  created_at
)
SELECT 
  u.id,
  u.organization_id,
  '201',
  'OFFLINE',
  NOW()
FROM users u
WHERE u.email = 'agent@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM agents a WHERE a.user_id = u.id
  );

-- 2. Créer entrée agent pour admin@test.com si absente
INSERT INTO agents (
  user_id,
  organization_id,
  extension,
  status,
  created_at
)
SELECT 
  u.id,
  u.organization_id,
  '202',
  'OFFLINE',
  NOW()
FROM users u
WHERE u.email = 'admin@test.com'
  AND NOT EXISTS (
    SELECT 1 FROM agents a WHERE a.user_id = u.id
  );

-- 3. Update si entrées existent mais extension null
UPDATE agents
SET extension = '201'
WHERE user_id = (SELECT id FROM users WHERE email = 'agent@test.com')
  AND (extension IS NULL OR extension = '');

UPDATE agents
SET extension = '202'  
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@test.com')
  AND (extension IS NULL OR extension = '');

-- 4. Vérification
SELECT 
  u.email, 
  u.role,
  a.extension,
  a.status
FROM users u
LEFT JOIN agents a ON a.user_id = u.id
WHERE u.email IN ('agent@test.com', 'admin@test.com', 'owner@voxflow.io');

