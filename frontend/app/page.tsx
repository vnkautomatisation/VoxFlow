'use client'

import Link from 'next/link'

const purple = '#7b61ff'
const green = '#00d4aa'
const bg = '#080810'
const cardBg = '#0f0f1e'
const cardBorder = '#1e1e3a'
const grayText = '#9a9ab0'

const features = [
  {
    title: 'VoIP professionnel',
    desc: 'Appels HD entrants et sortants, IVR, files d\'attente, supervision en temps reel.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="6" width="24" height="20" rx="3" stroke={purple} strokeWidth="2" />
        <path d="M12 16h8M16 12v8" stroke={purple} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'IA et transcription',
    desc: 'Transcription automatique Whisper, resume post-appel, analyse de sentiment.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="10" stroke={purple} strokeWidth="2" />
        <path d="M12 16l3 3 5-6" stroke={purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Supervision temps reel',
    desc: 'Ecoute, chuchotement, intervention. Wallboard et statistiques live.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 24l6-8 5 4 7-10 6 8" stroke={purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'CRM integre',
    desc: 'Contacts, pipeline, activites, click-to-call. Zero integration requise.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="6" y="4" width="20" height="24" rx="2" stroke={purple} strokeWidth="2" />
        <path d="M11 12h10M11 17h7" stroke={purple} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Robot d\'appel',
    desc: '150k appels/h, TTS dynamique, IVR post-robot. Campagnes automatisees.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="8" y="8" width="16" height="12" rx="2" stroke={purple} strokeWidth="2" />
        <circle cx="13" cy="14" r="1.5" fill={purple} />
        <circle cx="19" cy="14" r="1.5" fill={purple} />
        <path d="M12 24h8M16 20v4" stroke={purple} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Analytics avances',
    desc: 'Tableaux de bord, rapports personnalises, export CSV, KPI agents.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="5" y="18" width="5" height="8" rx="1" fill={purple} opacity="0.5" />
        <rect x="13" y="12" width="5" height="14" rx="1" fill={purple} opacity="0.7" />
        <rect x="21" y="6" width="5" height="20" rx="1" fill={purple} />
      </svg>
    ),
  },
]

const comparisonRows = [
  { label: 'Prix de depart', voxflow: '14 CAD$/mois', kavkom: '40 EUR/mois', aircall: '30 USD/mois' },
  { label: 'Essai sans CB', voxflow: 'Oui', kavkom: 'Non', aircall: 'Non', voxflowGreen: true },
  { label: 'Robot d\'appel', voxflow: 'Inclus', kavkom: 'En supplement', aircall: 'Non disponible' },
  { label: 'IA transcription', voxflow: 'Des Premium', kavkom: 'En supplement', aircall: 'Enterprise seul' },
  { label: 'Support francophone', voxflow: 'Oui', kavkom: 'Oui', aircall: 'Limite', voxflowGreen: true },
  { label: 'Facturation CAD$', voxflow: 'Oui', kavkom: 'Non', aircall: 'Non', voxflowGreen: true },
]

const testimonials = [
  {
    quote: 'VoxFlow a remplace notre ancien systeme en 2 jours. L\'equipe de support est exceptionnelle.',
    name: 'Marie D.',
    role: 'Directrice operations',
    company: 'TechVentures',
  },
  {
    quote: 'Le robot d\'appel nous permet de contacter 50 000 prospects par jour. Incroyable.',
    name: 'Jean-Pierre L.',
    role: 'VP Ventes',
    company: 'Assurance Plus',
  },
  {
    quote: 'Enfin une facturation en dollars canadiens! Plus de frais de conversion.',
    name: 'Sophie R.',
    role: 'CFO',
    company: 'Groupe Altitude',
  },
]

