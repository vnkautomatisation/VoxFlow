'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────
interface SubInfo {
  plan_id: string
  service_type: string
  quantity: number
  status: string
  unit_price: number
  billing_cycle: string
}

// ── API helper ─────────────────────────────────────────────
function useApi() {
  const getUrl = () =>
    typeof window !== 'undefined'
      ? localStorage.getItem('vf_url') || 'http://localhost:4000'
      : 'http://localhost:4000'
  const getTok = () =>
    typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}),
        ...(opts.headers || {}),
      },
    })
    return r.json()
  }
}

// ── Hardcoded plan catalog (spec) ──────────────────────────
interface PlanSpec {
  id: string
  name: string
  price: number          // CAD$ whole dollars
  features: string[]
  highlight?: boolean
}

interface AddonSpec {
  id: string
  name: string
  price: number
  subtitle: string
  features: string
}

const TELEPHONY_PLANS: PlanSpec[] = [
  {
    id: 'TEL_BASIC',
    name: 'Basic',
    price: 14,
    features: [
      'Appels entrants',
      '1 numero DID',
      'Messagerie vocale',
      'Dialer HTML',
      'Historique 30j',
    ],
  },
  {
    id: 'TEL_CONFORT',
    name: 'Confort',
    price: 35,
    features: [
      '+ Appels sortants illimites CA/US',
      '+ IVR basique',
      '+ Supervision live',
      '+ CRM integre',
      '+ Historique 1 an',
    ],
  },
  {
    id: 'TEL_PREMIUM',
    name: 'Premium',
    price: 55,
    highlight: true,
    features: [
      '+ Illimite CA/US/FR',
      '+ Enregistrement appels',
      '+ IA transcription Whisper',
      '+ Resume IA post-appel',
      '+ Analytics recharts',
      '+ Click-to-call CRM',
    ],
  },
  {
    id: 'TEL_PRO',
    name: 'Pro',
    price: 80,
    features: [
      '+ Pays Europeens illimite',
      '+ Workflow builder',
      '+ API acces complet',
      '+ Webhooks custom',
      '+ SLA 99.9%',
      '+ Support prioritaire',
    ],
  },
]

const DIALER_PLANS: PlanSpec[] = [
  {
    id: 'DIALER_CA_US',
    name: 'Dialer CA/US',
    price: 80,
    features: [
      'Campagnes sortantes',
      'Import CSV',
      'Detection repondeur',
      'Ratio ajustable',
      'CRM integre',
      'Appels entrants inclus',
    ],
  },
  {
    id: 'DIALER_FR_MOBILE',
    name: 'Dialer France Mobile',
    price: 110,
    features: [
      'Tout Dialer CA/US',
      '+ Appels France fixes & mobiles illimites',
      'Presence locale FR',
      'Recyclage prospects auto',
    ],
  },
]

const ROBOT_PLANS: PlanSpec[] = [
  {
    id: 'ROBOT',
    name: "Robot d'appel",
    price: 135,
    features: [
      '150k appels/h',
      'TTS dynamique',
      'Message vocal pre-enregistre',
      'IVR post-robot (touche 1 → agent)',
      'RGPD liste noire',
      'Export resultats',
    ],
  },
]

const ADDON_ITEMS: AddonSpec[] = [
  {
    id: 'ADDON_DID',
    name: 'Numero DID additionnel',
    price: 7,
    subtitle: 'Local / Gratuit / International',
    features: 'Ajoutez des numeros de telephone supplementaires a votre forfait',
  },
  {
    id: 'ADDON_RECORDING',
    name: 'Enregistrement etendu',
    price: 7,
    subtitle: 'Stockage 3 ans + export',
    features: 'Conservez vos enregistrements plus longtemps avec export inclus',
  },
  {
    id: 'ADDON_AI_TRANSCRIPTION',
    name: 'IA transcription',
    price: 11,
    subtitle: 'Whisper + resume auto',
    features: 'Transcription automatique et resume intelligent de vos appels',
  },
  {
    id: 'ADDON_SMS',
    name: 'SMS bidirectionnel',
    price: 14,
    subtitle: '+ cout par SMS selon pays',
    features: 'Envoyez et recevez des SMS directement depuis la plateforme',
  },
  {
    id: 'ADDON_CRM_INTEGRATIONS',
    name: 'Integrations CRM',
    price: 20,
    subtitle: 'HubSpot, Salesforce, Pipedrive',
    features: 'Connectez vos outils CRM favoris a VoxFlow',
  },
  {
    id: 'ADDON_MOBILE',
    name: 'App mobile iOS/Android',
    price: 7,
    subtitle: 'React Native PWA',
    features: 'Accedez a VoxFlow depuis votre telephone mobile',
  },
]

