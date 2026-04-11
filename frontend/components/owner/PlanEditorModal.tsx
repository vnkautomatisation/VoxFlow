'use client'

import { useState, useEffect } from 'react'
import type { PlanDef } from '@/app/owner/plans/page'

// ══════════════════════════════════════════════════════════════
//  PlanEditorModal — modal de création/édition d'un forfait
//
//  Permet au OWNER de définir :
//   - infos : id (majuscules), name, description, price_monthly
//   - limites : max_agents, max_dids, max_calls_month
//   - features : liste complète de toggles groupés par catégorie
//   - visibilité : is_public, is_default, sort_order
// ══════════════════════════════════════════════════════════════

interface Props {
  plan: PlanDef | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}

// Icônes SVG par groupe (remplace les emojis pour un rendu pro)
const GroupIcon = ({ name }: { name: string }) => {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'phone':
      return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    case 'users':
      return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case 'chat':
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    case 'ai':
      return <svg {...common}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
    case 'automation':
      return <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    case 'chart':
      return <svg {...common}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    default:
      return null
  }
}

// Catégories de features pour l'UI
const FEATURE_GROUPS: Array<{
  label:    string
  iconName: string
  features: Array<{ key: string; label: string; description: string }>
}> = [
  {
    label: 'Téléphonie',
    iconName: 'phone',
    features: [
      { key: 'outbound_calls',     label: 'Appels sortants',    description: 'Permet aux agents de composer des numéros sortants' },
      { key: 'inbound_calls',      label: 'Appels entrants',    description: 'Recevoir des appels sur les numéros assignés' },
      { key: 'queues',             label: "Files d'attente",    description: 'Routage ACD avec files prioritaires' },
      { key: 'agents_supervision', label: 'Supervision agents', description: 'Voir le statut temps réel et barge-in (admin)' },
      { key: 'history',            label: 'Historique d\'appels', description: 'Accès à l\'historique complet des appels' },
      { key: 'voicemails',         label: 'Messagerie vocale',  description: 'Boîte de réception pour les messages vocaux' },
    ],
  },
  {
    label: 'CRM & Contacts',
    iconName: 'users',
    features: [
      { key: 'contacts_search', label: 'Recherche de contacts', description: 'Base de contacts avec recherche' },
      { key: 'crm_basic',       label: 'CRM basique',           description: 'Fiches contact, notes, tags' },
      { key: 'crm_advanced',    label: 'CRM avancé',            description: 'Pipelines, deals, automation, custom fields' },
    ],
  },
  {
    label: 'Multicanal',
    iconName: 'chat',
    features: [
      { key: 'messaging', label: 'Multicanal (SMS/Chat/Email/WhatsApp)', description: 'Boîte unifiée pour tous les canaux' },
    ],
  },
  {
    label: 'IA & Analyse',
    iconName: 'ai',
    features: [
      { key: 'call_recording',   label: 'Enregistrement des appels',   description: 'Enregistrement audio + stockage' },
      { key: 'ai_transcription', label: 'Transcription IA',            description: 'Speech-to-text automatique' },
      { key: 'ai_sentiment',     label: 'Analyse de sentiment',        description: 'Détection automatique du sentiment client' },
    ],
  },
  {
    label: 'Automation',
    iconName: 'automation',
    features: [
      { key: 'robot_dialer', label: 'Robot dialer (Predictive)', description: 'Composition automatique de masse' },
      { key: 'api_access',   label: 'Accès API',                  description: 'API publique pour intégrations custom' },
    ],
  },
  {
    label: 'Reporting',
    iconName: 'chart',
    features: [
      { key: 'reports_basic',    label: 'Rapports basiques',  description: 'KPIs temps réel et export CSV' },
      { key: 'reports_advanced', label: 'Rapports avancés',   description: 'Analytics prédictifs, dashboards custom' },
      { key: 'white_label',      label: 'White label',         description: 'Rebranding complet (logo, couleurs, domaine)' },
    ],
  },
]

const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap(g => g.features.map(f => f.key))

