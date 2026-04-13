'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────
interface OrgInfo {
  id: string; name: string; status: string
  trial_ends_at: string | null; stripe_customer_id: string | null
}
interface Metrics {
  active_services: number; next_invoice_amount: number
  next_invoice_date: string | null; active_agents: number; did_numbers: number
}
interface Subscription {
  id: string; plan_id: string; plan_name: string; service_type: string
  quantity: number; billing_cycle: string; status: string
  unit_price: number; monthly_total: number; features_list: string[]
  current_period_end: string; trial_ends_at: string | null
}
interface Addon {
  sku: string; name: string; quantity: number; unit_price: number; total: number
}
interface DashboardData {
  org: OrgInfo; metrics: Metrics
  subscriptions: Subscription[]; addons: Addon[]
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
function formatCAD(amount: number): string {
  return amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 })
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0
  const now = new Date()
  const end = new Date(iso)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function serviceTypeBadge(type: string): { bg: string; color: string; label: string } {
  switch (type.toUpperCase()) {
    case 'TELEPHONY': return { bg: '#1a3a5a', color: '#4da6ff', label: 'Telephonie' }
    case 'DIALER':    return { bg: '#3a2a1a', color: '#ffb547', label: 'Dialer' }
    case 'ROBOT':     return { bg: '#2a1a3a', color: '#b47bff', label: 'Robot' }
    default:          return { bg: '#1e1e3a', color: '#7b61ff', label: type }
  }
}

function statusBadge(status: string): { bg: string; color: string; label: string } {
  switch (status.toLowerCase()) {
    case 'active':   return { bg: '#0a2a1a', color: '#00d4aa', label: 'Actif' }
    case 'trialing': return { bg: '#0a1a3a', color: '#4da6ff', label: 'Essai' }
    case 'past_due': return { bg: '#3a0a0a', color: '#ff4d4d', label: 'En retard' }
    default:         return { bg: '#1e1e3a', color: '#5a5a7a', label: status }
  }
}

