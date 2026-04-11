-- ============================================================
--  VoxFlow -- Migration 033 -- Expand plan features (18 -> 71 keys)
--  A executer dans Supabase SQL Editor
--
--  But : la migration 027 seed 6 plans avec 18 features. Phase B
--  demande un gating beaucoup plus fin — on etend le JSONB a 71 clefs
--  groupees par domaine :
--
--    Telephony (18) : inbound, outbound, recording, transfer, hold,
--      park, dtmf, hd_voice, custom_ivr, conference, whisper, barge,
--      listen, click_to_call, caller_id_custom, voicemail,
--      voicemail_transcription, voicemail_to_email
--
--    Agents (9) : unlimited_agents, agent_groups, agent_skills,
--      agent_scripts, agent_goals_kpi, agent_scheduling,
--      agent_coaching_ai, agent_performance, agent_sessions
--
--    Queues (7) : unlimited_queues, queue_overflow, queue_callback,
--      queue_priority, queue_skill_routing, queue_sla, queue_cdr
--
--    CRM (10) : contacts_search, contacts_import, contacts_export,
--      custom_fields, contact_activities, contact_tags,
--      pipeline_stages, deal_tracking, crm_basic, crm_advanced
--
--    Messaging (8) : sms, whatsapp, chat_widget, email_inbound,
--      email_outbound, social_media, messaging_templates, messaging_webhooks
--
--    Reports (7) : reports_basic, reports_advanced, real_time_dashboard,
--      custom_reports, scheduled_reports, data_export, cdr_export
--
--    Advanced (12) : api_access, webhooks, integrations, white_label,
--      sso_oauth, two_factor_auth, ip_whitelist, predictive_dialer,
--      power_dialer, robot_dialer, number_pool, audit_logs_access
--
--  Total : 18 + 9 + 7 + 10 + 8 + 7 + 12 = 71 features.
--
--  Les 18 features existantes sont preservees (merge JSONB), et les
--  nouvelles clefs sont seedees a false par defaut puis actives par
--  plan dans les UPDATE ci-dessous.
-- ============================================================

-- ── 1) Fonction helper : merge d'un template de features ────
-- Definit un "default feature map" a 71 clefs toutes a false, et on
-- jsonb_concat le map existant par dessus (migration 027 gagne si
-- conflit), ce qui preserve le seed actuel. Ensuite on UPDATE par
-- plan pour activer les nouvelles clefs selon le tier.

CREATE OR REPLACE FUNCTION default_feature_map()
RETURNS JSONB AS $$
BEGIN
  RETURN '{
    "inbound_calls": false,
    "outbound_calls": false,
    "call_recording": false,
    "call_transfer": false,
    "call_hold": false,
    "call_park": false,
    "dtmf": false,
    "hd_voice": false,
    "custom_ivr": false,
    "conference": false,
    "supervision_whisper": false,
    "supervision_barge": false,
    "supervision_listen": false,
    "click_to_call": false,
    "caller_id_custom": false,
    "voicemail": false,
    "voicemail_transcription": false,
    "voicemail_to_email": false,

    "unlimited_agents": false,
    "agent_groups": false,
    "agent_skills": false,
    "agent_scripts": false,
    "agent_goals_kpi": false,
    "agent_scheduling": false,
    "agent_coaching_ai": false,
    "agent_performance": false,
    "agent_sessions": false,

    "unlimited_queues": false,
    "queue_overflow": false,
    "queue_callback": false,
    "queue_priority": false,
    "queue_skill_routing": false,
    "queue_sla": false,
    "queue_cdr": false,

    "contacts_search": false,
    "contacts_import": false,
    "contacts_export": false,
    "custom_fields": false,
    "contact_activities": false,
    "contact_tags": false,
    "pipeline_stages": false,
    "deal_tracking": false,
    "crm_basic": false,
    "crm_advanced": false,

    "sms": false,
    "whatsapp": false,
    "chat_widget": false,
    "email_inbound": false,
    "email_outbound": false,
    "social_media": false,
    "messaging_templates": false,
    "messaging_webhooks": false,

    "reports_basic": false,
    "reports_advanced": false,
    "real_time_dashboard": false,
    "custom_reports": false,
    "scheduled_reports": false,
    "data_export": false,
    "cdr_export": false,

    "api_access": false,
    "webhooks": false,
    "integrations": false,
    "white_label": false,
    "sso_oauth": false,
    "two_factor_auth": false,
    "ip_whitelist": false,
    "predictive_dialer": false,
    "power_dialer": false,
    "robot_dialer": false,
    "number_pool": false,
    "audit_logs_access": false
  }'::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 2) Merge du template dans tous les plans existants ───────
