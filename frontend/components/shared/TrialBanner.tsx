'use client'
import { useRouter } from 'next/navigation'
import { useFeatures } from '@/hooks/useFeatures'
import { useAuthStore } from '@/store/authStore'

/**
 * TrialBanner — bannière affichée en haut des layouts quand l'org est
 * en période d'essai. 4 états selon days_left :
 *
 *   > 7 jours  : bannière violet douce (info)
 *   <= 7 jours : bannière amber (warning)
 *   <= 1 jour  : bannière rouge urgente
 *   expiré     : bannière rouge bloquante + CTA "Choisir un forfait"
 *
 * Exempté pour OWNER et OWNER_STAFF (staff VNK n'a pas de trial).
 *
 * Variant "compact" pour le dialer (moins haut, moins verbeux).
 */
export default function TrialBanner({
  variant = 'full',
}: {
  variant?: 'full' | 'compact'
}) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { trial, trialDaysLeft, isTrialExpired, planName } = useFeatures()

  // OWNER/OWNER_STAFF bypass
  if (user?.role === 'OWNER' || user?.role === 'OWNER_STAFF') return null
  if (!trial) return null

  const days = trialDaysLeft ?? 0

  // Déterminer l'état visuel
  let tone: 'info' | 'warning' | 'urgent' | 'expired' = 'info'
  if (isTrialExpired) tone = 'expired'
  else if (days <= 1) tone = 'urgent'
  else if (days <= 7) tone = 'warning'

  // Palette par tone
  const palette = {
    info:    { bg: 'rgba(123,97,255,.08)', border: 'rgba(123,97,255,.25)', text: '#c0b2ff', icon: '#7b61ff' },
    warning: { bg: 'rgba(255,181,71,.10)', border: 'rgba(255,181,71,.35)', text: '#ffd088', icon: '#ffb547' },
    urgent:  { bg: 'rgba(255,77,109,.12)', border: 'rgba(255,77,109,.4)',  text: '#ffb0bf', icon: '#ff4d6d' },
    expired: { bg: 'rgba(255,77,109,.18)', border: 'rgba(255,77,109,.6)',  text: '#ffffff', icon: '#ff4d6d' },
  }[tone]

  const goToPlans = () => router.push('/client/plans')

  if (variant === 'compact') {
    // Version compacte pour le dialer (petite barre au-dessus du header)
    return (
      <div style={{
        background:     palette.bg,
        borderBottom:   `1px solid ${palette.border}`,
        color:          palette.text,
        padding:        '6px 12px',
        fontSize:       '10px',
        fontWeight:     700,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            8,
        fontFamily:     "'DM Sans', system-ui, sans-serif",
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={palette.icon} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {tone === 'expired'
            ? 'ESSAI EXPIRÉ'
            : `ESSAI · ${days}J RESTANT${days > 1 ? 'S' : ''}`}
        </span>
        <button
          onClick={goToPlans}
          style={{
            background: 'transparent',
            border:     `1px solid ${palette.border}`,
            color:      palette.text,
            padding:    '3px 9px',
            borderRadius: '5px',
            fontSize:   '9px',
            fontWeight: 700,
            cursor:     'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Forfaits
        </button>
      </div>
    )
  }

  // Variant "full" — bannière classique en haut du layout
  const message = {
    info:    `Essai gratuit · ${days} jours restants sur votre forfait ${planName || ''}`,
    warning: `Plus que ${days} jours d'essai · Pensez à choisir un forfait`,
    urgent:  days === 0 ? 'Dernier jour d\'essai' : `Dernier jour d'essai — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`,
    expired: 'Essai expiré · Choisissez un forfait pour continuer à utiliser VoxFlow',
  }[tone]

  const ctaLabel = tone === 'expired' ? 'Choisir un forfait' : 'Voir les forfaits'

  return (
    <div style={{
      background:     palette.bg,
      border:         `1px solid ${palette.border}`,
      color:          palette.text,
      padding:        '10px 16px',
      fontSize:       '13px',
      fontWeight:     600,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      gap:            12,
      margin:         '12px 16px 0',
      borderRadius:   '10px',
      fontFamily:     "'DM Sans', system-ui, sans-serif",
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={palette.icon} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message}
        </span>
      </span>
      <button
        onClick={goToPlans}
        style={{
          background:    tone === 'expired' ? palette.icon : 'transparent',
          border:        `1px solid ${palette.icon}`,
          color:         tone === 'expired' ? '#fff' : palette.text,
          padding:       '6px 14px',
          borderRadius:  '8px',
          fontSize:      '12px',
          fontWeight:    700,
          cursor:        'pointer',
          whiteSpace:    'nowrap',
          flexShrink:    0,
          transition:    'transform 0.1s',
        }}
      >
        {ctaLabel} →
      </button>
    </div>
  )
}
