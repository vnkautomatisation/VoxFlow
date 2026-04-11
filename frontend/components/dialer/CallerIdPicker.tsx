'use client'
import { useState, useRef, useEffect } from 'react'

// ══════════════════════════════════════════════════════════════
//  CallerIdPicker — sélecteur de numéro sortant
//
//  Affichage pro style Kavkom :
//   - Bouton compact montrant drapeau SVG + indicatif + numéro formaté
//   - Dropdown custom (pas <select> natif) avec liste groupée par pays
//   - État vide élégant si aucun numéro
//   - Click-outside pour fermer
//
//  Props:
//   - numbers: liste retournée par /api/v1/telephony/my-numbers
//   - value:   numéro E.164 actuellement sélectionné
//   - onChange: handler de changement
// ══════════════════════════════════════════════════════════════

export interface CallerNumber {
  number:       string
  friendly_name?: string
  twilio_sid?:  string
  country_code: string
  country_name: string
  flag?:        string
  source?:      'twilio' | 'simulated' | 'db'
}

// Flags SVG inline (pas d'emoji — rendu garanti sur tous les OS)
// Couleurs officielles simplifiées, viewBox 3:2
const FlagSvg = ({ country, size = 18 }: { country: string; size?: number }) => {
  const w = size, h = Math.round(size * 2 / 3)
  const code = (country || '').toUpperCase().replace('CA_US', 'CA')
  switch (code) {
    case 'CA':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#fff"/>
          <rect width="10" height="20" x="0"  fill="#d52b1e"/>
          <rect width="10" height="20" x="20" fill="#d52b1e"/>
          <path d="M15 6 L15.8 8.5 L18.5 8 L16.8 10 L18.5 12 L15.8 11.5 L15 14 L14.2 11.5 L11.5 12 L13.2 10 L11.5 8 L14.2 8.5 Z" fill="#d52b1e"/>
        </svg>
      )
    case 'US':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#fff"/>
          {[0,2,4,6,8,10,12].map(i => <rect key={i} width="30" height="1.54" y={i*1.54} fill="#b22234"/>)}
          <rect width="12" height="10.77" fill="#3c3b6e"/>
        </svg>
      )
    case 'FR':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="10" height="20" x="0"  fill="#0055a4"/>
          <rect width="10" height="20" x="10" fill="#fff"/>
          <rect width="10" height="20" x="20" fill="#ef4135"/>
        </svg>
      )
    case 'BE':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="10" height="20" x="0"  fill="#000"/>
          <rect width="10" height="20" x="10" fill="#fae042"/>
          <rect width="10" height="20" x="20" fill="#ed2939"/>
        </svg>
      )
    case 'CH':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#ff0000"/>
          <rect x="12" y="4"  width="6"  height="12" fill="#fff"/>
          <rect x="9"  y="7" width="12" height="6"  fill="#fff"/>
        </svg>
      )
    case 'GB':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#012169"/>
          <path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="4"/>
          <path d="M0 0 L30 20 M30 0 L0 20" stroke="#c8102e" strokeWidth="2"/>
          <path d="M15 0 V20 M0 10 H30" stroke="#fff" strokeWidth="5"/>
          <path d="M15 0 V20 M0 10 H30" stroke="#c8102e" strokeWidth="3"/>
        </svg>
      )
    case 'DE':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="6.67" y="0"     fill="#000"/>
          <rect width="30" height="6.67" y="6.67"  fill="#dd0000"/>
          <rect width="30" height="6.67" y="13.33" fill="#ffce00"/>
        </svg>
      )
    case 'ES':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#aa151b"/>
          <rect width="30" height="10" y="5" fill="#f1bf00"/>
        </svg>
      )
    case 'IT':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="10" height="20" x="0"  fill="#009246"/>
          <rect width="10" height="20" x="10" fill="#fff"/>
          <rect width="10" height="20" x="20" fill="#ce2b37"/>
        </svg>
      )
    case 'NL':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="6.67" y="0"     fill="#ae1c28"/>
          <rect width="30" height="6.67" y="6.67"  fill="#fff"/>
          <rect width="30" height="6.67" y="13.33" fill="#21468b"/>
        </svg>
      )
    case 'PT':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#ff0000"/>
          <rect width="12" height="20" fill="#006600"/>
          <circle cx="12" cy="10" r="3" fill="#ffcc00" stroke="#000" strokeWidth="0.3"/>
        </svg>
      )
    case 'LU':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="6.67" y="0"     fill="#ed2939"/>
          <rect width="30" height="6.67" y="6.67"  fill="#fff"/>
          <rect width="30" height="6.67" y="13.33" fill="#00a1de"/>
        </svg>
      )
    case 'MX':
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="10" height="20" x="0"  fill="#006847"/>
          <rect width="10" height="20" x="10" fill="#fff"/>
          <rect width="10" height="20" x="20" fill="#ce1126"/>
        </svg>
      )
    default:
      // Drapeau générique : globe outlined
      return (
        <svg width={w} height={h} viewBox="0 0 30 20">
          <rect width="30" height="20" fill="#1f1f2a" stroke="#2e2e44"/>
          <circle cx="15" cy="10" r="6" fill="none" stroke="#7b61ff" strokeWidth="1"/>
          <line x1="9" y1="10" x2="21" y2="10" stroke="#7b61ff" strokeWidth="1"/>
          <ellipse cx="15" cy="10" rx="3" ry="6" fill="none" stroke="#7b61ff" strokeWidth="1"/>
        </svg>
      )
  }
}