export default function PlanEditorModal({ plan, onClose, onSave }: Props) {
  const isEdit = !!plan

  const [form, setForm] = useState({
    id:              plan?.id              || '',
    name:            plan?.name            || '',
    description:     plan?.description     || '',
    price_monthly:   plan?.price_monthly   || 0,
    price_yearly:    plan?.price_yearly    || 0,
    max_agents:      plan?.max_agents      ?? null as number | null,
    max_dids:        plan?.max_dids        ?? null as number | null,
    max_calls_month: plan?.max_calls_month ?? null as number | null,
    features:        { ...(plan?.features || {}) } as Record<string, boolean>,
    is_default:      plan?.is_default      || false,
    is_public:       plan?.is_public       ?? true,
    sort_order:      plan?.sort_order      || 0,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Initialiser toutes les features manquantes à false
  useEffect(() => {
    setForm(f => {
      const features = { ...f.features }
      ALL_FEATURE_KEYS.forEach(k => { if (features[k] === undefined) features[k] = false })
      return { ...f, features }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFeature = (key: string) => {
    setForm(f => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.id.match(/^[A-Z0-9_]+$/)) {
      setError('L\'ID doit être en MAJUSCULES (lettres, chiffres, underscore uniquement)')
      return
    }
    if (form.name.length < 2) {
      setError('Le nom doit contenir au moins 2 caractères')
      return
    }
    if (form.price_monthly < 0) {
      setError('Le prix doit être positif')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        id:              form.id,
        name:            form.name,
        description:     form.description || null,
        price_monthly:   Math.round(form.price_monthly),
        price_yearly:    form.price_yearly ? Math.round(form.price_yearly) : null,
        max_agents:      form.max_agents,
        max_dids:        form.max_dids,
        max_calls_month: form.max_calls_month,
        features:        form.features,
        is_default:      form.is_default,
        is_public:       form.is_public,
        sort_order:      form.sort_order,
      }
      if (isEdit) delete payload.id // ne pas envoyer l'id sur PATCH
      await onSave(payload)
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-3xl shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] sticky top-0 bg-[#18181f] rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-[#eeeef8]">
              {isEdit ? `Modifier ${plan?.name}` : 'Nouveau forfait'}
            </h2>
            <p className="text-[11px] text-[#55557a] mt-0.5">
              Configurez les fonctionnalités incluses dans ce forfait
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#55557a] hover:text-[#eeeef8] p-2 rounded-lg hover:bg-[#1f1f2a] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-4 py-3 text-xs">
              {error}
            </div>
          )}

          {/* Infos de base */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3">Informations</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">ID</label>
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => setForm(f => ({ ...f, id: e.target.value.toUpperCase() }))}
                  disabled={isEdit}
                  placeholder="ENTERPRISE_PLUS"
                  required
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm font-mono disabled:opacity-50 focus:border-[#7b61ff] outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom affiché</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enterprise Plus"
                  required
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm focus:border-[#7b61ff] outline-none transition-colors"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Description</label>
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Parfait pour les équipes qui ont besoin de..."
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm focus:border-[#7b61ff] outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* Tarification */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3">Tarification (en cents CAD)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Prix mensuel (¢)</label>
                <input
                  type="number"
                  value={form.price_monthly}
                  onChange={(e) => setForm(f => ({ ...f, price_monthly: parseInt(e.target.value) || 0 }))}
                  min={0}
                  step={100}
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm font-mono focus:border-[#7b61ff] outline-none transition-colors"
                />
                <div className="text-[10px] text-[#55557a] mt-1">= {(form.price_monthly / 100).toFixed(2)} $ CAD</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Prix annuel (¢) <span className="text-[#35355a]">optionnel</span></label>
                <input
                  type="number"
                  value={form.price_yearly || ''}
                  onChange={(e) => setForm(f => ({ ...f, price_yearly: parseInt(e.target.value) || 0 }))}
                  min={0}
                  step={100}
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm font-mono focus:border-[#7b61ff] outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Limites */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3">Limites (vide = illimité)</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'max_agents',      label: 'Max agents' },
                { key: 'max_dids',        label: 'Max numéros' },
                { key: 'max_calls_month', label: 'Appels/mois' },
              ] as const).map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{field.label}</label>
                  <input
                    type="number"
                    value={(form as any)[field.key] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : parseInt(e.target.value)
                      setForm(f => ({ ...f, [field.key]: v }))
                    }}
                    min={0}
                    placeholder="∞"
                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm font-mono focus:border-[#7b61ff] outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Features par groupe */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3">Fonctionnalités</h3>
            <div className="space-y-4">
              {FEATURE_GROUPS.map(group => (
                <div key={group.label} className="bg-[#1f1f2a] border border-[#2e2e44] rounded-xl p-4">
                  <div className="text-[11px] font-bold text-[#eeeef8] mb-3 flex items-center gap-2">
                    <span className="text-[#7b61ff]"><GroupIcon name={group.iconName} /></span>
                    {group.label}
                  </div>
                  <div className="space-y-2">
                    {group.features.map(feature => (
                      <label
                        key={feature.key}
                        className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#18181f]/50 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFeature(feature.key)}
                          className={`flex-shrink-0 w-10 h-5 rounded-full border-2 transition-colors relative ${
                            form.features[feature.key]
                              ? 'bg-[#7b61ff] border-[#7b61ff]'
                              : 'bg-[#18181f] border-[#2e2e44]'
                          }`}
                        >
                          <span
                            className={`absolute top-[1px] w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                              form.features[feature.key] ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-[#eeeef8]">{feature.label}</div>
                          <div className="text-[10px] text-[#55557a] mt-0.5">{feature.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3">Visibilité</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_public}
                  onChange={(e) => setForm(f => ({ ...f, is_public: e.target.checked }))}
                  className="w-4 h-4 accent-[#7b61ff]"
                />
                <span className="text-xs text-[#eeeef8]">
                  <span className="font-bold">Visible</span> dans la page des forfaits clients (/client/plans)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm(f => ({ ...f, is_default: e.target.checked }))}
                  className="w-4 h-4 accent-[#7b61ff]"
                />
                <span className="text-xs text-[#eeeef8]">
                  <span className="font-bold">Forfait par défaut</span> pour les nouveaux essais 14 jours
                </span>
              </label>
            </div>
            <div className="mt-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Ordre d'affichage</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-24 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm font-mono focus:border-[#7b61ff] outline-none transition-colors"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#2e2e44] bg-[#18181f] rounded-b-2xl sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-xs font-bold hover:text-[#eeeef8] transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit as any}
            disabled={saving}
            className="bg-[#7b61ff] hover:bg-[#6145ff] text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le forfait'}
          </button>
        </div>
      </div>
    </div>
  )
}
