/**
 * VoxFlowLogo — Composant logo officiel VoxFlow
 *
 * RÉFÉRENCE UNIQUE pour afficher le logo dans l'app.
 * Ne jamais écrire "Vox Flow" ou recréer ce composant ailleurs.
 *
 * Usage:
 *   import { VoxFlowLogo } from '@/components/shared/VoxFlowLogo'
 *   <VoxFlowLogo size="md" />
 *   <VoxFlowLogo size="lg" showIcon />
 *   <VoxFlowLogo size="md" variant="light" />
 */
'use client'
import React from 'react'

interface VoxFlowLogoProps {
  /** sm=16 | md=22 | lg=32 | xl=44 */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** dark=fond sombre (défaut) | light=fond clair | mono=monochrome */
  variant?: 'dark' | 'light' | 'mono'
  /** Afficher l'icône signal à gauche */
  showIcon?: boolean
  style?: React.CSSProperties
  className?: string
}

const SIZES = { sm: 16, md: 22, lg: 32, xl: 44 }

export function VoxFlowLogo({
  size = 'md',
  variant = 'dark',
  showIcon = false,
  style,
  className,
}: VoxFlowLogoProps) {
  const fs   = SIZES[size]
  const vox  = variant === 'light' ? '#6b4fff' : variant === 'mono' ? 'currentColor' : '#7b61ff'
  const flow = variant === 'light' ? '#009d80' : variant === 'mono' ? 'currentColor' : '#00d4aa'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showIcon ? Math.round(fs * 0.35) : 0,
        lineHeight: 1,
        userSelect: 'none',
        ...style,
      }}
      className={className}
    >
      {showIcon && (
        <svg
          width={Math.round(fs * 1.15)}
          height={Math.round(fs * 1.15)}
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="vfG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#7b61ff" />
              <stop offset="100%" stopColor="#00d4aa" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="#0e0e1c" />
          <rect x="29.5" y="12" width="5"  height="22" rx="2.5" fill="url(#vfG)" />
          <rect x="20"   y="20" width="5"  height="14" rx="2.5" fill="#7b61ff" opacity="0.7" />
          <rect x="39"   y="20" width="5"  height="14" rx="2.5" fill="#00d4aa" opacity="0.7" />
          <rect x="10.5" y="27" width="5"  height="7"  rx="2.5" fill="#7b61ff" opacity="0.35" />
          <rect x="48.5" y="27" width="5"  height="7"  rx="2.5" fill="#00d4aa" opacity="0.35" />
          <text
            fontFamily="'DM Sans',system-ui,sans-serif"
            fontSize="15"
            fontWeight="900"
            letterSpacing="-0.5"
            textAnchor="middle"
            x="32"
            y="56"
          >
            <tspan fill="#9b7fff">V</tspan>
            <tspan fill="#00d4aa">F</tspan>
          </text>
        </svg>
      )}
      <span
        style={{
          fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
          fontSize: fs,
          fontWeight: 900,
          letterSpacing: '-0.05em',
          lineHeight: 1,
        }}
      >
        <span style={{ color: vox }}>Vox</span>
        <span style={{ color: flow }}>Flow</span>
      </span>
    </span>
  )
}

export default VoxFlowLogo