// ── Main Page ──────────────────────────────────────────────
export default function ClientDashboardPage() {
  const api = useApi()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api('/api/v1/client/portal/dashboard')
        if (!cancelled) {
          if (res.success && res.data) {
            setData(res.data)
          } else {
            setError(res.error || 'Impossible de charger le tableau de bord')
          }
        }
      } catch {
        if (!cancelled) setError('Erreur de connexion au serveur')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #1e1e3a', borderTopColor: '#7b61ff',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 13, color: '#5a5a7a' }}>Chargement...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#ff4d4d', marginBottom: 8 }}>{error || 'Erreur inconnue'}</div>
          <button onClick={() => window.location.reload()} style={{
            background: '#7b61ff', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>Reessayer</button>
        </div>
      </div>
    )
  }

  const { org, metrics, subscriptions, addons } = data
  const trialDays = daysUntil(org.trial_ends_at)
  const hasSubscriptions = subscriptions && subscriptions.length > 0

  return (
    <div style={{ fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif", maxWidth: 1100 }}>

      {/* ── Past due banner ────────────────────────────────── */}
      {org.status === 'past_due' && (
        <div style={{
          background: '#2a0a0a', border: '1px solid #5a1a1a', borderRadius: 10,
          padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 13, color: '#ff8888', fontWeight: 600 }}>Paiement en retard</span>
            <span style={{ fontSize: 12, color: '#884444' }}>Votre methode de paiement a ete refusee. Mettez a jour votre carte pour eviter une interruption de service.</span>
          </div>
          <Link href="/client/invoices" style={{
            background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: 8,
            padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>Mettre a jour la carte</Link>
        </div>
      )}

      {/* ── Trial banner ───────────────────────────────────── */}
      {org.status === 'trialing' && org.trial_ends_at && (
        <div style={{
          background: '#0a1a3a', border: '1px solid #1a3a6a', borderRadius: 10,
          padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontSize: 13, color: '#88bbff', fontWeight: 600 }}>{trialDays} jour{trialDays > 1 ? 's' : ''} restant{trialDays > 1 ? 's' : ''}</span>
            <span style={{ fontSize: 12, color: '#446688' }}>Votre periode d'essai se termine le {formatDate(org.trial_ends_at)}.</span>
          </div>
          <Link href="/commander" style={{
            background: '#4da6ff', color: '#fff', border: 'none', borderRadius: 8,
            padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>Choisir un forfait</Link>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0 }}>Mon compte</h1>
          <p style={{ fontSize: 13, color: '#5a5a7a', margin: '4px 0 0' }}>{org.name}</p>
        </div>
        <Link href="/commander" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#7b61ff', color: '#fff', border: 'none', borderRadius: 10,
          padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          textDecoration: 'none', fontFamily: 'inherit', transition: 'opacity .15s',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Commander un service
        </Link>
      </div>

      {/* ── Metric cards ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {/* Services actifs */}
        <div style={metricCard}>
          <div style={metricIcon('#7b61ff')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8f8' }}>{metrics.active_services}</div>
          <div style={metricLabel}>Services actifs</div>
        </div>

        {/* Prochaine facture */}
        <div style={metricCard}>
          <div style={metricIcon('#00d4aa')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8f8' }}>{formatCAD(metrics.next_invoice_amount)}</div>
          <div style={metricLabel}>Prochaine facture{metrics.next_invoice_date ? ` - ${formatDate(metrics.next_invoice_date)}` : ''}</div>
        </div>

        {/* Agents actifs */}
        <div style={metricCard}>
          <div style={metricIcon('#4da6ff')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8f8' }}>{metrics.active_agents}</div>
          <div style={metricLabel}>Agents actifs</div>
        </div>

        {/* Numeros DID */}
        <div style={metricCard}>
          <div style={metricIcon('#ffb547')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb547" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l1.86-1.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#e8e8f8' }}>{metrics.did_numbers}</div>
          <div style={metricLabel}>Numeros DID</div>
        </div>
      </div>

      {/* ── Subscriptions ──────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#c8c8e8', margin: '0 0 14px' }}>Forfaits actifs</h2>

        {hasSubscriptions ? (
          <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 100px 100px 130px 90px',
              padding: '10px 20px', background: '#0a0a18', borderBottom: '1px solid #1e1e3a',
              fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600,
            }}>
              <div>Type</div>
              <div>Forfait</div>
              <div>Utilisateurs</div>
              <div>Statut</div>
              <div style={{ textAlign: 'right' }}>Montant</div>
              <div style={{ textAlign: 'right' }}></div>
            </div>

            {/* Rows */}
            {subscriptions.map(sub => {
              const sType = serviceTypeBadge(sub.service_type)
              const sBadge = statusBadge(sub.status)
              return (
                <div key={sub.id} style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 100px 100px 130px 90px',
                  padding: '14px 20px', borderBottom: '1px solid #1a1a2e',
                  alignItems: 'center', transition: 'background .12s',
                }}>
                  <div>
                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 8px',
                      borderRadius: 5, background: sType.bg, color: sType.color, letterSpacing: '.04em',
                    }}>{sType.label}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#d8d8f0' }}>{sub.plan_name}</div>
                    {sub.trial_ends_at && (
                      <div style={{ fontSize: 11, color: '#4da6ff', marginTop: 2 }}>
                        Essai jusqu'au {formatDate(sub.trial_ends_at)}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#8888a8' }}>{sub.quantity} poste{sub.quantity > 1 ? 's' : ''}</div>
                  <div>
                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 8px',
                      borderRadius: 5, background: sBadge.bg, color: sBadge.color,
                    }}>{sBadge.label}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#e8e8f8' }}>
                    {formatCAD(sub.monthly_total)}
                    <span style={{ fontSize: 11, color: '#5a5a7a', fontWeight: 400 }}> /mois</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Link href="/client/plans" style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#7b61ff',
                      padding: '5px 12px', border: '1px solid #7b61ff44', borderRadius: 7,
                      textDecoration: 'none', transition: 'all .15s', background: '#7b61ff0a',
                    }}>Gerer</Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Empty state CTA ─────────────────────────────── */
          <div style={{
            background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 14,
            padding: '48px 32px', textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: '#7b61ff14',
              border: '1px solid #7b61ff33', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f8', margin: '0 0 8px' }}>Commencer avec VoxFlow</h3>
            <p style={{ fontSize: 13, color: '#5a5a7a', margin: '0 0 24px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              Choisissez un forfait de telephonie, de dialer ou de robot d'appel pour commencer a utiliser la plateforme.
            </p>
            <Link href="/commander" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#7b61ff', color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              textDecoration: 'none', fontFamily: 'inherit',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Decouvrir les forfaits
            </Link>
          </div>
        )}
      </div>

      {/* ── Addons ─────────────────────────────────────────── */}
      {addons && addons.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#c8c8e8', margin: '0 0 14px' }}>Modules complementaires</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {addons.map(addon => (
              <div key={addon.sku} style={{
                background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 10,
                padding: '16px 18px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8e8', marginBottom: 6 }}>{addon.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#5a5a7a' }}>Qte: {addon.quantity}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f8' }}>{formatCAD(addon.total)}<span style={{ fontSize: 11, color: '#5a5a7a', fontWeight: 400 }}> /mois</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────
const metricCard: React.CSSProperties = {
  background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12,
  padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 8,
}

const metricLabel: React.CSSProperties = {
  fontSize: 12, color: '#5a5a7a', fontWeight: 500,
}

function metricIcon(color: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: color + '14', border: `1px solid ${color}33`,
  }
}
