-- Migration 037 — Ajouter flow_json aux ivr_configs pour le builder react-flow
ALTER TABLE ivr_configs ADD COLUMN IF NOT EXISTS flow_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ivr_configs ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
