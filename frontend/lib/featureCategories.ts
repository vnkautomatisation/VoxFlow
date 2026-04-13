// ── VoxFlow Feature Categories (71 features, 7 groupes) ─────────────────────
// Source de verite pour le frontend (plans client + PlanEditorModal owner).
// Les clefs doivent matcher exactement le JSONB plan_definitions.features.

export interface FeatureEntry {
  key: string
  label: string
}

export interface FeatureCategory {
  id: string
  label: string
  features: FeatureEntry[]
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'telephony',
    label: 'Telephonie',
    features: [
      { key: 'inbound_calls',          label: 'Appels entrants' },
      { key: 'outbound_calls',         label: 'Appels sortants' },
      { key: 'call_recording',         label: 'Enregistrement d\'appels' },
      { key: 'call_transfer',          label: 'Transfert d\'appels' },
      { key: 'call_hold',              label: 'Mise en attente' },
      { key: 'call_park',              label: 'Parcage d\'appels' },
      { key: 'dtmf',                   label: 'DTMF (touches clavier)' },
      { key: 'hd_voice',               label: 'Voix HD' },
      { key: 'custom_ivr',             label: 'SVI personnalise' },
      { key: 'conference',             label: 'Conference' },
      { key: 'supervision_whisper',    label: 'Supervision chuchotement' },
      { key: 'supervision_barge',      label: 'Supervision intervention' },
      { key: 'supervision_listen',     label: 'Supervision ecoute' },
      { key: 'click_to_call',          label: 'Click-to-call' },
      { key: 'caller_id_custom',       label: 'Caller ID personnalise' },
      { key: 'voicemail',              label: 'Messagerie vocale' },
      { key: 'voicemail_transcription', label: 'Transcription messagerie' },
      { key: 'voicemail_to_email',     label: 'Messagerie vers email' },
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    features: [
      { key: 'unlimited_agents',    label: 'Agents illimites' },
      { key: 'agent_groups',        label: 'Groupes d\'agents' },
      { key: 'agent_skills',        label: 'Competences agents' },
      { key: 'agent_scripts',       label: 'Scripts agents' },
      { key: 'agent_goals_kpi',     label: 'Objectifs & KPI' },
      { key: 'agent_scheduling',    label: 'Planification horaires' },
      { key: 'agent_coaching_ai',   label: 'Coaching IA' },
      { key: 'agent_performance',   label: 'Performance agents' },
      { key: 'agent_sessions',      label: 'Sessions agents' },
    ],
  },
  {
    id: 'queues',
    label: 'Files d\'attente',
    features: [
      { key: 'unlimited_queues',    label: 'Files illimitees' },
      { key: 'queue_overflow',      label: 'Debordement' },
      { key: 'queue_callback',      label: 'Rappel automatique' },
      { key: 'queue_priority',      label: 'Priorites' },
      { key: 'queue_skill_routing', label: 'Routage par competence' },
      { key: 'queue_sla',           label: 'SLA' },
      { key: 'queue_cdr',           label: 'CDR files' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM & Contacts',
    features: [
      { key: 'contacts_search',    label: 'Recherche contacts' },
      { key: 'contacts_import',    label: 'Import contacts' },
      { key: 'contacts_export',    label: 'Export contacts' },
      { key: 'custom_fields',      label: 'Champs personnalises' },
      { key: 'contact_activities', label: 'Activites contacts' },
      { key: 'contact_tags',       label: 'Tags contacts' },
      { key: 'pipeline_stages',    label: 'Pipeline ventes' },
      { key: 'deal_tracking',      label: 'Suivi opportunites' },
      { key: 'crm_basic',          label: 'CRM de base' },
      { key: 'crm_advanced',       label: 'CRM avance' },
    ],
  },
  {
    id: 'messaging',
    label: 'Multicanal',
    features: [
      { key: 'sms',                  label: 'SMS' },
      { key: 'whatsapp',             label: 'WhatsApp' },
      { key: 'chat_widget',          label: 'Chat web' },
      { key: 'email_inbound',        label: 'Email entrant' },
      { key: 'email_outbound',       label: 'Email sortant' },
      { key: 'social_media',         label: 'Reseaux sociaux' },
      { key: 'messaging_templates',  label: 'Modeles messages' },
      { key: 'messaging_webhooks',   label: 'Webhooks messaging' },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    features: [
      { key: 'reports_basic',       label: 'Rapports de base' },
      { key: 'reports_advanced',     label: 'Rapports avances' },
      { key: 'real_time_dashboard',  label: 'Tableau de bord temps reel' },
      { key: 'custom_reports',       label: 'Rapports personnalises' },
      { key: 'scheduled_reports',    label: 'Rapports planifies' },
      { key: 'data_export',          label: 'Export donnees' },
      { key: 'cdr_export',           label: 'Export CDR' },
    ],
  },
  {
    id: 'advanced',
    label: 'Avance & Integrations',
    features: [
      { key: 'api_access',         label: 'Acces API' },
      { key: 'webhooks',           label: 'Webhooks' },
      { key: 'integrations',       label: 'Integrations tierces' },
      { key: 'white_label',        label: 'White label' },
      { key: 'sso_oauth',          label: 'SSO / OAuth' },
      { key: 'two_factor_auth',    label: 'Double authentification' },
      { key: 'ip_whitelist',       label: 'Liste blanche IP' },
      { key: 'predictive_dialer',  label: 'Predictive Dialer' },
      { key: 'power_dialer',       label: 'Power Dialer' },
      { key: 'robot_dialer',       label: 'Robot d\'appel' },
      { key: 'number_pool',        label: 'Pool de numeros' },
      { key: 'audit_logs_access',  label: 'Journaux d\'audit' },
    ],
  },
]

// Helper : nombre total de features activees pour un plan
export function countEnabledFeatures(features: Record<string, boolean>): number {
  return Object.values(features).filter(Boolean).length
}

// Helper : toutes les clefs de features (71)
export function allFeatureKeys(): string[] {
  return FEATURE_CATEGORIES.flatMap(c => c.features.map(f => f.key))
}

// Features "phares" a afficher sur les cartes de plan (pas la matrice complete)
export const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  STARTER: [
    'Appels entrants illimites',
    '3 agents max',
    '1 numero DID',
    'CRM de base',
    'Tableau de bord temps reel',
    'Support par email',
  ],
  BASIC: [
    'Appels entrants illimites',
    '5 agents max',
    '3 numeros DID',
    'SMS, Chat web, Email',
    'Import/Export contacts',
    'Support standard',
  ],
  CONFORT: [
    'Appels entrants + sortants',
    '15 agents max',
    '10 numeros DID',
    'Enregistrement + Transcription IA',
    'WhatsApp + Multicanal complet',
    'Rapports personnalises',
    'Support prioritaire',
  ],
  PRO: [
    'Agents illimites',
    '25 numeros DID',
    'Supervision complete (ecoute/chuchotement/intervention)',
    'CRM avance + Pipeline ventes',
    'API + Webhooks + Integrations',
    'Rapports avances + planifies',
    'Support dedie',
  ],
  ENTERPRISE: [
    'Tout illimite',
    'Predictive Dialer + Power Dialer + Robot d\'appel',
    'White label',
    'SSO / OAuth + Liste blanche IP',
    'Coaching agent IA',
    'Pool de numeros',
    'Support 24/7 dedie',
  ],
}