// Formattage pro du numéro E.164 : +1 (514) 555-1234
function formatNumber(num: string): { dial: string; local: string } {
  const digits = (num || '').replace(/\D/g, '')
  // USA/Canada 11 chiffres avec +1
  if (digits.length === 11 && digits.startsWith('1')) {
    return {
      dial:  '+1',
      local: `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`,
    }
  }
  // France +33 suivi de 9 chiffres
  if (digits.length === 11 && digits.startsWith('33')) {
    return {
      dial:  '+33',
      local: digits.slice(2).match(/.{1,2}/g)?.join(' ') || digits.slice(2),
    }
  }
  // Belgique +32
  if (digits.length === 11 && digits.startsWith('32')) {
    return { dial: '+32', local: digits.slice(2) }
  }
  // Autres : affichage brut avec + si manquant
  return {
    dial:  num.startsWith('+') ? num.split(' ')[0].slice(0, 4) : '',
    local: num,
  }
}

export default function CallerIdPicker({
  numbers,
  value,
  onChange,
}: {
  numbers: CallerNumber[]
  value: string
  onChange: (num: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside pour fermer
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // État vide : aucun numéro assigné
  if (!numbers || numbers.length === 0) {
    return (
      <div className="cid-empty">
        <div className="cid-empty-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div className="cid-empty-text">
          <div className="cid-empty-title">Aucun numéro assigné</div>
          <div className="cid-empty-sub">Demandez à l'admin de vous en attribuer un</div>
        </div>
      </div>
    )
  }

  const selected = numbers.find(n => n.number === value) || numbers[0]
  const fmt = formatNumber(selected.number)

  // Grouper par pays pour la liste
  const byCountry: Record<string, CallerNumber[]> = {}
  numbers.forEach(n => {
    if (!byCountry[n.country_code]) byCountry[n.country_code] = []
    byCountry[n.country_code].push(n)
  })
  const countries = Object.keys(byCountry).sort()

  return (
    <div className="cid-wrap" ref={containerRef}>
      <div className="cid-label">Appeler depuis</div>
      <button
        type="button"
        className={`cid-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="cid-flag">
          <FlagSvg country={selected.country_code} />
        </div>
        <div className="cid-info">
          <div className="cid-number">
            <span className="cid-dial">{fmt.dial}</span>
            <span className="cid-local">{fmt.local}</span>
          </div>
          <div className="cid-country">
            {selected.country_name}
            {numbers.length > 1 && <span className="cid-count"> · {numbers.length} numéros</span>}
          </div>
        </div>
        {numbers.length > 1 && (
          <svg className={`cid-chev ${open ? 'on' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {open && numbers.length > 1 && (
        <div className="cid-drop">
          {countries.map(cc => (
            <div key={cc} className="cid-group">
              <div className="cid-group-label">
                <FlagSvg country={cc} size={13}/>
                <span>{byCountry[cc][0].country_name}</span>
                <span className="cid-group-count">{byCountry[cc].length}</span>
              </div>
              {byCountry[cc].map(n => {
                const f = formatNumber(n.number)
                const active = n.number === value
                return (
                  <button
                    key={n.number}
                    type="button"
                    className={`cid-item ${active ? 'active' : ''}`}
                    onClick={() => { onChange(n.number); setOpen(false) }}
                  >
                    <div className="cid-item-num">
                      <span className="cid-dial">{f.dial}</span>
                      <span className="cid-local">{f.local}</span>
                    </div>
                    {n.friendly_name && n.friendly_name !== n.number && (
                      <div className="cid-item-friendly">{n.friendly_name}</div>
                    )}
                    {active && (
                      <svg className="cid-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