-- jsonb_concat (||) : la valeur de gauche (existante) gagne sur la
-- clef si conflit, donc on met le template en PREMIER argument pour
-- que les anciennes clefs ecrasent les valeurs par defaut. Les
-- nouvelles clefs sont ajoutees avec false.
UPDATE plan_definitions
SET features = default_feature_map() || features,
    updated_at = NOW();

-- ── 3) Activer les features par plan ────────────────────────
-- STARTER : inbound + agents de base + crm basic
UPDATE plan_definitions SET features = features || '{
  "call_hold": true,
  "call_transfer": true,
  "dtmf": true,
  "hd_voice": true,
  "voicemail": true,
  "agent_sessions": true,
  "agent_scripts": true,
  "contact_tags": true,
  "contact_activities": true,
  "reports_basic": true,
  "real_time_dashboard": true,
  "two_factor_auth": true
}'::jsonb
WHERE id IN ('STARTER', 'TRIAL');

-- BASIC : STARTER + multicanal
UPDATE plan_definitions SET features = features || '{
  "call_hold": true,
  "call_transfer": true,
  "call_park": true,
  "dtmf": true,
  "hd_voice": true,
  "voicemail": true,
  "voicemail_to_email": true,
  "agent_sessions": true,
  "agent_scripts": true,
  "agent_groups": true,
  "agent_skills": true,
  "queue_overflow": true,
  "contacts_import": true,
  "contact_tags": true,
  "contact_activities": true,
  "custom_fields": true,
  "sms": true,
  "chat_widget": true,
  "email_inbound": true,
  "messaging_templates": true,
  "reports_basic": true,
  "real_time_dashboard": true,
  "data_export": true,
  "two_factor_auth": true
}'::jsonb
WHERE id = 'BASIC';

-- CONFORT : BASIC + sortants + recording + transcription
UPDATE plan_definitions SET features = features || '{
  "call_hold": true,
  "call_transfer": true,
  "call_park": true,
  "dtmf": true,
  "hd_voice": true,
  "conference": true,
  "click_to_call": true,
  "caller_id_custom": true,
  "voicemail": true,
  "voicemail_transcription": true,
  "voicemail_to_email": true,
  "supervision_listen": true,
  "agent_sessions": true,
  "agent_scripts": true,
  "agent_groups": true,
  "agent_skills": true,
  "agent_goals_kpi": true,
  "agent_performance": true,
  "queue_overflow": true,
  "queue_callback": true,
  "queue_priority": true,
  "contacts_import": true,
  "contacts_export": true,
  "contact_tags": true,
  "contact_activities": true,
  "custom_fields": true,
  "pipeline_stages": true,
  "sms": true,
  "whatsapp": true,
  "chat_widget": true,
  "email_inbound": true,
  "email_outbound": true,
  "messaging_templates": true,
  "reports_basic": true,
  "real_time_dashboard": true,
  "custom_reports": true,
  "data_export": true,
  "cdr_export": true,
  "two_factor_auth": true
}'::jsonb
WHERE id = 'CONFORT';

