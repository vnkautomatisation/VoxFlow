'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────
interface PlanDef {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_yearly: number | null
  features_list: string[]
  highlight: boolean
  service_type: string
}

interface AddonDef {
  sku: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number | null
  billing_unit: string
}

interface CartItem {
  planId: string
  planName: string
  serviceType: string
  priceCents: number
  cycle: 'monthly' | 'yearly'
  quantity: number
}

// ── API helper ─────────────────────────────────────────────
function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) },
    })
    return r.json()
  }
}

// ── Helpers ────────────────────────────────────────────────
function fmtPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function getProrataFactor(): { factor: number; today: string; endOfMonth: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const remaining = daysInMonth - dayOfMonth + 1
  const factor = remaining / daysInMonth
  const endDate = new Date(year, month + 1, 0)
  return {
    factor,
    today: now.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }),
    endOfMonth: endDate.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

// ── Service Icon Components ────────────────────────────────
function PhoneIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function RobotIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4d6d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

// ── Plan metadata (features) ──────────────────────────────
const PLAN_FEATURES: Record<string, string[]> = {
  TEL_BASIC: ['1 ligne incluse', 'Appels entrants illimites', 'IVR basique', 'Support courriel'],
  TEL_CONFORT: ['3 lignes incluses', 'Appels entrants/sortants', 'IVR avance', 'File d\'attente', 'Support prioritaire'],
  TEL_PREMIUM: ['5 lignes incluses', 'Appels illimites CA/US', 'IVR + ACD intelligent', 'Supervision temps reel', 'CRM integre', 'Support 24/7'],
  TEL_PRO: ['10 lignes incluses', 'Appels illimites mondial', 'IVR + ACD + IA', 'Supervision avancee', 'CRM + API', 'Gestionnaire de compte dedie'],
  DIALER_CA_US: ['Campagnes CA/US', 'Detection repondeur', 'Jusqu\'a 3 lignes simultanees', 'Tableau de bord campagne', 'Export resultats'],
  DIALER_FR_MOBILE: ['Campagnes FR + Mobile', 'Detection repondeur avancee', 'Jusqu\'a 5 lignes simultanees', 'Predictive algorithm', 'CRM integration', 'Rapports detailles'],
  ROBOT: ['150 000 appels/heure', 'TTS dynamique', 'IVR post-robot', 'API webhooks', 'Tableau de bord temps reel', 'Support premium'],
}

const PLAN_NAMES: Record<string, string> = {
  TEL_BASIC: 'Basique',
  TEL_CONFORT: 'Confort',
  TEL_PREMIUM: 'Premium',
  TEL_PRO: 'Pro',
  DIALER_CA_US: 'Dialer CA/US',
  DIALER_FR_MOBILE: 'Dialer FR/Mobile',
  ROBOT: 'Robot d\'appel',
}

// ── Stepper component ─────────────────────────────────────
function VerticalStepper({ currentStep }: { currentStep: number }) {
  const steps = [
    'Selectionnez votre service',
    'Configurez',
    'Panier',
    'Paiement',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '40px 32px' }}>
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === currentStep
        const isPassed = stepNum < currentStep
        const isFuture = stepNum > currentStep

        let circleBg = '#2a2a3e'
        let circleColor = '#5a5a7a'
        if (isActive) { circleBg = '#7b61ff'; circleColor = '#fff' }
        if (isPassed) { circleBg = '#00d4aa'; circleColor = '#fff' }

        return (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: circleBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: circleColor, flexShrink: 0,
              }}>
                {isPassed ? <CheckIcon /> : stepNum}
              </div>
              <div style={{
                fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isActive ? '#e8e8f8' : isPassed ? '#00d4aa' : '#5a5a7a',
              }}>
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 2, height: 40, background: isPassed ? '#00d4aa' : '#2a2a3e',
                marginLeft: 17, marginTop: 4, marginBottom: 4,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Service Selection ─────────────────────────────
