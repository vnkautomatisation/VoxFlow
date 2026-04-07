-- ════════════════════════════════════════════════════════════
-- Migration: allowed_regions pour les forfaits téléphonie
-- À exécuter dans Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. Ajouter allowed_regions aux organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS allowed_regions TEXT[] DEFAULT ARRAY['CA','US'];

-- 2. Ajouter allowed_regions aux subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS allowed_regions TEXT[] DEFAULT ARRAY['CA','US'];

-- 3. Mettre à jour les forfaits existants avec les régions par défaut
-- Basic = Canada + USA uniquement
-- Confort = Canada + USA + Mexique
-- Premium = Canada + USA + Mexique + Europe complète
UPDATE subscriptions SET allowed_regions = ARRAY['CA','US']
  WHERE plan = 'basic' AND allowed_regions IS NULL;

UPDATE subscriptions SET allowed_regions = ARRAY['CA','US','MX']
  WHERE plan = 'confort' AND allowed_regions IS NULL;

UPDATE subscriptions SET allowed_regions = ARRAY['CA','US','MX','FR','BE','CH','LU','DE','GB','ES','IT','PT','NL','AT','IE']
  WHERE plan = 'premium' AND allowed_regions IS NULL;

-- 4. Table des tarifs par région (pour affichage et facturation future)
CREATE TABLE IF NOT EXISTS telephony_regions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  country_codes TEXT[] NOT NULL,  -- codes ISO pays couverts
  prefix_codes  TEXT[] NOT NULL,  -- indicatifs téléphoniques (+1, +33, etc.)
  rate_per_min  DECIMAL(10,4) DEFAULT 0.01,
  included_in   TEXT[] DEFAULT ARRAY['basic','confort','premium'],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO telephony_regions (id, name, country_codes, prefix_codes, rate_per_min, included_in) VALUES
  ('north_america', 'Amérique du Nord',     ARRAY['CA','US'],              ARRAY['1'],           0.01,  ARRAY['basic','confort','premium']),
  ('mexico',        'Mexique',              ARRAY['MX'],                   ARRAY['52'],          0.025, ARRAY['confort','premium']),
  ('europe_west',   'Europe de l''Ouest',   ARRAY['FR','BE','CH','LU'],    ARRAY['33','32','41','352'], 0.04, ARRAY['premium']),
  ('europe_uk',     'Royaume-Uni',          ARRAY['GB'],                   ARRAY['44'],          0.04,  ARRAY['premium']),
  ('europe_de',     'Allemagne',            ARRAY['DE'],                   ARRAY['49'],          0.04,  ARRAY['premium']),
  ('europe_es_it',  'Espagne / Italie',     ARRAY['ES','IT'],              ARRAY['34','39'],     0.05,  ARRAY['premium']),
  ('europe_other',  'Reste Europe',         ARRAY['PT','NL','AT','IE','PL','SE','NO','DK','FI'], ARRAY['351','31','43','353','48','46','47','45','358'], 0.05, ARRAY['premium']),
  ('africa_north',  'Afrique du Nord',      ARRAY['MA','DZ','TN'],         ARRAY['212','213','216'], 0.08, ARRAY['premium']),
  ('africa_sub',    'Afrique subsaharienne',ARRAY['SN','CI','CM','NG','KE'],ARRAY['221','225','237','234','254'], 0.12, ARRAY['premium']),
  ('latam',         'Amérique Latine',      ARRAY['BR','AR','CL','CO','PE'],ARRAY['55','54','56','57','51'], 0.06, ARRAY['premium']),
  ('asia',          'Asie',                 ARRAY['JP','KR','CN','IN'],    ARRAY['81','82','86','91'], 0.06, ARRAY['premium']),
  ('oceania',       'Océanie',              ARRAY['AU','NZ'],              ARRAY['61','64'],     0.06,  ARRAY['premium'])
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  country_codes = EXCLUDED.country_codes,
  prefix_codes  = EXCLUDED.prefix_codes,
  rate_per_min  = EXCLUDED.rate_per_min,
  included_in   = EXCLUDED.included_in;