-- PRO : CONFORT + agents illimites + supervision + sentiment + CRM avance
UPDATE plan_definitions SET features = features || '{
  "call_hold": true,
  "call_transfer": true,
  "call_park": true,
  "dtmf": true,
  "hd_voice": true,
  "conference": true,
  "custom_ivr": true,
  "click_to_call": true,
  "caller_id_custom": true,
  "voicemail": true,
  "voicemail_transcription": true,
  "voicemail_to_email": true,
  "supervision_listen": true,
  "supervision_whisper": true,
  "supervision_barge": true,
  "unlimited_agents": true,
  "agent_sessions": true,
  "agent_scripts": true,
  "agent_groups": true,
  "agent_skills": true,
  "agent_goals_kpi": true,
  "agent_scheduling": true,
  "agent_performance": true,
  "unlimited_queues": true,
  "queue_overflow": true,
  "queue_callback": true,
  "queue_priority": true,
  "queue_skill_routing": true,
  "queue_sla": true,
  "queue_cdr": true,
  "contacts_import": true,
  "contacts_export": true,
  "contact_tags": true,
  "contact_activities": true,
  "custom_fields": true,
  "pipeline_stages": true,
  "deal_tracking": true,
  "sms": true,
  "whatsapp": true,
  "chat_widget": true,
  "email_inbound": true,
  "email_outbound": true,
  "social_media": true,
  "messaging_templates": true,
  "messaging_webhooks": true,
  "reports_basic": true,
  "reports_advanced": true,
  "real_time_dashboard": true,
  "custom_reports": true,
  "scheduled_reports": true,
  "data_export": true,
  "cdr_export": true,
  "api_access": true,
  "webhooks": true,
  "integrations": true,
  "two_factor_auth": true,
  "audit_logs_access": true
}'::jsonb
WHERE id = 'PRO';

-- ENTERPRISE : tout active
UPDATE plan_definitions SET features = features || '{
  "inbound_calls": true,
  "outbound_calls": true,
  "call_recording": true,
  "call_transfer": true,
  "call_hold": true,
  "call_park": true,
  "dtmf": true,
  "hd_voice": true,
  "custom_ivr": true,
  "conference": true,
  "supervision_whisper": true,
  "supervision_barge": true,
  "supervision_listen": true,
  "click_to_call": true,
  "caller_id_custom": true,
  "voicemail": true,
  "voicemail_transcription": true,
  "voicemail_to_email": true,
  "unlimited_agents": true,
  "agent_groups": true,
  "agent_skills": true,
  "agent_scripts": true,
  "agent_goals_kpi": true,
  "agent_scheduling": true,
  "agent_coaching_ai": true,
  "agent_performance": true,
  "agent_sessions": true,
  "unlimited_queues": true,
  "queue_overflow": true,
  "queue_callback": true,
  "queue_priority": true,
  "queue_skill_routing": true,
  "queue_sla": true,
  "queue_cdr": true,
  "contacts_search": true,
  "contacts_import": true,
  "contacts_export": true,
  "custom_fields": true,
  "contact_activities": true,
  "contact_tags": true,
  "pipeline_stages": true,
  "deal_tracking": true,
  "crm_basic": true,
  "crm_advanced": true,
  "sms": true,
  "whatsapp": true,
  "chat_widget": true,
  "email_inbound": true,
  "email_outbound": true,
  "social_media": true,
  "messaging_templates": true,
  "messaging_webhooks": true,
  "reports_basic": true,
  "reports_advanced": true,
  "real_time_dashboard": true,
  "custom_reports": true,
  "scheduled_reports": true,
  "data_export": true,
  "cdr_export": true,
  "api_access": true,
  "webhooks": true,
  "integrations": true,
  "white_label": true,
  "sso_oauth": true,
  "two_factor_auth": true,
  "ip_whitelist": true,
  "predictive_dialer": true,
  "power_dialer": true,
  "robot_dialer": true,
  "number_pool": true,
  "audit_logs_access": true
}'::jsonb
WHERE id = 'ENTERPRISE';