function Step1({ onSelect }: { onSelect: (service: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null)

  const services = [
    {
      key: 'TELEPHONY',
      title: 'Telephonie d\'entreprise',
      icon: <PhoneIcon />,
      price: 'A partir de 14 CAD$/mois',
      desc: 'Appels entrants et sortants, IVR, supervision, CRM',
    },
    {
      key: 'DIALER',
      title: 'Predictive Dialer',
      icon: <ChartIcon />,
      price: 'A partir de 80 CAD$/mois',
      desc: 'Campagnes sortantes massives avec detection repondeur',
    },
    {
      key: 'ROBOT',
      title: 'Robot d\'appel',
      icon: <RobotIcon />,
      price: '135 CAD$/mois',
      desc: '150k appels/h, TTS dynamique, IVR post-robot',
    },
  ]

  return (
    <div style={{ padding: '40px 32px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', marginBottom: 8, marginTop: 0 }}>
        Selectionnez votre service
      </h2>
      <p style={{ fontSize: 14, color: '#8888a8', marginBottom: 32 }}>
        Choisissez le service qui correspond a vos besoins
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {services.map(s => {
          const isHov = hovered === s.key
          return (
            <div
              key={s.key}
              onClick={() => onSelect(s.key)}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: '#0f0f1e',
                border: `1px solid ${isHov ? '#7b61ff' : '#1e1e3a'}`,
                borderRadius: 12,
                padding: '24px 28px',
                cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isHov ? '0 0 20px #7b61ff22' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: '#7b61ff15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8' }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: '#7b61ff', fontWeight: 600, marginTop: 4 }}>{s.price}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isHov ? '#7b61ff' : '#5a5a7a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
              <div style={{ fontSize: 13, color: '#8888a8', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2: Configure Plan ────────────────────────────────
function Step2({
  service, plans, onBack, onAddToCart,
}: {
  service: string
  plans: PlanDef[]
  onBack: () => void
  onAddToCart: (item: CartItem) => void
}) {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const filteredPlans = plans.filter(p => p.service_type === service)

  useEffect(() => {
    const init: Record<string, number> = {}
    filteredPlans.forEach(p => { init[p.id] = service === 'ROBOT' ? 1 : 1 })
    setQuantities(init)
    if (filteredPlans.length > 0) {
      const hl = filteredPlans.find(p => p.highlight)
      setSelectedPlan(hl ? hl.id : filteredPlans[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service])

  const prorata = getProrataFactor()

  const getDisplayPrice = (p: PlanDef): number => {
    if (cycle === 'yearly' && p.price_yearly) {
      return Math.round(p.price_yearly / 12)
    }
    return p.price_monthly
  }

  const getActualMonthly = (p: PlanDef): number => {
    if (cycle === 'yearly' && p.price_yearly) {
      return Math.round(p.price_yearly / 12)
    }
    return p.price_monthly
  }

  const handleNext = () => {
    if (!selectedPlan) return
    const plan = filteredPlans.find(p => p.id === selectedPlan)
    if (!plan) return
    const qty = quantities[selectedPlan] || 1
    onAddToCart({
      planId: plan.id,
      planName: PLAN_NAMES[plan.id] || plan.name,
      serviceType: plan.service_type,
      priceCents: getActualMonthly(plan),
      cycle,
      quantity: qty,
    })
  }

  return (
    <div style={{ padding: '40px 32px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', marginBottom: 8, marginTop: 0 }}>
        Configurez votre forfait
      </h2>
      <p style={{ fontSize: 14, color: '#8888a8', marginBottom: 24 }}>
        {service === 'TELEPHONY' ? 'Telephonie d\'entreprise' : service === 'DIALER' ? 'Predictive Dialer' : 'Robot d\'appel'}
      </p>

      {/* Cycle toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{
          display: 'flex', background: '#0f0f1e', borderRadius: 10, border: '1px solid #1e1e3a', overflow: 'hidden',
        }}>
          <button
            onClick={() => setCycle('monthly')}
            style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: cycle === 'monthly' ? '#7b61ff' : 'transparent',
              color: cycle === 'monthly' ? '#fff' : '#8888a8',
              transition: 'all 0.2s',
            }}
          >
            Mensuel
          </button>
          <button
            onClick={() => setCycle('yearly')}
            style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: cycle === 'yearly' ? '#7b61ff' : 'transparent',
              color: cycle === 'yearly' ? '#fff' : '#8888a8',
              transition: 'all 0.2s',
            }}
          >
            Annuel
          </button>
        </div>
        {cycle === 'yearly' && (
          <span style={{
            padding: '4px 12px', borderRadius: 20, background: '#00d4aa22', color: '#00d4aa',
            fontSize: 12, fontWeight: 600,
          }}>
            Economisez 2 mois
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: service === 'ROBOT' ? '1fr' : service === 'DIALER' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 16, marginBottom: 32,
      }}>
        {filteredPlans.map(p => {
          const isSelected = selectedPlan === p.id
          const isHighlight = p.highlight
          const displayPrice = getDisplayPrice(p)
          const features = PLAN_FEATURES[p.id] || p.features_list || []

          return (
            <div
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              style={{
                background: '#0f0f1e',
                border: `${isHighlight && isSelected ? '2px' : '1px'} solid ${isSelected ? '#7b61ff' : '#1e1e3a'}`,
                borderRadius: 14,
                padding: '24px 20px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isSelected ? '0 0 24px #7b61ff22' : 'none',
              }}
            >
              {isHighlight && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 16px', borderRadius: 20, background: '#7b61ff', color: '#fff',
                  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  Populaire
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f8', marginBottom: 8, marginTop: isHighlight ? 4 : 0 }}>
                {PLAN_NAMES[p.id] || p.name}
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#e8e8f8' }}>
                  {fmtPrice(displayPrice)}
                </span>
                <span style={{ fontSize: 13, color: '#8888a8', marginLeft: 4 }}>CAD$/mois</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8888a8' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </div>
                ))}
              </div>
              {service !== 'ROBOT' && (
                <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 16 }}>
                  <label style={{ fontSize: 12, color: '#8888a8', display: 'block', marginBottom: 6 }}>
                    Nombre d'utilisateurs
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantities[p.id] || 1}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const val = Math.max(1, parseInt(e.target.value) || 1)
                      setQuantities(prev => ({ ...prev, [p.id]: val }))
                    }}
                    style={{
                      width: '100%', padding: '8px 12px', background: '#080810', border: '1px solid #2a2a3e',
                      borderRadius: 8, color: '#e8e8f8', fontSize: 14, fontWeight: 600,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Prorata note */}
      <div style={{
        padding: '14px 20px', background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 10,
        fontSize: 13, color: '#8888a8', marginBottom: 32, lineHeight: 1.5,
      }}>
        <span style={{ fontWeight: 600, color: '#e8e8f8' }}>Prorata dynamique :</span>{' '}
        Montant calcule du {prorata.today} au {prorata.endOfMonth}.
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 28px', background: '#1a1a3a', border: '1px solid #2a2a3e',
            borderRadius: 10, color: '#8888a8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={!selectedPlan}
          style={{
            padding: '12px 28px', background: selectedPlan ? '#7b61ff' : '#2a2a3e',
            border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: selectedPlan ? 'pointer' : 'not-allowed', opacity: selectedPlan ? 1 : 0.5,
          }}
        >
          Suivant
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Cart ──────────────────────────────────────────
function Step3({
  cart, onRemove, onBack, onContinueShopping, onCheckout,
}: {
  cart: CartItem[]
  onRemove: (index: number) => void
  onBack: () => void
  onContinueShopping: () => void
  onCheckout: () => void
}) {
  const api = useApi()
  const [promoCode, setPromoCode] = useState('')
  const [promoMsg, setPromoMsg] = useState<string | null>(null)
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [applyingPromo, setApplyingPromo] = useState(false)

  const prorata = getProrataFactor()

  const monthlyTotal = cart.reduce((acc, item) => acc + item.priceCents * item.quantity, 0)
  const proratedTotal = Math.round(monthlyTotal * prorata.factor)
  const discountedTotal = Math.max(0, proratedTotal - promoDiscount)

  const applyPromo = async () => {
    if (!promoCode.trim()) return
    setApplyingPromo(true)
    setPromoMsg(null)
    try {
      const res = await api('/api/v1/client/portal/promo/validate', {
        method: 'POST',
        body: JSON.stringify({ code: promoCode.trim() }),
      })
      if (res.valid) {
        setPromoDiscount(res.discount_cents || 0)
        setPromoMsg('Code promo applique')
      } else {
        setPromoMsg(res.message || 'Code promo invalide')
        setPromoDiscount(0)
      }
    } catch {
      setPromoMsg('Erreur lors de la validation')
      setPromoDiscount(0)
    }
    setApplyingPromo(false)
  }

  const serviceIcon = (type: string) => {
    switch (type) {
      case 'TELEPHONY': return <PhoneIcon />
      case 'DIALER': return <ChartIcon />
      case 'ROBOT': return <RobotIcon />
      default: return <PhoneIcon />
    }
  }

  return (
    <div style={{ padding: '40px 32px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', marginBottom: 8, marginTop: 0 }}>
        Votre panier
      </h2>
      <p style={{ fontSize: 14, color: '#8888a8', marginBottom: 32 }}>
        Verifiez vos selections avant de passer commande
      </p>

      {cart.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: '#5a5a7a', fontSize: 14,
          background: '#0f0f1e', borderRadius: 12, border: '1px solid #1e1e3a',
        }}>
          Votre panier est vide
        </div>
      ) : (
        <>
          {/* Cart items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {cart.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: '#7b61ff15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {serviceIcon(item.serviceType)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f8' }}>
                    {item.planName}
                    {item.quantity > 1 && <span style={{ color: '#8888a8', fontWeight: 400 }}> x{item.quantity}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#8888a8', marginTop: 2 }}>
                    {item.cycle === 'monthly' ? 'Mensuel' : 'Annuel'}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f8', marginRight: 12 }}>
                  {fmtPrice(item.priceCents * item.quantity)} CAD$
                </div>
                <button
                  onClick={() => onRemove(idx)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>

          {/* Promo code */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center',
          }}>
            <input
              type="text"
              placeholder="Code promo"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value)}
              style={{
                flex: 1, padding: '10px 16px', background: '#0f0f1e', border: '1px solid #1e1e3a',
                borderRadius: 10, color: '#e8e8f8', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={applyPromo}
              disabled={applyingPromo}
              style={{
                padding: '10px 24px', background: '#1a1a3a', border: '1px solid #2a2a3e',
                borderRadius: 10, color: '#e8e8f8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: applyingPromo ? 0.5 : 1,
              }}
            >
              {applyingPromo ? '...' : 'Appliquer'}
            </button>
          </div>
          {promoMsg && (
            <div style={{
              fontSize: 13, marginBottom: 20,
              color: promoDiscount > 0 ? '#00d4aa' : '#ff4d6d',
            }}>
              {promoMsg}
              {promoDiscount > 0 && ` (-${fmtPrice(promoDiscount)} CAD$)`}
            </div>
          )}

          {/* Total */}
          <div style={{
            padding: '20px 24px', background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12,
            marginBottom: 32,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#8888a8' }}>Sous-total mensuel</span>
              <span style={{ fontSize: 13, color: '#8888a8' }}>{fmtPrice(monthlyTotal)} CAD$</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#8888a8' }}>Prorata ({prorata.today} - {prorata.endOfMonth})</span>
              <span style={{ fontSize: 13, color: '#8888a8' }}>{fmtPrice(proratedTotal)} CAD$</span>
            </div>
            {promoDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#00d4aa' }}>Remise promo</span>
                <span style={{ fontSize: 13, color: '#00d4aa' }}>-{fmtPrice(promoDiscount)} CAD$</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f8' }}>Total a payer aujourd'hui</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#7b61ff' }}>{fmtPrice(discountedTotal)} CAD$</span>
            </div>
          </div>
        </>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 28px', background: '#1a1a3a', border: '1px solid #2a2a3e',
            borderRadius: 10, color: '#8888a8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Retour
        </button>
        <button
          onClick={onContinueShopping}
          style={{
            padding: '12px 28px', background: '#1a1a3a', border: '1px solid #2a2a3e',
            borderRadius: 10, color: '#e8e8f8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Continuer vos achats
        </button>
        {cart.length > 0 && (
          <button
            onClick={onCheckout}
            style={{
              padding: '12px 28px', background: '#7b61ff', border: 'none',
              borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Passer la commande
          </button>
        )}
      </div>
    </div>
  )
}

// ── Step 4: Payment ───────────────────────────────────────
function Step4({
  cart, onBack, onConfirm, submitting,
}: {
  cart: CartItem[]
  onBack: () => void
  onConfirm: () => void
  submitting: boolean
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [acceptCGV, setAcceptCGV] = useState(false)

  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('vf_tok')
  const isFirstSub = !hasToken

  const prorata = getProrataFactor()
  const monthlyTotal = cart.reduce((acc, item) => acc + item.priceCents * item.quantity, 0)
  const proratedTotal = Math.round(monthlyTotal * prorata.factor)

  const formatCardNumber = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 16)
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const formatExpiry = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 4)
    if (cleaned.length > 2) return cleaned.slice(0, 2) + '/' + cleaned.slice(2)
    return cleaned
  }

  const canSubmit = acceptCGV && !submitting

  return (
    <div style={{ padding: '40px 32px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', marginBottom: 8, marginTop: 0 }}>
        Paiement
      </h2>
      <p style={{ fontSize: 14, color: '#8888a8', marginBottom: 32 }}>
        Finalisez votre commande
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Left: Payment form */}
        <div>
          {isFirstSub && (
            <div style={{
              padding: '16px 20px', background: '#00d4aa15', border: '1px solid #00d4aa33',
              borderRadius: 12, marginBottom: 24, fontSize: 14, color: '#00d4aa', fontWeight: 600,
            }}>
              Essai gratuit 14 jours -- aucun paiement aujourd'hui
            </div>
          )}

          <div style={{
            padding: '24px', background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 14,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f8', marginBottom: 20 }}>
              Informations de paiement
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#8888a8', display: 'block', marginBottom: 6 }}>
                Numero de carte
              </label>
              <input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                style={{
                  width: '100%', padding: '12px 16px', background: '#080810', border: '1px solid #2a2a3e',
                  borderRadius: 10, color: '#e8e8f8', fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  letterSpacing: '1px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#8888a8', display: 'block', marginBottom: 6 }}>
                  Date d'expiration
                </label>
                <input
                  type="text"
                  placeholder="MM/AA"
                  value={expiry}
                  onChange={e => setExpiry(formatExpiry(e.target.value))}
                  style={{
                    width: '100%', padding: '12px 16px', background: '#080810', border: '1px solid #2a2a3e',
                    borderRadius: 10, color: '#e8e8f8', fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#8888a8', display: 'block', marginBottom: 6 }}>
                  CVC
                </label>
                <input
                  type="text"
                  placeholder="123"
                  value={cvc}
                  onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{
                    width: '100%', padding: '12px 16px', background: '#080810', border: '1px solid #2a2a3e',
                    borderRadius: 10, color: '#e8e8f8', fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* CGV checkbox */}
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              onClick={() => setAcceptCGV(!acceptCGV)}
              style={{
                width: 20, height: 20, borderRadius: 4, border: `1px solid ${acceptCGV ? '#7b61ff' : '#2a2a3e'}`,
                background: acceptCGV ? '#7b61ff' : 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {acceptCGV && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13, color: '#8888a8' }}>
              J'accepte les conditions generales de vente
            </span>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
            <button
              onClick={onBack}
              style={{
                padding: '12px 28px', background: '#1a1a3a', border: '1px solid #2a2a3e',
                borderRadius: 10, color: '#8888a8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Retour
            </button>
            <button
              onClick={onConfirm}
              disabled={!canSubmit}
              style={{
                padding: '12px 28px', background: canSubmit ? '#7b61ff' : '#2a2a3e',
                border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5,
                flex: 1,
              }}
            >
              {submitting ? 'Traitement en cours...' : 'Confirmer la commande'}
            </button>
          </div>
        </div>

        {/* Right: Order summary */}
        <div>
          <div style={{
            padding: '24px', background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 14,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f8', marginBottom: 20 }}>
              Recapitulatif
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#e8e8f8', fontWeight: 500 }}>
                      {item.planName}
                      {item.quantity > 1 && <span style={{ color: '#8888a8' }}> x{item.quantity}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 2 }}>
                      {item.cycle === 'monthly' ? 'Mensuel' : 'Annuel'}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f8' }}>
                    {fmtPrice(item.priceCents * item.quantity)} CAD$
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#8888a8' }}>Sous-total/mois</span>
                <span style={{ fontSize: 13, color: '#8888a8' }}>{fmtPrice(monthlyTotal)} CAD$</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#8888a8' }}>Prorata</span>
                <span style={{ fontSize: 13, color: '#8888a8' }}>{fmtPrice(proratedTotal)} CAD$</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderTop: '1px solid #1e1e3a', paddingTop: 16,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f8' }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#7b61ff' }}>
                  {isFirstSub ? '0,00' : fmtPrice(proratedTotal)} CAD$
                </span>
              </div>
              {isFirstSub && (
                <div style={{ fontSize: 12, color: '#00d4aa', marginTop: 8, textAlign: 'right' }}>
                  Gratuit pendant 14 jours
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function CommanderPage() {
  const api = useApi()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(1)
  const [service, setService] = useState<string | null>(null)
  const [plans, setPlans] = useState<PlanDef[]>([])
  const [addons, setAddons] = useState<AddonDef[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Load catalog
  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/v1/client/portal/plans-catalog')
        const d = res.data || res
        const allPlans: PlanDef[] = [
          ...(d.services?.TELEPHONY || []),
          ...(d.services?.DIALER || []),
          ...(d.services?.ROBOT || []),
        ]
        setPlans(allPlans)
        setAddons(d.addons || [])
      } catch {
        // silent
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle URL params for pre-selection
  useEffect(() => {
    if (!loading && plans.length > 0) {
      const sParam = searchParams.get('service')
      const pParam = searchParams.get('plan')
      if (sParam) {
        const serviceKey = sParam.toUpperCase()
        if (['TELEPHONY', 'DIALER', 'ROBOT'].includes(serviceKey)) {
          setService(serviceKey)
          setStep(2)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, plans])

  const handleServiceSelect = (svc: string) => {
    setService(svc)
    setStep(2)
  }

  const handleAddToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.findIndex(c => c.planId === item.planId && c.cycle === item.cycle)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + item.quantity }
        return updated
      }
      return [...prev, item]
    })
    setStep(3)
  }

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const handleConfirmOrder = async () => {
    setSubmitting(true)
    try {
      const items = cart.map(c => ({
        plan_id: c.planId,
        quantity: c.quantity,
        billing_cycle: c.cycle,
      }))
      await api('/api/v1/client/portal/subscribe', {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      router.push('/client?order=success')
    } catch {
      // silent
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh', background: '#080810', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #1e1e3a', borderTopColor: '#7b61ff',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh', overflowY: 'auto', background: '#080810',
      fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      display: 'flex',
    }}>
      {/* Left: Vertical Stepper */}
      <div style={{
        width: '30%', minWidth: 260, maxWidth: 340,
        background: '#0a0a18', borderRight: '1px solid #1e1e3a',
        position: 'sticky', top: 0, height: '100vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '32px 24px 16px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e8e8f8', letterSpacing: '-0.3px' }}>
            VoxFlow
          </div>
          <div style={{ fontSize: 12, color: '#5a5a7a', marginTop: 4 }}>Commander</div>
        </div>
        <VerticalStepper currentStep={step} />
        <div style={{ flex: 1 }} />
        <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e3a', fontSize: 11, color: '#3a3a5a' }}>
          Paiements securises par Stripe
        </div>
      </div>

      {/* Right: Step content */}
      <div style={{ flex: 1, minHeight: '100vh', overflowY: 'auto' }}>
        {step === 1 && (
          <Step1 onSelect={handleServiceSelect} />
        )}
        {step === 2 && service && (
          <Step2
            service={service}
            plans={plans}
            onBack={() => setStep(1)}
            onAddToCart={handleAddToCart}
          />
        )}
        {step === 3 && (
          <Step3
            cart={cart}
            onRemove={handleRemoveFromCart}
            onBack={() => setStep(2)}
            onContinueShopping={() => setStep(1)}
            onCheckout={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4
            cart={cart}
            onBack={() => setStep(3)}
            onConfirm={handleConfirmOrder}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}