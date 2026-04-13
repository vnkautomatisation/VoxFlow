'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PURPLE = '#7b61ff'
const GREEN = '#00d4aa'
const BG = '#080810'
const CARD_BG = '#0f0f1e'
const CARD_BORDER = '#1e1e3a'
const FONT = "'DM Sans', sans-serif"

/* ------------------------------------------------------------------ */
/*  Telephony plans                                                    */
/* ------------------------------------------------------------------ */

interface TelPlan {
  id: string
  name: string
  monthlyPrice: number
  annualMonthly: number
  popular?: boolean
  features: { label: string; included: boolean | string }[]
}

const TEL_PLANS: TelPlan[] = [
  {
    id: 'TEL_BASIC',
    name: 'Basic',
    monthlyPrice: 14,
    annualMonthly: 11.67,
    features: [
      { label: 'Appels entrants', included: true },
      { label: 'Appels sortants', included: false },
      { label: 'DID inclus', included: '1' },
      { label: 'Messagerie vocale', included: true },
      { label: 'IVR', included: false },
      { label: 'Supervision', included: false },
      { label: 'CRM', included: false },
      { label: 'Enregistrement', included: false },
      { label: 'IA transcription', included: false },
      { label: 'Analytics', included: false },
      { label: 'API', included: false },
    ],
  },
  {
    id: 'TEL_CONFORT',
    name: 'Confort',
    monthlyPrice: 35,
    annualMonthly: 29.17,
    features: [
      { label: 'Appels entrants', included: true },
      { label: 'Sortants illimites CA/US', included: true },
      { label: 'DID inclus', included: '5' },
      { label: 'Messagerie vocale', included: true },
      { label: 'IVR basique', included: true },
      { label: 'Supervision', included: true },
      { label: 'CRM', included: true },
      { label: 'Enregistrement', included: false },
      { label: 'IA transcription', included: false },
      { label: 'Analytics', included: false },
      { label: 'API', included: false },
    ],
  },
  {
    id: 'TEL_PREMIUM',
    name: 'Premium',
    monthlyPrice: 55,
    annualMonthly: 45.83,
    popular: true,
    features: [
      { label: 'Appels entrants', included: true },
      { label: 'Illimite CA/US/FR', included: true },
      { label: 'DID inclus', included: '15' },
      { label: 'Messagerie vocale', included: true },
      { label: 'IVR avance', included: true },
      { label: 'Supervision', included: true },
      { label: 'CRM', included: true },
      { label: 'Enregistrement', included: true },
      { label: 'IA transcription', included: true },
      { label: 'Analytics', included: true },
      { label: 'Click-to-call', included: true },
      { label: 'API', included: false },
    ],
  },
  {
    id: 'TEL_PRO',
    name: 'Pro',
    monthlyPrice: 80,
    annualMonthly: 66.67,
    features: [
      { label: 'Appels entrants', included: true },
      { label: 'Illimite mondial', included: true },
      { label: 'DID illimite', included: true },
      { label: 'Messagerie vocale', included: true },
      { label: 'IVR avance', included: true },
      { label: 'Supervision', included: true },
      { label: 'CRM', included: true },
      { label: 'Enregistrement', included: true },
      { label: 'IA transcription', included: true },
      { label: 'Analytics', included: true },
      { label: 'Click-to-call', included: true },
      { label: 'Workflow builder', included: true },
      { label: 'API', included: true },
      { label: 'Webhooks', included: true },
      { label: 'SLA 99.9%', included: true },
      { label: 'Support prioritaire', included: true },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Dialer plans                                                       */
/* ------------------------------------------------------------------ */

interface DialerPlan {
  id: string
  name: string
  monthlyPrice: number
  annualMonthly: number
  desc: string
}

const DIALER_PLANS: DialerPlan[] = [
  {
    id: 'DIALER_CA_US',
    name: 'Predictive Dialer CA/US',
    monthlyPrice: 80,
    annualMonthly: 66.67,
    desc: 'Composeur predictif pour appels sortants Canada et USA. Augmentez la productivite de vos agents.',
  },
  {
    id: 'DIALER_FR_MOBILE',
    name: 'Predictive Dialer FR/Mobile',
    monthlyPrice: 110,
    annualMonthly: 91.67,
    desc: 'Composeur predictif avec couverture France et mobile internationale.',
  },
]

/* ------------------------------------------------------------------ */
/*  Robot plan                                                         */
/* ------------------------------------------------------------------ */

const ROBOT = {
  id: 'ROBOT',
  name: "Robot d'appel",
  monthlyPrice: 135,
  annualMonthly: 112.50,
  desc: 'Automatisez vos campagnes avec un robot vocal intelligent. Appels, suivis, rappels, sondages.',
}

/* ------------------------------------------------------------------ */
/*  Add-ons                                                            */
/* ------------------------------------------------------------------ */

interface Addon {
  id: string
  name: string
  monthlyPrice: number
  desc: string
}

const ADDONS: Addon[] = [
  { id: 'ADDON_DID', name: 'DID additionnel', monthlyPrice: 7, desc: 'Numero de telephone supplementaire dedie.' },
  { id: 'ADDON_RECORD', name: 'Enregistrement etendu', monthlyPrice: 7, desc: 'Stockage prolonge des enregistrements audio.' },
  { id: 'ADDON_AI', name: 'IA transcription', monthlyPrice: 11, desc: 'Transcription automatique et resume des appels par IA.' },
  { id: 'ADDON_SMS', name: 'SMS bidirectionnel', monthlyPrice: 14, desc: 'Envoi et reception de SMS depuis la plateforme.' },
  { id: 'ADDON_CRM', name: 'Integrations CRM', monthlyPrice: 20, desc: 'Connectez VoxFlow a vos outils CRM existants.' },
]

/* ------------------------------------------------------------------ */
/*  Comparison table data                                              */
/* ------------------------------------------------------------------ */

interface CompRow {
  label: string
  basic: boolean | string
  confort: boolean | string
  premium: boolean | string
  pro: boolean | string
}

interface CompGroup {
  category: string
  rows: CompRow[]
}

const COMPARISON: CompGroup[] = [
  {
    category: 'Telephonie',
    rows: [
      { label: 'Appels entrants', basic: true, confort: true, premium: true, pro: true },
      { label: 'Appels sortants CA/US', basic: false, confort: true, premium: true, pro: true },
      { label: 'Appels sortants FR', basic: false, confort: false, premium: true, pro: true },
      { label: 'Appels internationaux', basic: false, confort: false, premium: false, pro: true },
      { label: 'DID inclus', basic: '1', confort: '5', premium: '15', pro: 'Illimite' },
      { label: 'Messagerie vocale', basic: true, confort: true, premium: true, pro: true },
      { label: 'IVR (serveur vocal)', basic: false, confort: true, premium: true, pro: true },
    ],
  },
  {
    category: 'CRM',
    rows: [
      { label: 'CRM integre', basic: false, confort: true, premium: true, pro: true },
      { label: 'Click-to-call', basic: false, confort: false, premium: true, pro: true },
      { label: 'Historique appels', basic: true, confort: true, premium: true, pro: true },
    ],
  },
  {
    category: 'IA',
    rows: [
      { label: 'IA transcription', basic: false, confort: false, premium: true, pro: true },
      { label: 'Resume automatique', basic: false, confort: false, premium: true, pro: true },
      { label: 'Analyse sentiments', basic: false, confort: false, premium: false, pro: true },
    ],
  },
  {
    category: 'Reporting',
    rows: [
      { label: 'Analytics tableau de bord', basic: false, confort: false, premium: true, pro: true },
      { label: 'Supervision en direct', basic: false, confort: true, premium: true, pro: true },
      { label: 'Enregistrement appels', basic: false, confort: false, premium: true, pro: true },
      { label: 'Rapports exportables', basic: false, confort: false, premium: true, pro: true },
    ],
  },
  {
    category: 'Avance',
    rows: [
      { label: 'API REST', basic: false, confort: false, premium: false, pro: true },
      { label: 'Webhooks', basic: false, confort: false, premium: false, pro: true },
      { label: 'Workflow builder', basic: false, confort: false, premium: false, pro: true },
      { label: 'SLA 99.9%', basic: false, confort: false, premium: false, pro: true },
      { label: 'Support prioritaire', basic: false, confort: false, premium: false, pro: true },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */

const FAQ = [
  { q: 'Puis-je annuler a tout moment ?', a: 'Oui, vous pouvez annuler votre abonnement a tout moment sans frais de resiliation. Votre acces reste actif jusqu\'a la fin de la periode facturee.' },
  { q: 'La carte de credit est-elle requise pour l\'essai ?', a: 'Non, l\'essai gratuit de 14 jours ne necessite aucune carte de credit. Vous pouvez explorer toutes les fonctionnalites sans engagement.' },
  { q: 'Comment changer de plan ?', a: 'Depuis votre portail client, rendez-vous dans Forfaits et selectionnez le plan souhaite. Le changement prend effet immediatement.' },
  { q: 'Comment fonctionne le prorata ?', a: 'Le montant est calcule au jour pres. Si vous changez de plan en cours de mois, vous ne payez que la difference pour les jours restants.' },
  { q: 'Puis-je combiner plusieurs services ?', a: 'Oui, vous pouvez combiner telephonie, predictive dialer et robot d\'appel selon vos besoins. Chaque service est facture separement.' },
  { q: 'Y a-t-il des frais d\'installation ?', a: 'Non, aucun frais d\'installation. Votre compte est operationnel en quelques minutes apres l\'inscription.' },
  { q: 'L\'API est-elle disponible ?', a: 'Oui, l\'API REST complete est disponible avec le plan Pro. Elle vous permet d\'integrer VoxFlow a vos systemes existants.' },
  { q: 'Quel support est inclus ?', a: 'Tous les plans incluent le support par email et chat. Le plan Pro beneficie d\'un support prioritaire avec temps de reponse garanti.' },
]

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

// ── API helper for tarifs ─────────────────────────────────
function useApiPublic() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  return async (path: string) => {
    const r = await fetch(getUrl() + path, { headers: { 'Content-Type': 'application/json' } })
    return r.json()
  }
}

function fmtCentsT(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')
}

function TelcoCards({ annual }: { annual: boolean }) {
  const api = useApiPublic()
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    api('/api/v1/billing/telephony/plans').then(r => {
      if (r.success) setPlans(r.data || [])
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getPrice = (p: any): number => {
    if (annual && p.price_yearly) return Math.round(p.price_yearly / 12)
    return p.price_monthly
  }

  if (plans.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
      {plans.map((p: any) => (
        <div
          key={p.plan_code}
          style={{
            background: CARD_BG,
            border: p.popular ? `2px solid ${PURPLE}` : `1px solid ${CARD_BORDER}`,
            borderRadius: '16px',
            padding: '2rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {p.popular && (
            <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '3px 14px', borderRadius: '20px' }}>Populaire</span>
          )}

          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>{p.name}</h3>

          <div style={{ marginBottom: '1.2rem' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800 }}>{fmtCentsT(getPrice(p))}</span>
            <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}> CAD$/mois</span>
            {annual && p.price_yearly && (
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>facture {fmtCentsT(p.price_yearly)} CAD$/an</div>
            )}
          </div>

          {/* Destinations */}
          {p.destinations && p.destinations.length > 0 ? (
            <div style={{ padding: '10px 12px', background: '#111128', borderRadius: 8, border: `1px solid ${CARD_BORDER}`, marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#8888a8', fontWeight: 600, marginBottom: 6 }}>Appels sortants illimites vers:</div>
              {p.destinations.map((d: string, i: number) => (
                <div key={i} style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: 2 }}>{d.replace(' fixes et mobiles', '')}</div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '10px 12px', background: '#111128', borderRadius: 8, border: `1px solid ${CARD_BORDER}`, marginBottom: '1.2rem', fontSize: '0.82rem', color: '#8888a8' }}>
              Appels sortants: tarif a la minute
            </div>
          )}

          <div style={{ flex: 1 }} />

          <Link
            href={`/commander?service=telephony&plan=${p.plan_code}`}
            style={{
              display: 'block', textAlign: 'center',
              background: p.popular ? PURPLE : 'transparent',
              color: '#fff',
              border: p.popular ? 'none' : `1px solid ${CARD_BORDER}`,
              borderRadius: '10px', padding: '0.7rem 1rem',
              textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
              transition: 'all .2s',
            }}
          >
            Commencer l&apos;essai gratuit
          </Link>
          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#475569', marginTop: 6 }}>
            14 jours gratuits · Sans carte de credit requise
          </div>
        </div>
      ))}
    </div>
  )
}

function DIDPricingTable() {
  const api = useApiPublic()
  const [countries, setCountries] = useState<any[]>([])

  useEffect(() => {
    api('/api/v1/telephony/did/countries').then(r => {
      if (r.success) setCountries(r.data || [])
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (countries.length === 0) return null

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
            {['Pays', 'Type', 'Prix CAD$/mois', 'Provisionnement', 'Documents'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '0.6rem 1rem', color: '#64748b', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {countries.map((c: any, i: number) => (
            <tr key={i} style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
              <td style={{ padding: '0.6rem 1rem', color: '#e2e8f0' }}>{c.flag} {c.countryName}</td>
              <td style={{ padding: '0.6rem 1rem', color: '#94a3b8' }}>{(c.types || []).join(', ')}</td>
              <td style={{ padding: '0.6rem 1rem', color: PURPLE, fontWeight: 700 }}>{c.minPrice} CAD$</td>
              <td style={{ padding: '0.6rem 1rem', color: '#94a3b8' }}>{c.provisioningTime}</td>
              <td style={{ padding: '0.6rem 1rem', color: '#94a3b8' }}>{c.requiresDocuments ? 'Oui' : 'Non'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DialerCards({ annual }: { annual: boolean }) {
  const api = useApiPublic()
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    api('/api/v1/billing/dialer/plans').then(r => { if (r.success) setPlans(r.data || []) }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getPrice = (p: any): number => annual && p.price_yearly ? Math.round(p.price_yearly / 12) : p.price_monthly

  if (plans.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
      {plans.map((p: any) => (
        <div key={p.plan_code} style={{ background: CARD_BG, border: p.popular ? `2px solid ${PURPLE}` : `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {p.popular && <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '3px 14px', borderRadius: '20px' }}>Populaire</span>}
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.3rem' }}>{p.name}</h3>
          <div style={{ marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{fmtCentsT(getPrice(p))}</span>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}> CAD$/agent/mois</span>
            {annual && p.price_yearly && <div style={{ color: '#64748b', fontSize: '0.78rem' }}>facture {fmtCentsT(p.price_yearly)} CAD$/an</div>}
          </div>
          {p.destinations && p.destinations.length > 0 && (
            <div style={{ padding: '10px 12px', background: '#111128', borderRadius: 8, border: `1px solid ${CARD_BORDER}`, marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#8888a8', fontWeight: 600, marginBottom: 6 }}>Appels illimites vers:</div>
              {p.destinations.map((d: string, i: number) => <div key={i} style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: 2 }}>{d.replace(' fixes et mobiles', '')}</div>)}
            </div>
          )}
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1rem' }}>{p.max_concurrent_calls} appels simultanes — {p.max_lines_per_agent} lignes/agent</div>
          <div style={{ flex: 1 }} />
          <Link href={`/commander?service=dialer&plan=${p.plan_code}`} style={{ display: 'block', textAlign: 'center', background: p.popular ? PURPLE : 'transparent', color: '#fff', border: p.popular ? 'none' : `1px solid ${CARD_BORDER}`, borderRadius: '10px', padding: '0.7rem 1rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Commencer l&apos;essai gratuit</Link>
          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#475569', marginTop: 6 }}>14 jours gratuits · Sans carte requise</div>
        </div>
      ))}
    </div>
  )
}

function RobotCards({ annual }: { annual: boolean }) {
  const api = useApiPublic()
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    api('/api/v1/billing/robot/plans').then(r => {
      if (r.success) setPlans(r.data || [])
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getPrice = (p: any): number => {
    if (annual && p.price_yearly) return Math.round(p.price_yearly / 12)
    return p.price_monthly
  }

  if (plans.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
      {plans.map((p: any) => (
        <div key={p.plan_code} style={{ background: CARD_BG, border: p.popular ? `2px solid ${PURPLE}` : `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {p.popular && <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '3px 14px', borderRadius: '20px' }}>Populaire</span>}
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.3rem' }}>{p.name}</h3>
          <div style={{ marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{fmtCentsT(getPrice(p))}</span>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}> CAD$/mois</span>
            {annual && p.price_yearly && <div style={{ color: '#64748b', fontSize: '0.78rem' }}>facture {fmtCentsT(p.price_yearly)} CAD$/an</div>}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PURPLE, marginBottom: '0.8rem' }}>{p.minutes_included} minutes incluses</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1rem' }}>{p.max_concurrent_calls} simultanes — Surplus: {p.overage_rate.toFixed(2)} CAD$/min</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.2rem', flex: 1 }}>
            {(p.features || []).slice(0, 6).map((f: string, i: number) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                <span style={{ color: GREEN, fontWeight: 700 }}>{'\u2713'}</span> {f}
              </li>
            ))}
          </ul>
          <Link href={`/commander?service=robot&plan=${p.plan_code}`} style={{ display: 'block', textAlign: 'center', background: p.popular ? PURPLE : 'transparent', color: '#fff', border: p.popular ? 'none' : `1px solid ${CARD_BORDER}`, borderRadius: '10px', padding: '0.7rem 1rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
            Commencer l&apos;essai gratuit
          </Link>
        </div>
      ))}
    </div>
  )
}

function AddonCards({ annual }: { annual: boolean }) {
  const api = useApiPublic()
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    api('/api/v1/billing/addons/plans').then(r => {
      if (r.success) setPlans(r.data || [])
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getPrice = (p: any): number => {
    if (annual && p.price_yearly) return Math.round(p.price_yearly / 12)
    return p.price_monthly
  }

  if (plans.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
      {plans.map((p: any) => {
        const isPerOrg = p.module_type === 'sms'
        return (
          <div key={p.plan_code} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '1.8rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.3rem' }}>{p.name}</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{p.description}</p>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fmtCentsT(getPrice(p))}</span>
              <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}> CAD$/{isPerOrg ? 'mois' : 'agent/mois'}</span>
              {annual && p.price_yearly && <div style={{ color: '#64748b', fontSize: '0.78rem' }}>facture {fmtCentsT(p.price_yearly)} CAD$/an</div>}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.2rem', flex: 1 }}>
              {(p.features || []).map((f: string, i: number) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                  <span style={{ color: GREEN, fontWeight: 700 }}>{'\u2713'}</span> {f}
                </li>
              ))}
            </ul>
            {p.module_type === 'sms' && (
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.8rem' }}>1000 SMS inclus — surplus 0,018 CAD$/SMS</div>
            )}
            {p.module_type === 'ia_coaching' && (
              <div style={{ fontSize: '0.75rem', color: PURPLE, marginBottom: '0.8rem' }}>Inclut tout IA Basique</div>
            )}
            <Link href={`/commander?service=addons&modules=${p.module_type}`} style={{ display: 'block', textAlign: 'center', background: 'transparent', color: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: '10px', padding: '0.65rem 1rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem', transition: 'all .2s' }}>
              Ajouter ce module
            </Link>
          </div>
        )
      })}
    </div>
  )
}

export default function TarifsPage() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const price = (monthly: number, annualMonthly: number) =>
    annual ? annualMonthly.toFixed(2) : monthly.toFixed(0)

  /* ---- shared inline styles ---- */
  const sectionTitle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
    textAlign: 'center',
    marginBottom: '0.5rem',
  }

  const sectionSub: React.CSSProperties = {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: '2.5rem',
    fontSize: '1.05rem',
  }

  return (
    <div style={{ background: BG, color: '#fff', fontFamily: FONT, height: '100vh', overflowY: 'auto' }}>
      {/* ============================================================ */}
      {/*  NAV                                                          */}
      {/* ============================================================ */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 2.5rem',
          background: 'transparent',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Link href="/tarifs" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Vox</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: PURPLE }}>Flow</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="#fonctionnalites" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.95rem' }}>
            Fonctionnalites
          </Link>
          <Link href="/tarifs" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 600 }}>
            Tarifs
          </Link>
          <Link href="#contact" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: '0.95rem' }}>
            Contact
          </Link>

          <Link
            href="/login"
            style={{
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '8px',
              padding: '0.45rem 1.2rem',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            Connexion
          </Link>
          <Link
            href="/commander"
            style={{
              background: PURPLE,
              color: '#fff',
              borderRadius: '8px',
              padding: '0.5rem 1.3rem',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
            }}
          >
            Essai gratuit
          </Link>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  HERO + TOGGLE                                                */}
      {/* ============================================================ */}
      <section style={{ textAlign: 'center', padding: '3.5rem 1rem 1rem' }}>
        <h1 style={{ fontSize: '2.8rem', fontWeight: 800, marginBottom: '0.6rem' }}>
          Tarifs simples, <span style={{ color: PURPLE }}>sans surprise</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.15rem', maxWidth: 600, margin: '0 auto 2.5rem' }}>
          Choisissez le plan adapte a vos besoins. Essai gratuit 14 jours, aucune carte requise.
        </p>

        {/* Toggle */}
        <div
          style={{
            display: 'inline-flex',
            background: '#161625',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setAnnual(false)}
            style={{
              padding: '0.55rem 1.6rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              fontFamily: FONT,
              background: !annual ? PURPLE : 'transparent',
              color: !annual ? '#fff' : '#94a3b8',
              transition: 'all .2s',
            }}
          >
            Mensuel
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              padding: '0.55rem 1.6rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              fontFamily: FONT,
              background: annual ? PURPLE : 'transparent',
              color: annual ? '#fff' : '#94a3b8',
              transition: 'all .2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            Annuel
            <span
              style={{
                background: GREEN,
                color: '#000',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              Economisez 2 mois
            </span>
          </button>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  INCLUS DANS TOUS LES FORFAITS                                */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>Inclus dans tous les forfaits telephonie</h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>La seule difference entre les plans est la destination des appels sortants illimites.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Tableau de bord live','Mes lignes et numeros','Journal d\'appels','Enregistrements','Statistiques','IVR et Standard vocal','Files d\'attente ACD','Messagerie vocale','Supervision live','Ecoute et Soufflage','CRM integre','Prospects et calendrier','Modeles et devis','Applications et integrations','Dialer web et app','Parc telephonique'].map(f => (
            <span key={f} style={{ padding: '5px 12px', borderRadius: 8, background: '#1a1a2e', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>{f}</span>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TELEPHONIE — 4 plans destinations                            */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 3rem' }}>
        <h2 style={sectionTitle}>Telephonie d&apos;entreprise</h2>
        <p style={sectionSub}>Appels illimites selon votre destination</p>

        <TelcoCards annual={annual} />
      </section>

      {/* ============================================================ */}
      {/*  DIALER                                                       */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Predictive Dialer</h2>
        <p style={sectionSub}>Decuplez la productivite de vos agents. Jusqu&apos;a 10x plus d&apos;appels par agent.</p>
        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748b', marginBottom: 16 }}>Service independant de la telephonie d&apos;entreprise.</p>

        <DialerCards annual={annual} />
      </section>

      {/* ============================================================ */}
      {/*  ROBOT                                                        */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Robot d&apos;appel masse</h2>
        <p style={sectionSub}>Envoyez des milliers d&apos;appels automatises. Payez ce que vous utilisez.</p>

        <RobotCards annual={annual} />

        {/* Credits */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Sans abonnement — credits a la carte</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', maxWidth: 800, margin: '0 auto' }}>
            {[{ min: 1000, price: 29 }, { min: 5000, price: 120 }, { min: 15000, price: 300 }, { min: 50000, price: 850 }].map(c => (
              <div key={c.min} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: '1.2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{c.min.toLocaleString()}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>minutes</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: PURPLE }}>{c.price} CAD$</div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 4 }}>~ {c.min * 2} appels 30s</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 12 }}>Minutes incluses renouvelees chaque mois. Credits valables 12 mois. Surplus facture en fin de mois.</div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  MODULES ADDITIONNELS                                         */}
      {/* ============================================================ */}
      <section id="modules" style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Modules additionnels</h2>
        <p style={sectionSub}>Personnalisez votre plateforme. Activez uniquement ce dont vous avez besoin. S&apos;ajoutent a votre forfait telephonie.</p>

        <AddonCards annual={annual} />
      </section>

      {/* ============================================================ */}
      {/*  DID NUMBERS                                                  */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Numeros de telephone DID</h2>
        <p style={sectionSub}>Obtenez un numero local dans 15+ pays. 1 numero inclus gratuit avec tout forfait telephonie.</p>

        <DIDPricingTable />

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 12 }}>La portabilite de numero existant est disponible gratuitement. Delai: 7-14 jours.</p>
          <Link href="/client/numbers/commander" style={{ display: 'inline-block', background: PURPLE, color: '#fff', borderRadius: 10, padding: '0.65rem 1.8rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
            Commander un numero
          </Link>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  COMPARISON TABLE                                             */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Comparaison detaillee</h2>
        <p style={sectionSub}>Trouvez le plan qui correspond a vos besoins</p>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
              minWidth: 700,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.8rem 1rem', color: '#94a3b8', fontWeight: 600, borderBottom: `1px solid ${CARD_BORDER}` }}>
                  Fonctionnalite
                </th>
                {['Basic', 'Confort', 'Premium', 'Pro'].map((name) => (
                  <th
                    key={name}
                    style={{
                      textAlign: 'center',
                      padding: '0.8rem 1rem',
                      fontWeight: 700,
                      color: '#fff',
                      borderBottom: `1px solid ${CARD_BORDER}`,
                      background: name === 'Premium' ? 'rgba(123,97,255,0.08)' : 'transparent',
                    }}
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((group) => (
                <>
                  <tr key={`cat-${group.category}`}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '1rem 1rem 0.5rem',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: PURPLE,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: `1px solid ${CARD_BORDER}`,
                      }}
                    >
                      {group.category}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label}>
                      <td style={{ padding: '0.6rem 1rem', color: '#cbd5e1', borderBottom: `1px solid ${CARD_BORDER}` }}>
                        {row.label}
                      </td>
                      {(['basic', 'confort', 'premium', 'pro'] as const).map((col) => {
                        const val = row[col]
                        const isPremium = col === 'premium'
                        let display: React.ReactNode
                        if (typeof val === 'boolean') {
                          display = val ? (
                            <span style={{ color: GREEN, fontWeight: 700 }}>{'\u2713'}</span>
                          ) : (
                            <span style={{ color: '#475569' }}>{'\u2717'}</span>
                          )
                        } else {
                          display = <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{val}</span>
                        }
                        return (
                          <td
                            key={col}
                            style={{
                              textAlign: 'center',
                              padding: '0.6rem 1rem',
                              borderBottom: `1px solid ${CARD_BORDER}`,
                              background: isPremium ? 'rgba(123,97,255,0.08)' : 'transparent',
                            }}
                          >
                            {display}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FAQ                                                          */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <h2 style={sectionTitle}>Questions frequentes</h2>
        <p style={sectionSub}>Tout ce que vous devez savoir</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {FAQ.map((item, i) => (
            <div
              key={i}
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.2rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: FONT,
                }}
              >
                {item.q}
                <span
                  style={{
                    transition: 'transform .2s',
                    transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    fontSize: '1.2rem',
                    color: '#94a3b8',
                    flexShrink: 0,
                    marginLeft: '1rem',
                  }}
                >
                  {'\u25BE'}
                </span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 1.2rem 1rem', color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER NOTE                                                  */}
      {/* ============================================================ */}
      <footer
        style={{
          textAlign: 'center',
          padding: '2rem 1rem 3rem',
          borderTop: `1px solid ${CARD_BORDER}`,
          color: '#64748b',
          fontSize: '0.85rem',
        }}
      >
        Prix en dollars canadiens CAD$, taxes en sus.
      </footer>
    </div>
  )
}
