'use client'

import { useState, useCallback, useEffect } from 'react'

// ─── API helper ─────────────────────────────────────────────────────────────
function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) },
      body: opts.body,
    })
    return r.json()
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface InvoiceLine {
  description: string
  qty: number
  unit_price: number
  total: number
}

interface Invoice {
  id: string
  number: string
  period_label: string
  status: 'paid' | 'pending' | 'failed'
  issued_at: string
  due_at: string
  paid_at: string | null
  subtotal: number
  tax_tps: number
  tax_tvq: number
  total: number
  currency: string
  lines: InvoiceLine[]
  stripe_invoice_id: string | null
}

interface DashboardMetrics {
  next_invoice_amount: number | null
  next_invoice_date: string | null
}

// ─── Formatters ─────────────────────────────────────────────────────────────
function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '0,00 CAD$'
  const fixed = Math.abs(n).toFixed(2).replace('.', ',')
  return n < 0 ? `-${fixed} CAD$` : `${fixed} CAD$`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: '#0f0f1e',
  border: '1px solid #1e1e3a',
  borderRadius: 12,
  padding: '20px 24px',
  flex: '1 1 0',
  minWidth: 200,
}

const TABLE_HEADER: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 11,
  fontWeight: 600,
  color: '#5a5a7a',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  textAlign: 'left',
  borderBottom: '1px solid #1e1e3a',
}