const pricingPlans = [
  { title: 'Telephonie', price: 'A partir de 14 CAD$/mois/user' },
  { title: 'Predictive Dialer', price: 'A partir de 80 CAD$/mois/user' },
  { title: 'Robot d\'appel', price: '135 CAD$/mois flat' },
]

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: bg, color: '#fff', height: '100vh', overflowY: 'auto' }}>
      {/* Google Font */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      {/* ── Header ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: bg,
          borderBottom: `1px solid ${cardBorder}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <Link href="/" style={{ textDecoration: 'none', fontSize: 24, fontWeight: 700 }}>
              <span style={{ color: '#fff' }}>Vox</span>
              <span style={{ color: purple }}>Flow</span>
            </Link>
            <nav style={{ display: 'flex', gap: 24 }}>
              <a href="#features" style={{ color: grayText, textDecoration: 'none', fontSize: 14 }}>
                Fonctionnalites
              </a>
              <Link href="/tarifs" style={{ color: grayText, textDecoration: 'none', fontSize: 14 }}>
                Tarifs
              </Link>
              <a href="mailto:contact@voxflow.ca" style={{ color: grayText, textDecoration: 'none', fontSize: 14 }}>
                Contact
              </a>
            </nav>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link
              href="/login"
              style={{
                padding: '8px 20px',
                border: '1px solid #fff',
                borderRadius: 8,
                color: '#fff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Connexion
            </Link>
            <Link
              href="/commander"
              style={{
                padding: '8px 20px',
                background: purple,
                borderRadius: 8,
                color: '#fff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                border: 'none',
              }}
            >
              Essai gratuit
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '80px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 48,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 55%', minWidth: 320 }}>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: 20,
              color: '#fff',
            }}
          >
            La plateforme call center qui booste votre equipe
          </h1>
          <p style={{ fontSize: 18, color: grayText, marginBottom: 32, lineHeight: 1.6 }}>
            Telephonie VoIP, predictive dialer et robot d&apos;appel. A partir de 14 CAD$/mois.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link
              href="/commander"
              style={{
                padding: '14px 28px',
                background: purple,
                borderRadius: 8,
                color: '#fff',
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 600,
                border: 'none',
              }}
            >
              Essai gratuit 14 jours
            </Link>
            <Link
              href="/tarifs"
              style={{
                padding: '14px 28px',
                border: `1px solid ${purple}`,
                borderRadius: 8,
                color: purple,
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 600,
                background: 'transparent',
              }}
            >
              Voir les tarifs
            </Link>
          </div>
        </div>

        {/* Dialer mockup */}
        <div style={{ flex: '1 1 35%', minWidth: 300, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: 320,
              background: cardBg,
              borderRadius: 16,
              border: `1px solid ${cardBorder}`,
              padding: 24,
              boxShadow: '0 0 60px rgba(123,97,255,0.15)',
            }}
          >
            {/* Top bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 20,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: green }} />
              <span style={{ fontSize: 13, color: green, fontWeight: 500 }}>Appel en cours</span>
            </div>

            {/* Phone number */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#fff',
                textAlign: 'center',
                marginBottom: 8,
                letterSpacing: 1,
              }}
            >
              +1 514 555 1234
            </div>

            {/* Timer */}
            <div style={{ textAlign: 'center', color: grayText, fontSize: 18, marginBottom: 28 }}>
              02:34
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#e53e3e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 10a9 9 0 0118 0M7 10v2a2 2 0 002 2h6a2 2 0 002-2v-2"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="4" width="4" height="16" rx="1" fill="#fff" />
                  <rect x="14" y="4" width="4" height="16" rx="1" fill="#fff" />
                </svg>
              </div>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 17l5-5 5 5M7 7l5 5 5-5"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 48,
            color: '#fff',
          }}
        >
          Tout ce dont votre equipe a besoin
        </h2>
        <style>{`
          .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
          @media (max-width: 900px) {
            .features-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (max-width: 600px) {
            .features-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
        <div className="features-grid">
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 12,
                padding: 28,
              }}
            >
              <div style={{ marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: grayText, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 48,
            color: '#fff',
          }}
        >
          Pourquoi VoxFlow?
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 15,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderBottom: `1px solid ${cardBorder}`,
                    color: grayText,
                    fontWeight: 500,
                  }}
                >
                  Fonctionnalite
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '14px 16px',
                    borderBottom: `1px solid ${cardBorder}`,
                    color: '#fff',
                    fontWeight: 700,
                    background: 'rgba(123,97,255,0.1)',
                  }}
                >
                  VoxFlow
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '14px 16px',
                    borderBottom: `1px solid ${cardBorder}`,
                    color: grayText,
                    fontWeight: 500,
                  }}
                >
                  Kavkom
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '14px 16px',
                    borderBottom: `1px solid ${cardBorder}`,
                    color: grayText,
                    fontWeight: 500,
                  }}
                >
                  Aircall + JustCall
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${cardBorder}`,
                      color: '#fff',
                    }}
                  >
                    {row.label}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${cardBorder}`,
                      textAlign: 'center',
                      fontWeight: 600,
                      color: row.voxflowGreen ? green : '#fff',
                      background: 'rgba(123,97,255,0.1)',
                    }}
                  >
                    {row.voxflow}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${cardBorder}`,
                      textAlign: 'center',
                      color: grayText,
                    }}
                  >
                    {row.kavkom}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${cardBorder}`,
                      textAlign: 'center',
                      color: grayText,
                    }}
                  >
                    {row.aircall}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 48,
            color: '#fff',
          }}
        >
          Ce que nos clients disent
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
          }}
        >
          {testimonials.map((t) => (
            <div
              key={t.name}
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 12,
                padding: 28,
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  color: '#ddd',
                  lineHeight: 1.7,
                  marginBottom: 20,
                  fontStyle: 'italic',
                }}
              >
                &laquo; {t.quote} &raquo;
              </p>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{t.name}</div>
                <div style={{ color: grayText, fontSize: 13 }}>
                  {t.role}, {t.company}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing summary ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 36,
            fontWeight: 700,
            marginBottom: 48,
            color: '#fff',
          }}
        >
          Un plan pour chaque equipe
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            marginBottom: 32,
          }}
        >
          {pricingPlans.map((plan) => (
            <div
              key={plan.title}
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                {plan.title}
              </h3>
              <p style={{ fontSize: 16, color: grayText, marginBottom: 24 }}>{plan.price}</p>
              <Link
                href="/commander"
                style={{
                  display: 'inline-block',
                  padding: '12px 28px',
                  background: purple,
                  borderRadius: 8,
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: 15,
                  fontWeight: 600,
                  border: 'none',
                }}
              >
                Commencer
              </Link>
            </div>
          ))}
        </div>
        <Link
          href="/tarifs"
          style={{
            color: purple,
            textDecoration: 'underline',
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          Voir tous les tarifs
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: `1px solid ${cardBorder}`,
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ color: grayText, fontSize: 14, marginBottom: 16 }}>
            VNK Automatisation Inc. — Prix en CAD$, taxes en sus.
          </p>
          <nav style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Link href="/tarifs" style={{ color: grayText, textDecoration: 'none', fontSize: 13 }}>
              Tarifs
            </Link>
            <a href="mailto:support@voxflow.ca" style={{ color: grayText, textDecoration: 'none', fontSize: 13 }}>
              Support
            </a>
            <Link href="/login" style={{ color: grayText, textDecoration: 'none', fontSize: 13 }}>
              Connexion
            </Link>
            <Link href="/cgv" style={{ color: grayText, textDecoration: 'none', fontSize: 13 }}>
              CGV
            </Link>
            <Link href="/confidentialite" style={{ color: grayText, textDecoration: 'none', fontSize: 13 }}>
              Confidentialite
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
