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
  pdf_url?: string | null
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

// ─── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Payee
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
        Echouee
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
      En attente
    </span>
  )
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
      const dashData = dashRes.data || dashRes
      if (dashData) {
        const m = dashData.metrics || dashData
        setMetrics({
          next_invoice_amount: m.next_invoice_amount ?? null,
          next_invoice_date: m.next_invoice_date ?? null,
        })
        const org = dashData.org || {}
        setStripeCustomerId(org.stripe_customer_id || null)

        const pm = dashData.payment_method || m.payment_method || null
        if (pm && pm.last4) {
          setPaymentLast4(pm.last4)
        }
      }

      // Invoices
      const invData = invRes.data || invRes
      if (Array.isArray(invData)) {
        setInvoices(invData)
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

  // Loading
  if (loading) {
    return (
      <div className="py-10 text-center">
        <div className="w-9 h-9 border-[3px] border-[#2e2e44] border-t-[#7b61ff] rounded-full animate-spin mx-auto mb-4" />
        <div className="text-sm text-[#55557a]">Chargement des factures...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 bg-[#18181f] border border-[#7b61ff]/30 rounded-xl text-sm text-[#eeeef8] shadow-xl max-w-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-bold text-[#eeeef8] mb-1">Factures</h1>
        <p className="text-sm text-[#9898b8]">Consultez et gerez vos factures et paiements.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 3 Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Montant recurrent */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-[#55557a] mb-2 font-semibold">
            Montant recurrent mensuel
          </div>
          <div className="text-2xl font-extrabold text-[#eeeef8]">
            {metrics.next_invoice_amount != null
              ? `${metrics.next_invoice_amount.toFixed(2).replace('.', ',')} CAD$/mois`
              : '-- CAD$/mois'
            }
          </div>
        </div>

        {/* Prochaine facturation */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-[#55557a] mb-2 font-semibold">
            Prochaine facturation
          </div>
          <div className="text-2xl font-extrabold text-[#eeeef8]">
            {metrics.next_invoice_date ? fmtDate(metrics.next_invoice_date) : '--'}
          </div>
        </div>

        {/* Mode de paiement */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-[#55557a] mb-2 font-semibold">
            Mode de paiement
          </div>
          <div className={`text-2xl font-extrabold ${stripeCustomerId ? 'text-[#eeeef8]' : 'text-[#55557a]'}`}>
            {stripeCustomerId
              ? (paymentLast4 ? `****${paymentLast4}` : 'Carte configuree')
              : 'Non configure'
            }
          </div>
          {!stripeCustomerId && (
            <div className="text-[11px] text-[#55557a] mt-1">
              Aucun mode de paiement enregistre
            </div>
          )}
        </div>
      </div>

      {/* Red Banner -- failed payment */}
      {hasFailed && (
        <div className="mb-5 px-5 py-3.5 bg-red-500/5 border border-red-500/20 rounded-xl flex justify-between items-center gap-4 flex-wrap">
          <div className="text-sm text-red-400 font-medium">
            Un paiement a echoue. Veuillez mettre a jour votre carte de paiement.
          </div>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-default whitespace-nowrap transition-colors"
          >
            {portalLoading ? 'Ouverture...' : 'Mettre a jour'}
          </button>
        </div>
      )}

      {/* Gerer carte button */}
      <div className="mb-6">
        <button
          onClick={openPortal}
          disabled={portalLoading}
          className="bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-default transition-colors"
        >
          {portalLoading ? 'Ouverture...' : 'Gerer ma carte de paiement'}
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        {invoices.length === 0 && !error ? (
          <div className="py-10 text-center">
            <div className="text-sm text-[#55557a] mb-1">Aucune facture</div>
            <div className="text-xs text-[#55557a]/60">
              Vos factures apparaitront ici des la premiere periode de facturation.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#111118]">
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Periode</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Description</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Montant</th>
                  <th className="px-4 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Statut</th>
                  <th className="px-4 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const firstLine = inv.lines && inv.lines.length > 0
                    ? inv.lines[0].description
                    : 'Facture VoxFlow'
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-[#1f1f2a] hover:bg-[#1f1f2a] transition-colors"
                    >
                      <td className="px-4 py-3.5 text-sm text-[#9898b8]">{fmtDateShort(inv.issued_at)}</td>
                      <td className="px-4 py-3.5 text-sm text-[#9898b8]">{inv.period_label || '--'}</td>
                      <td className="px-4 py-3.5 text-sm text-[#9898b8] max-w-[260px] truncate">{firstLine}</td>
                      <td className="px-4 py-3.5 text-sm text-[#eeeef8] text-right font-semibold tabular-nums">{fmtPrice(inv.total)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {inv.pdf_url ? (
                          <a
                            href={inv.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-3 py-1 bg-[#7b61ff]/10 border border-[#7b61ff]/20 rounded-lg text-[#7b61ff] text-xs font-semibold hover:bg-[#7b61ff]/20 transition-colors"
                          >
                            PDF
                          </a>
                        ) : (
                          <span
                            className="inline-block px-3 py-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg text-[#55557a] text-xs cursor-not-allowed opacity-50"
                            title="Bientot disponible"
                          >
                            PDF
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
