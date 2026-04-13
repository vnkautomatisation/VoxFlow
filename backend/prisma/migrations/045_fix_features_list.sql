-- ============================================================
--  VoxFlow -- Migration 045 -- Fix features_list to match spec
-- ============================================================

UPDATE plan_definitions SET
  features_list = ARRAY['1 ligne incluse','Appels entrants illimites','IVR basique','Support courriel'],
  max_dids = 1
WHERE id = 'TEL_BASIC';

UPDATE plan_definitions SET
  features_list = ARRAY['3 lignes incluses','Appels entrants/sortants','IVR avance','File d''attente','Support prioritaire'],
  max_dids = 3
WHERE id = 'TEL_CONFORT';

UPDATE plan_definitions SET
  features_list = ARRAY['5 lignes incluses','Appels illimites CA/US','IVR + ACD intelligent','Supervision temps reel','CRM integre','Support 24/7'],
  max_dids = 5
WHERE id = 'TEL_PREMIUM';

UPDATE plan_definitions SET
  features_list = ARRAY['10 lignes incluses','Appels illimites mondial','IVR + ACD + IA','Supervision avancee','CRM + API','Gestionnaire de compte dedie'],
  max_dids = 10
WHERE id = 'TEL_PRO';

UPDATE plan_definitions SET
  features_list = ARRAY['Campagnes sortantes','Import CSV','Detection repondeur','Ratio ajustable','CRM integre','Appels entrants inclus']
WHERE id = 'DIALER_CA_US';

UPDATE plan_definitions SET
  features_list = ARRAY['Tout Dialer CA/US','+ Appels France fixes & mobiles illimites','Presence locale FR','Recyclage prospects auto']
WHERE id = 'DIALER_FR_MOBILE';

UPDATE plan_definitions SET
  features_list = ARRAY['150k appels/h','TTS dynamique','Message vocal pre-enregistre','IVR post-robot (touche 1 -> agent)','RGPD liste noire','Export resultats']
WHERE id = 'ROBOT';

SELECT 'Migration 045 OK' AS message;