// ── Badge color mapping ────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  TEL_BASIC: 'bg-emerald-600',
  TEL_CONFORT: 'bg-sky-600',
  TEL_PREMIUM: 'bg-[#7b61ff]',
  TEL_PRO: 'bg-orange-500',
  DIALER_CA_US: 'bg-[#7b61ff]',
  DIALER_FR_MOBILE: 'bg-orange-500',
  ROBOT: 'bg-emerald-600',
  ADDON_DID: 'bg-sky-600',
  ADDON_RECORDING: 'bg-emerald-600',
  ADDON_AI_TRANSCRIPTION: 'bg-orange-500',
  ADDON_SMS: 'bg-[#7b61ff]',
  ADDON_CRM_INTEGRATIONS: 'bg-rose-500',
  ADDON_MOBILE: 'bg-sky-600',
}

// ── Tab definitions ────────────────────────────────────────
const TABS = [
  { key: 'TELEPHONY', label: "Telephonie d'entreprise" },
  { key: 'DIALER', label: 'Predictive Dialer' },
  { key: 'ROBOT', label: "Robot d'appel" },
  { key: 'ADDONS', label: 'Add-ons' },
] as const

type TabKey = (typeof TABS)[number]['key']

// ── Format price ───────────────────────────────────────────
function fmtPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