const TABLE_CELL: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 13,
  color: '#c8c8e8',
  verticalAlign: 'middle',
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const api = useApi()

  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({ next_invoice_amount: null, next_invoice_date: null })
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [paymentLast4, setPaymentLast4] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashRes, invRes] = await Promise.all([
        api('/api/v1/client/portal/dashboard'),
        api('/api/v1/client/portal/invoices'),
      ])

      // Dashboard metrics
      if (dashRes.success && dashRes.data) {
        const m = dashRes.data.metrics || dashRes.data
        setMetrics({
          next_invoice_amount: m.next_invoice_amount ?? null,
          next_invoice_date: m.next_invoice_date ?? null,
        })
        const org = dashRes.data.org || {}
        setStripeCustomerId(org.stripe_customer_id || null)

        // payment method info if available
        const pm = dashRes.data.payment_method || m.payment_method || null
        if (pm && pm.last4) {
          setPaymentLast4(pm.last4)
        }
      }

      // Invoices
      if (invRes.success && Array.isArray(invRes.data)) {
        setInvoices(invRes.data)
      } else if (Array.isArray(invRes)) {
        setInvoices(invRes)
      } else {
        setInvoices([])
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les donnees')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Stripe portal
  const openPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await api('/api/v1/client/portal/portal-session', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const d = res.data || res
      if (d.url) {
        window.open(d.url, '_blank')
      } else {
        showToast('Mode demo -- Portail Stripe non disponible')
      }
    } catch {
      showToast('Mode demo -- Portail Stripe non disponible')
    }
    setPortalLoading(false)
  }

  const hasFailed = invoices.some(i => i.status === 'failed')

  // Status badge
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
      paid:    { label: 'Payee',      bg: '#00d4aa14', color: '#00d4aa', border: '#00d4aa33' },
      pending: { label: 'En attente', bg: '#ffb54714', color: '#ffb547', border: '#ffb54733' },
      failed:  { label: 'Echouee',    bg: '#ff4d6d14', color: '#ff4d6d', border: '#ff4d6d33' },
    }
    const s = map[status] || map.pending
    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {s.label}
      </span>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #1e1e3a', borderTopColor: '#7b61ff',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ fontSize: 14, color: '#5a5a7a' }}>Chargement des factures...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 300,
          padding: '12px 20px', background: '#0f0f1e', border: '1px solid #7b61ff55',
          borderRadius: 10, fontSize: 13, color: '#c8c8e8',
          boxShadow: '0 4px 24px #00000066', maxWidth: 380,
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Factures</h1>
        <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Consultez et gerez vos factures et paiements.</p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 16, padding: '12px 18px', background: '#ff4d6d12',
          border: '1px solid #ff4d6d44', borderRadius: 10, fontSize: 13, color: '#ff8888',
        }}>
          {error}
        </div>
      )}

      {/* 3 Header Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Montant recurrent */}
        <div style={CARD}>
          <div style={{ fontSize: 11, color: '#5a5a7a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Montant recurrent mensuel
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#e8e8f8' }}>
            {metrics.next_invoice_amount != null
              ? `${metrics.next_invoice_amount.toFixed(2).replace('.', ',')} CAD$/mois`
              : '-- CAD$/mois'
            }
          </div>
        </div>

        {/* Prochaine facturation */}
        <div style={CARD}>
          <div style={{ fontSize: 11, color: '#5a5a7a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Prochaine facturation
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#e8e8f8' }}>
            {metrics.next_invoice_date
              ? fmtDate(metrics.next_invoice_date)
              : '--'
            }
          </div>
        </div>

        {/* Mode de paiement */}
        <div style={CARD}>
          <div style={{ fontSize: 11, color: '#5a5a7a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Mode de paiement
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: stripeCustomerId ? '#e8e8f8' : '#5a5a7a' }}>
            {stripeCustomerId
              ? (paymentLast4 ? `****${paymentLast4}` : 'Carte configuree')
              : 'Non configure'
            }
          </div>
          {!stripeCustomerId && (
            <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 6 }}>
              Aucun mode de paiement enregistre
            </div>
          )}
        </div>
      </div>

      {/* Red Banner — failed payment */}
      {hasFailed && (
        <div style={{
          marginBottom: 20, padding: '14px 20px',
          background: '#ff4d6d12', border: '1px solid #ff4d6d44', borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: '#ff8888', fontWeight: 500 }}>
            Un paiement a echoue. Veuillez mettre a jour votre carte de paiement.
          </div>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            style={{
              padding: '8px 18px', background: '#ff4d6d', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: portalLoading ? 'default' : 'pointer',
              opacity: portalLoading ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {portalLoading ? 'Ouverture...' : 'Mettre a jour'}
          </button>
        </div>
      )}

      {/* Gerer carte button */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={openPortal}
          disabled={portalLoading}
          style={{
            padding: '10px 22px', background: '#7b61ff', border: 'none', borderRadius: 9,
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: portalLoading ? 'default' : 'pointer',
            opacity: portalLoading ? 0.6 : 1, transition: 'opacity .15s',
          }}
        >
          {portalLoading ? 'Ouverture...' : 'Gerer ma carte de paiement'}
        </button>
      </div>

      {/* Invoices Table */}
      <div style={{
        background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden',
      }}>
        {invoices.length === 0 && !error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4a4a6a' }}>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Aucune facture</div>
            <div style={{ fontSize: 12, color: '#3a3a5a' }}>
              Vos factures apparaitront ici des la premiere periode de facturation.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a0a18' }}>
                <th style={TABLE_HEADER}>Date</th>
                <th style={TABLE_HEADER}>Periode</th>
                <th style={TABLE_HEADER}>Description</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'right' }}>Montant</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'center' }}>Statut</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'center' }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => {
                const rowBg = idx % 2 === 0 ? '#0a0a18' : '#0f0f1e'
                const firstLine = inv.lines && inv.lines.length > 0
                  ? inv.lines[0].description
                  : 'Facture VoxFlow'
                return (
                  <tr
                    key={inv.id}
                    style={{ background: rowBg, transition: 'background .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#14142a')}
                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                  >
                    <td style={TABLE_CELL}>{fmtDateShort(inv.issued_at)}</td>
                    <td style={TABLE_CELL}>{inv.period_label || '--'}</td>
                    <td style={{ ...TABLE_CELL, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {firstLine}
                    </td>
                    <td style={{ ...TABLE_CELL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPrice(inv.total)}
                    </td>
                    <td style={{ ...TABLE_CELL, textAlign: 'center' }}>
                      {statusBadge(inv.status)}
                    </td>
                    <td style={{ ...TABLE_CELL, textAlign: 'center' }}>
                      <button
                        disabled
                        title="Bientot disponible"
                        style={{
                          padding: '5px 12px', background: '#1a1a2e', border: '1px solid #2a2a4a',
                          borderRadius: 6, color: '#3a3a5a', fontSize: 11, cursor: 'not-allowed',
                          opacity: 0.5,
                        }}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
