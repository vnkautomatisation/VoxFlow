'use client'

import { useState } from 'react'
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
      {/*  TELEPHONIE                                                   */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Telephonie d&apos;entreprise</h2>
        <p style={sectionSub}>Solutions cloud pour toutes les tailles d&apos;equipe</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {TEL_PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: CARD_BG,
                border: plan.popular ? `2px solid ${PURPLE}` : `1px solid ${CARD_BORDER}`,
                borderRadius: '16px',
                padding: '2rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {plan.popular && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: PURPLE,
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 14px',
                    borderRadius: '20px',
                  }}
                >
                  Populaire
                </span>
              )}

              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>{plan.name}</h3>

              <div style={{ marginBottom: '1.2rem' }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 800 }}>
                  {price(plan.monthlyPrice, plan.annualMonthly)}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}> CAD$/mois</span>
                <div style={{ color: '#64748b', fontSize: '0.8rem' }}>/utilisateur/mois</div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', flex: 1 }}>
                {plan.features.map((f, i) => {
                  const included = f.included !== false
                  return (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.3rem 0',
                        fontSize: '0.88rem',
                        color: included ? '#cbd5e1' : '#475569',
                      }}
                    >
                      <span style={{ color: included ? GREEN : '#475569', fontWeight: 700, fontSize: '0.95rem' }}>
                        {included ? '\u2713' : '\u2717'}
                      </span>
                      {typeof f.included === 'string' ? `${f.label}: ${f.included}` : f.label}
                    </li>
                  )
                })}
              </ul>

              <Link
                href={`/commander?service=telephony&plan=${plan.id}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: plan.popular ? PURPLE : 'transparent',
                  color: '#fff',
                  border: plan.popular ? 'none' : `1px solid ${CARD_BORDER}`,
                  borderRadius: '10px',
                  padding: '0.7rem 1rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: 'all .2s',
                }}
              >
                Commencer l&apos;essai gratuit
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  DIALER                                                       */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Predictive Dialer</h2>
        <p style={sectionSub}>Composeur predictif pour maximiser le volume d&apos;appels sortants</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', maxWidth: 700, margin: '0 auto' }}>
          {DIALER_PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px',
                padding: '2rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{plan.name}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1rem', flex: 1 }}>{plan.desc}</p>
              <div style={{ marginBottom: '1.2rem' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>
                  {price(plan.monthlyPrice, plan.annualMonthly)}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}> CAD$/mois</span>
              </div>
              <Link
                href={`/commander?service=dialer&plan=${plan.id}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'transparent',
                  color: '#fff',
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: '10px',
                  padding: '0.7rem 1rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Commencer l&apos;essai gratuit
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  ROBOT                                                        */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Robot d&apos;appel</h2>
        <p style={sectionSub}>Automatisation vocale pour vos campagnes a grande echelle</p>

        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            maxWidth: 600,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>{ROBOT.name}</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '1.2rem' }}>{ROBOT.desc}</p>
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2.6rem', fontWeight: 800 }}>
              {price(ROBOT.monthlyPrice, ROBOT.annualMonthly)}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '1rem' }}> CAD$/mois</span>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>prix fixe, utilisateurs illimites</div>
          </div>
          <Link
            href={`/commander?service=robot&plan=${ROBOT.id}`}
            style={{
              display: 'inline-block',
              background: PURPLE,
              color: '#fff',
              borderRadius: '10px',
              padding: '0.75rem 2rem',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
            }}
          >
            Commencer l&apos;essai gratuit
          </Link>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  ADD-ONS                                                      */}
      {/* ============================================================ */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h2 style={sectionTitle}>Add-ons vendables separement</h2>
        <p style={sectionSub}>Ajoutez des fonctionnalites a la carte</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
          {ADDONS.map((a) => (
            <div
              key={a.id}
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px',
                padding: '1.5rem',
              }}
            >
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.3rem' }}>{a.name}</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{a.desc}</p>
              <div>
                <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{a.monthlyPrice}</span>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}> CAD$/mois</span>
              </div>
            </div>
          ))}
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