// ── Confirmation Modal (self-contained) ────────────────────
function ConfirmModal({
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel,
  danger,
}: {
  title: string
  message: string
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[460px] max-w-[95vw]"
      >
        <div className="text-[17px] font-bold text-[#eeeef8] mb-4">{title}</div>
        <div className="text-[13px] text-[#9898b8] leading-relaxed whitespace-pre-line mb-7">
          {message}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer transition-colors ${
              danger
                ? 'bg-[#ff4d6d] hover:bg-[#e8405f]'
                : 'bg-[#7b61ff] hover:bg-[#6145ff]'
            }`}
          >
            {confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Subscribe Modal ────────────────────────────────────────
function SubscribeModal({
  planName,
  price,
  onCancel,
  onConfirm,
}: {
  planName: string
  price: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[480px] max-w-[95vw]"
      >
        <div className="text-[17px] font-bold text-[#eeeef8] mb-2">
          Confirmer la souscription
        </div>
        <div className="text-[13px] text-[#9898b8] leading-relaxed mb-6">
          Vous etes sur le point de souscrire au forfait suivant :
        </div>
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-lg p-4 mb-6 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-[#eeeef8]">{planName}</span>
          <span className="text-[18px] font-extrabold text-[#7b61ff]">
            {price} CAD$/mois
          </span>
        </div>
        <div className="text-[12px] text-[#55557a] mb-6">
          Le montant sera ajoute a votre prochaine facture mensuelle. Vous pouvez annuler a tout moment.
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-[#7b61ff] hover:bg-[#6145ff] border-none rounded-lg text-white text-[13px] font-bold cursor-pointer transition-colors"
          >
            Souscrire
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function PlansPage() {
  const api = useApi()
  const [tab, setTab] = useState<TabKey>('TELEPHONY')
  const [subs, setSubs] = useState<SubInfo[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [subscribeTarget, setSubscribeTarget] = useState<{
    id: string
    name: string
    price: number
  } | null>(null)

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3500)
  }

  const loadData = useCallback(async () => {
    try {
      const subsRes = await api('/api/v1/client/portal/subscriptions')
      const sd = subsRes.data || subsRes
      if (Array.isArray(sd)) setSubs(sd)
    } catch {
      /* silent */
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Subscription helpers ──────────────────────────────────
  const getSubQty = (id: string): number => {
    const s = subs.find((s) => s.plan_id === id)
    return s ? s.quantity : 0
  }

  const isActive = (id: string): boolean => getSubQty(id) > 0

  const handleSubscribe = async (planId: string, price: number) => {
    try {
      await api('/api/v1/client/portal/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, quantity: 1, billing_cycle: 'monthly' }),
      })
      flash('Souscription effectuee avec succes')
      loadData()
    } catch {
      flash('Erreur lors de la souscription')
    }
    setSubscribeTarget(null)
  }

  const adjustQty = async (planId: string, delta: number) => {
    const current = getSubQty(planId)
    const next = Math.max(0, current + delta)
    try {
      await api('/api/v1/client/portal/subscribe', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, quantity: next, billing_cycle: 'monthly' }),
      })
      flash(next > current ? 'Quantite augmentee' : 'Quantite diminuee')
      loadData()
    } catch {
      flash('Erreur lors de la modification')
    }
  }

  const handleCancelSubscription = () => {
    flash("Demande d'annulation envoyee. Notre equipe vous contactera sous 24h.")
    setShowCancelModal(false)
  }

  // ── Footer data ───────────────────────────────────────────
  const getRegDate = (): string => {
    if (typeof window === 'undefined') return '-'
    try {
      const tok = localStorage.getItem('vf_tok')
      if (!tok) return '-'
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload.iat)
        return new Date(payload.iat * 1000).toLocaleDateString('fr-CA', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      return '-'
    } catch {
      return '-'
    }
  }

  const getNextPayment = (): string => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return next.toLocaleDateString('fr-CA', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const activePlansCount = subs.filter(
    (s) => s.status === 'active' || s.status === 'ACTIVE'
  ).length

  const currentTotal = (): number => {
    return subs.reduce((sum, s) => sum + s.unit_price * s.quantity, 0)
  }

  // ── Table header ──────────────────────────────────────────
  const TableHeader = () => (
    <div className="grid grid-cols-[180px_1fr_140px_80px_150px] px-5 py-3 border-b border-[#2e2e44] bg-[#14141c]">
      <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">
        Forfait
      </div>
      <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">
        Details
      </div>
      <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">
        Prix CAD$/mois
      </div>
      <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider text-center">
        Actif
      </div>
      <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider text-center">
        Actions
      </div>
    </div>
  )

  // ── Plan row renderer ─────────────────────────────────────
  const PlanRow = ({ plan }: { plan: PlanSpec }) => {
    const qty = getSubQty(plan.id)
    const active = qty > 0
    const badgeClass = BADGE_COLORS[plan.id] || 'bg-[#7b61ff]'

    return (
      <div className="grid grid-cols-[180px_1fr_140px_80px_150px] px-5 py-4 border-b border-[#1f1f2a] hover:bg-[#1f1f2a] items-center transition-colors">
        {/* Forfait badge */}
        <div className="flex items-center gap-2">
          <span
            className={`${badgeClass} px-3 py-2 rounded-lg text-[11px] font-extrabold text-white uppercase tracking-wide inline-block`}
          >
            {plan.name}
          </span>
          {plan.highlight && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#7b61ff]/15 text-[#a695ff] border border-[#7b61ff]/30 whitespace-nowrap">
              Populaire
            </span>
          )}
        </div>

        {/* Features */}
        <div className="pr-4">
          <div className="text-[12px] text-[#9898b8] leading-relaxed">
            {plan.features.join(', ')}
          </div>
        </div>

        {/* Prix */}
        <div>
          <span className="text-[20px] font-extrabold text-[#eeeef8]">{plan.price}</span>
          <span className="text-[12px] text-[#55557a] ml-1">CAD$/mois</span>
        </div>

        {/* Actif */}
        <div className="text-center">
          <span
            className={`text-[16px] font-bold ${active ? 'text-[#eeeef8]' : 'text-[#55557a]'}`}
          >
            {active ? qty : '-'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-2">
          {active ? (
            <>
              <button
                onClick={() => adjustQty(plan.id, -1)}
                className="w-8 h-8 rounded-lg bg-[#18181f] border border-[#2e2e44] text-[#9898b8] cursor-pointer text-[16px] flex items-center justify-center hover:bg-[#2e2e44] transition-colors"
              >
                -
              </button>
              <span className="min-w-[32px] text-center font-bold text-[14px] text-[#eeeef8]">
                {qty}
              </span>
              <button
                onClick={() => adjustQty(plan.id, 1)}
                className="w-8 h-8 rounded-lg bg-[#7b61ff]/15 border border-[#7b61ff]/30 text-[#a695ff] cursor-pointer text-[16px] flex items-center justify-center hover:bg-[#7b61ff]/25 transition-colors"
              >
                +
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                setSubscribeTarget({ id: plan.id, name: plan.name, price: plan.price })
              }
              className="px-4 py-2 bg-[#7b61ff] hover:bg-[#6145ff] text-white rounded-lg text-[12px] font-bold cursor-pointer transition-colors"
            >
              Souscrire
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Addon row renderer ────────────────────────────────────
  const AddonRow = ({ addon }: { addon: AddonSpec }) => {
    const qty = getSubQty(addon.id)
    const active = qty > 0
    const badgeClass = BADGE_COLORS[addon.id] || 'bg-[#7b61ff]'

    return (
      <div className="grid grid-cols-[180px_1fr_140px_80px_150px] px-5 py-4 border-b border-[#1f1f2a] hover:bg-[#1f1f2a] items-center transition-colors">
        {/* Addon badge */}
        <div>
          <span
            className={`${badgeClass} px-3 py-2 rounded-lg text-[10px] font-extrabold text-white uppercase tracking-wide inline-block leading-tight text-center`}
          >
            {addon.name}
          </span>
        </div>

        {/* Details */}
        <div className="pr-4">
          <div className="text-[12px] text-[#eeeef8] font-medium">{addon.subtitle}</div>
          <div className="text-[11px] text-[#9898b8] mt-0.5">{addon.features}</div>
        </div>

        {/* Prix */}
        <div>
          <span className="text-[20px] font-extrabold text-[#eeeef8]">{addon.price}</span>
          <span className="text-[12px] text-[#55557a] ml-1">CAD$/mois</span>
        </div>

        {/* Actif */}
        <div className="text-center">
          <span
            className={`text-[16px] font-bold ${active ? 'text-[#eeeef8]' : 'text-[#55557a]'}`}
          >
            {active ? qty : '-'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-2">
          {active ? (
            <>
              <button
                onClick={() => adjustQty(addon.id, -1)}
                className="w-8 h-8 rounded-lg bg-[#18181f] border border-[#2e2e44] text-[#9898b8] cursor-pointer text-[16px] flex items-center justify-center hover:bg-[#2e2e44] transition-colors"
              >
                -
              </button>
              <span className="min-w-[32px] text-center font-bold text-[14px] text-[#eeeef8]">
                {qty}
              </span>
              <button
                onClick={() => adjustQty(addon.id, 1)}
                className="w-8 h-8 rounded-lg bg-[#7b61ff]/15 border border-[#7b61ff]/30 text-[#a695ff] cursor-pointer text-[16px] flex items-center justify-center hover:bg-[#7b61ff]/25 transition-colors"
              >
                +
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                setSubscribeTarget({ id: addon.id, name: addon.name, price: addon.price })
              }
              className="px-4 py-2 bg-[#7b61ff] hover:bg-[#6145ff] text-white rounded-lg text-[12px] font-bold cursor-pointer transition-colors"
            >
              Souscrire
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────
  const EmptyState = ({ label }: { label: string }) => (
    <div className="py-10 text-center text-[#55557a] text-[13px] italic">{label}</div>
  )

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[#eeeef8] m-0 mb-1.5">Mes forfaits</h1>
        <p className="text-[13px] text-[#9898b8] m-0">
          Consultez et gerez vos forfaits, services et add-ons.
        </p>
      </div>

      {/* Flash message */}
      {msg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[13px] text-emerald-400">
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-[#2e2e44] mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-2.5 bg-transparent border-none text-[14px] cursor-pointer transition-all border-b-2 ${
              tab === t.key
                ? 'border-b-[#7b61ff] text-[#eeeef8] font-bold'
                : 'border-b-transparent text-[#55557a] font-medium hover:text-[#9898b8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: TELEPHONIE ─────────────────────────────────── */}
      {tab === 'TELEPHONY' && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
          <TableHeader />
          {TELEPHONY_PLANS.length > 0 ? (
            TELEPHONY_PLANS.map((p) => <PlanRow key={p.id} plan={p} />)
          ) : (
            <EmptyState label="Aucun forfait disponible dans cette categorie." />
          )}
        </div>
      )}

      {/* ── TAB: DIALER ─────────────────────────────────────── */}
      {tab === 'DIALER' && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
          <TableHeader />
          {DIALER_PLANS.length > 0 ? (
            DIALER_PLANS.map((p) => <PlanRow key={p.id} plan={p} />)
          ) : (
            <EmptyState label="Aucun forfait disponible dans cette categorie." />
          )}
        </div>
      )}

      {/* ── TAB: ROBOT ──────────────────────────────────────── */}
      {tab === 'ROBOT' && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
          <TableHeader />
          {ROBOT_PLANS.length > 0 ? (
            ROBOT_PLANS.map((p) => <PlanRow key={p.id} plan={p} />)
          ) : (
            <EmptyState label="Aucun forfait disponible dans cette categorie." />
          )}
          <div className="px-5 py-3 text-[11px] text-[#55557a] bg-[#14141c] border-t border-[#2e2e44]">
            Tarif flat : 135 CAD$/mois peu importe le volume d'appels.
          </div>
        </div>
      )}

      {/* ── TAB: ADD-ONS ────────────────────────────────────── */}
      {tab === 'ADDONS' && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
          <TableHeader />
          {ADDON_ITEMS.length > 0 ? (
            ADDON_ITEMS.map((a) => <AddonRow key={a.id} addon={a} />)
          ) : (
            <EmptyState label="Aucun add-on disponible." />
          )}
        </div>
      )}

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <div className="mt-4 bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 px-6">
        <div className="grid grid-cols-4 gap-4 mb-5">
          <div>
            <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">
              Date d'enregistrement
            </div>
            <div className="text-[13px] font-semibold text-[#eeeef8]">{getRegDate()}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">
              Prochain paiement
            </div>
            <div className="text-[13px] font-semibold text-[#eeeef8]">
              {getNextPayment()}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">
              Forfaits actifs
            </div>
            <div className="text-[13px] font-semibold text-[#eeeef8]">
              {activePlansCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">
              Montant recurrent total
            </div>
            <div className="text-[18px] font-extrabold text-[#7b61ff]">
              {fmtPrice(currentTotal())} CAD$/mois
            </div>
          </div>
        </div>

        {/* Annulation */}
        <div className="border-t border-[#2e2e44] pt-4 flex justify-end">
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-6 py-2.5 bg-[#ff4d6d]/10 border border-[#ff4d6d]/20 rounded-lg text-[#ff4d6d] text-[13px] font-semibold cursor-pointer hover:bg-[#ff4d6d]/20 transition-colors"
          >
            Demande d'annulation
          </button>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {subscribeTarget && (
        <SubscribeModal
          planName={subscribeTarget.name}
          price={subscribeTarget.price}
          onCancel={() => setSubscribeTarget(null)}
          onConfirm={() => handleSubscribe(subscribeTarget.id, subscribeTarget.price)}
        />
      )}

      {showCancelModal && (
        <ConfirmModal
          title="Demande d'annulation"
          message={
            "Etes-vous sur de vouloir soumettre une demande d'annulation de vos forfaits?\n\nNotre equipe vous contactera sous 24h pour confirmer et traiter votre demande."
          }
          onCancel={() => setShowCancelModal(false)}
          onConfirm={handleCancelSubscription}
          confirmLabel="Confirmer l'annulation"
          danger
        />
      )}
    </div>
  )
}
