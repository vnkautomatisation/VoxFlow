-- Migration 040 — Colonnes supplementaires RDV + devis
-- Ajout type et notes aux appointments (utilises par le modal enrichi)

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'CALL' CHECK (type IN ('CALL','VIDEO','MEETING','VISIT'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ajout delete sur quotes (pour supprimer un devis)
-- (la table existe deja via migration 038)

-- Index pour recherche par type
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(type);
