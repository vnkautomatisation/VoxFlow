-- ============================================================
--  VoxFlow -- Migration 051 -- DID pricing fix
--  Realistic VoxFlow resale prices and Canadian regions
-- ============================================================

-- Delete old pricing to re-seed with correct values
DELETE FROM did_pricing;

-- Re-insert with realistic VoxFlow resale prices (CAD)
-- Twilio base ~1.15-4.25 USD + VoxFlow margin
INSERT INTO did_pricing (country_code, country_name, did_type, price_monthly, setup_fee, requires_address, requires_documents, provisioning_time, provisioning_description, sort_order)
VALUES
  -- Canada local
  ('CA', 'Canada',       'local',     5.99,  0, FALSE, FALSE, 'instant', NULL, 1),
  -- USA local
  ('US', 'Etats-Unis',   'local',     5.99,  0, FALSE, FALSE, 'instant', NULL, 2),
  -- France
  ('FR', 'France',       'local',     9.99,  0, TRUE,  TRUE,  '1-3 jours', 'Adresse et piece d''identite francaise requises', 3),
  -- UK
  ('GB', 'Royaume-Uni',  'local',     8.99,  0, TRUE,  FALSE, '1-2 jours', 'Adresse britannique requise', 4),
  -- Belgium
  ('BE', 'Belgique',     'local',    12.99,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse et piece d''identite belges requises', 5),
  -- Germany
  ('DE', 'Allemagne',    'local',     9.99,  0, TRUE,  TRUE,  '1-3 jours', 'Adresse et piece d''identite allemandes requises', 6),
  -- Spain
  ('ES', 'Espagne',      'local',    11.99,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse et piece d''identite espagnoles requises', 7),
  -- Italy (mobile only on Twilio, premium)
  ('IT', 'Italie',       'local',    14.99,  0, TRUE,  TRUE,  '3-5 jours', 'Numero mobile italien — documents requis', 8),
  -- Switzerland
  ('CH', 'Suisse',       'local',    12.99,  0, TRUE,  TRUE,  '1-3 jours', 'Adresse et piece d''identite suisses requises', 9),
  -- Netherlands
  ('NL', 'Pays-Bas',     'local',     9.99,  0, TRUE,  FALSE, '1-2 jours', 'Adresse neerlandaise requise', 10),
  -- Australia
  ('AU', 'Australie',    'local',    14.99,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse australienne requise', 11),
  -- Israel
  ('IL', 'Israel',       'local',    19.99,  0, TRUE,  TRUE,  '5-10 jours', 'Documents et adresse locale requis', 12),
  -- India
  ('IN', 'Inde',         'local',    24.99,  0, TRUE,  TRUE,  '5-10 jours', 'Documents entreprise et adresse locale requis', 13),
  -- Portugal
  ('PT', 'Portugal',     'local',    11.99,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse et piece d''identite portugaises requises', 14),
  -- Ireland
  ('IE', 'Irlande',      'local',     9.99,  0, TRUE,  FALSE, '1-3 jours', 'Adresse irlandaise requise', 15),
  -- Sweden
  ('SE', 'Suede',        'local',    11.99,  0, TRUE,  TRUE,  '2-5 jours', NULL, 16),
  -- Poland
  ('PL', 'Pologne',      'local',    11.99,  0, TRUE,  TRUE,  '2-5 jours', NULL, 17),
  -- Austria
  ('AT', 'Autriche',     'local',    11.99,  0, TRUE,  TRUE,  '2-5 jours', NULL, 18),
  -- Canada toll-free
  ('CA', 'Canada',       'tollfree', 12.99,  0, FALSE, FALSE, 'instant', NULL, 30),
  -- USA toll-free
  ('US', 'Etats-Unis',   'tollfree', 12.99,  0, FALSE, FALSE, 'instant', NULL, 31)
ON CONFLICT DO NOTHING;

SELECT 'Migration 051 OK -- DID pricing updated with realistic VoxFlow prices' AS message;
