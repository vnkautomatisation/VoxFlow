// VoxFlowLogo.tsx — Composant logo standardisé VoxFlow
import React from 'react'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'dark' | 'light' | 'mono'
  showIcon?: boolean
  className?: string
}

const SIZES = { sm: 16, md: 24, lg: 36, xl: 48 }

export function VoxFlowLogo({ size = 'md', variant = 'dark', showIcon = false, className }: Props) {
  const fs = SIZES[size]
  const voxColor  = variant === 'light' ? '#6b4fff' : variant === 'mono' ? 'currentColor' : '#7b61ff'
  const flowColor = variant === 'light' ? '#009d80' : variant === 'mono' ? 'currentColor' : '#00d4aa'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: showIcon ? 8 : 0, textDecoration: 'none', lineHeight: 1, userSelect: 'none' }} className={className}>
      {showIcon && (
        <svg width={fs * 1.1} height={fs * 1.1} viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="dG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7b61ff"/>
              <stop offset="100%" stopColor="#00d4aa"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="#0e0e1c"/>
          <rect x="29.5" y="14" width="5"  height="20" rx="2.5" fill="url(#dG)"/>
          <rect x="20"   y="22" width="5"  height="12" rx="2.5" fill="#7b61ff" opacity="0.7"/>
          <rect x="39"   y="22" width="5"  height="12" rx="2.5" fill="#00d4aa" opacity="0.7"/>
          <rect x="10.5" y="28" width="5"  height="6"  rx="2.5" fill="#7b61ff" opacity="0.35"/>
          <rect x="48.5" y="28" width="5"  height="6"  rx="2.5" fill="#00d4aa" opacity="0.35"/>
          <text fontFamily="'DM Sans',system-ui,sans-serif" fontSize="15" fontWeight="900"
                letterSpacing="-0.5" textAnchor="middle" x="32" y="55">
            <tspan fill="#9b7fff">V</tspan><tspan fill="#00d4aa">F</tspan>
          </text>
        </svg>
      )}
      <span style={{ fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif", fontSize: fs, fontWeight: 900, letterSpacing: '-0.05em' }}>
        <span style={{ color: voxColor }}>Vox</span><span style={{ color: flowColor }}>Flow</span>
      </span>
    </span>
  )
}

export default VoxFlowLogo
