-- ============================================================
--  VoxFlow -- Migration 051 -- DID pricing fix
--  Realistic VoxFlow resale prices and Canadian regions
-- ============================================================

-- Delete old pricing to re-seed
DELETE FROM did_pricing;

-- VoxFlow resale prices alignes sur Kavkom (~15 CAD$ base)
INSERT INTO did_pricing (country_code, country_name, did_type, price_monthly, setup_fee, requires_address, requires_documents, provisioning_time, provisioning_description, sort_order)
VALUES
  ('CA', 'Canada',       'local',    15.00,  0, FALSE, FALSE, 'instant', NULL, 1),
  ('US', 'Etats-Unis',   'local',    15.00,  0, FALSE, FALSE, 'instant', NULL, 2),
  ('FR', 'France',       'local',    18.00,  0, TRUE,  TRUE,  '1-3 jours', 'Adresse et piece d''identite francaise requises', 3),
  ('GB', 'Royaume-Uni',  'local',    18.00,  0, TRUE,  FALSE, '1-2 jours', 'Adresse britannique requise', 4),
  ('BE', 'Belgique',     'local',    20.00,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse et piece d''identite belges requises', 5),
  ('DE', 'Allemagne',    'local',    18.00,  0, TRUE,  TRUE,  '1-3 jours', 'Adresse et piece d''identite allemandes requises', 6),
  ('ES', 'Espagne',      'local',    20.00,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse et piece d''identite espagnoles requises', 7),
  ('IT', 'Italie',       'local',    25.00,  0, TRUE,  TRUE,  '3-5 jours', 'Numero mobile italien — documents requis', 8),
  ('CH', 'Suisse',       'local',    22.00,  0, TRUE,  TRUE,  '1-3 jours', 'Adresse et piece d''identite suisses requises', 9),
  ('NL', 'Pays-Bas',     'local',    18.00,  0, TRUE,  FALSE, '1-2 jours', 'Adresse neerlandaise requise', 10),
  ('AU', 'Australie',    'local',    25.00,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse australienne requise', 11),
  ('IL', 'Israel',       'local',    30.00,  0, TRUE,  TRUE,  '5-10 jours', 'Documents et adresse locale requis', 12),
  ('IN', 'Inde',         'local',    35.00,  0, TRUE,  TRUE,  '5-10 jours', 'Documents entreprise et adresse locale requis', 13),
  ('PT', 'Portugal',     'local',    20.00,  0, TRUE,  TRUE,  '2-5 jours', 'Adresse et piece d''identite portugaises requises', 14),
  ('IE', 'Irlande',      'local',    18.00,  0, TRUE,  FALSE, '1-3 jours', 'Adresse irlandaise requise', 15),
  ('SE', 'Suede',        'local',    20.00,  0, TRUE,  TRUE,  '2-5 jours', NULL, 16),
  ('PL', 'Pologne',      'local',    20.00,  0, TRUE,  TRUE,  '2-5 jours', NULL, 17),
  ('AT', 'Autriche',     'local',    20.00,  0, TRUE,  TRUE,  '2-5 jours', NULL, 18),
  ('CA', 'Canada',       'tollfree', 20.00,  0, FALSE, FALSE, 'instant', NULL, 30),
  ('US', 'Etats-Unis',   'tollfree', 20.00,  0, FALSE, FALSE, 'instant', NULL, 31)
ON CONFLICT DO NOTHING;

SELECT 'Migration 051 OK -- DID pricing updated with realistic VoxFlow prices' AS message;
