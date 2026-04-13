'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) } })
    return r.json()
  }
}

function flag(code: string): string {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397))
}

function fmtCAD(n: number): string { return n.toFixed(2).replace('.', ',') }

const STATUS_CLS: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'bg-amber-900/40 text-amber-400', label: 'En attente' },
  active: { cls: 'bg-emerald-900/40 text-emerald-400', label: 'Actif' },
  cancellation_request: { cls: 'bg-orange-900/40 text-orange-400', label: 'Annulation demandee' },
  canceled: { cls: 'bg-red-900/40 text-red-400', label: 'Annule' },
  suspended: { cls: 'bg-red-900/40 text-red-400', label: 'Suspendu' },
}

export default function NumbersPage() {
  const api = useApi()
  const [orders, setOrders] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [editDrawer, setEditDrawer] = useState<any>(null)
  const [editAction, setEditAction] = useState({ type: '', id: '', description: '' })
  const [actions, setActions] = useState<any>(null)

  const flash = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [ordRes, sumRes] = await Promise.all([
      api('/api/v1/telephony/did/orders'),
      api('/api/v1/telephony/did/summary'),
    ])
    if (ordRes.success) setOrders(ordRes.data || [])
    if (sumRes.success) setSummary(sumRes.data)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const openEdit = async (order: any) => {
    setEditDrawer(order)
    setEditAction({ type: order.assigned_action_type || '', id: order.assigned_action_id || '', description: order.description || '' })
    if (!actions) {
      const res = await api('/api/v1/telephony/did/actions')
      if (res.success) setActions(res.data)
    }
  }

  const saveEdit = async () => {
    if (!editDrawer) return
    const res = await api(`/api/v1/telephony/did/orders/${editDrawer.id}`, {
      method: 'PUT', body: JSON.stringify({ assignedActionType: editAction.type, assignedActionId: editAction.id, description: editAction.description }),
    })
    if (res.success) { flash('Numero mis a jour'); setEditDrawer(null); loadData() }
    else flash(res.error || 'Erreur', 'error')
  }

  const requestCancel = async (id: string) => {
    const res = await api(`/api/v1/telephony/did/orders/${id}/cancel-request`, { method: 'POST' })
    if (res.success) { flash('Demande d\'annulation soumise'); loadData() }
    else flash(res.error || 'Erreur', 'error')
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-9 h-9 border-[3px] border-[#2e2e44] border-t-[#7b61ff] rounded-full animate-spin" /></div>

  const activeOrders = orders.filter(o => o.status === 'active')
  const otherOrders = orders.filter(o => o.status !== 'active')

  return (
    <div className="w-full">
      {toast && <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg text-sm font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#eeeef8] m-0">Mes numeros DID</h1>
        <div className="flex gap-2">
          <Link href="/client/numbers/porting" className="px-4 py-2 bg-[#18181f] border border-[#2e2e44] text-[#9898b8] rounded-lg text-[12px] font-semibold no-underline hover:bg-[#1e1e2a]">Portabilite</Link>
          <Link href="/client/numbers/commander" className="px-4 py-2 bg-[#7b61ff] text-white rounded-lg text-[12px] font-bold no-underline hover:bg-[#6145ff]">Commander un numero</Link>
        </div>
      </div>

      {/* Stats bar */}
      {summary && (
        <div className="flex items-center gap-6 mb-6 text-[13px]">
          <span className="text-[#eeeef8] font-semibold">{summary.totalActive} numero{summary.totalActive > 1 ? 's' : ''} actif{summary.totalActive > 1 ? 's' : ''}</span>
          <span className="text-[#55557a]">|</span>
          <span className="text-[#9898b8]">{summary.freeUsed}/{summary.freeIncluded} inclus gratuit{summary.freeIncluded > 1 ? 's' : ''}</span>
          <span className="text-[#55557a]">|</span>
          <span className="text-[#9898b8]">Montant recurrent: <span className="text-[#7b61ff] font-bold">{fmtCAD(summary.monthlyCost)} CAD$/mois</span></span>
          <span className="text-[#55557a]">|</span>
          <Link href="/client/numbers/identities" className="text-[#7b61ff] text-[12px] font-semibold no-underline hover:underline">Mes identites</Link>
        </div>
      )}

      {/* Other orders (pending, cancellation, etc.) */}
      {otherOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[14px] font-bold text-[#9898b8] mb-3">Commandes</h2>
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_1fr_1fr_100px_100px_100px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
              <div>ID</div><div>Emplacement</div><div>Destination</div><div>Description</div><div>Etat</div><div>Identite</div><div>Actions</div>
            </div>
            {otherOrders.map(o => {
              const st = STATUS_CLS[o.status] || STATUS_CLS.pending
              return (
                <div key={o.id} className="grid grid-cols-[80px_1fr_1fr_1fr_100px_100px_100px] px-5 py-3 border-b border-[#2e2e44]/60 items-center text-[13px]">
                  <div className="text-[#55557a] font-mono text-[11px]">{o.id?.slice(0, 8)}</div>
                  <div className="text-[#eeeef8]">{o.country_code ? flag(o.country_code) + ' ' : ''}{o.region || o.country_code}</div>
                  <div className="text-[#eeeef8] font-mono">{o.phone_number || '-'}</div>
                  <div className="text-[#9898b8]">{o.description || '-'}</div>
                  <div><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span></div>
                  <div>{o.identity?.status === 'approved' ? <span className="text-emerald-400 text-[10px]">Approuvee</span> : o.identity?.status === 'pending' ? <span className="text-amber-400 text-[10px]">En attente</span> : '-'}</div>
                  <div>
                    {o.status === 'suspended' && <Link href="/client/invoices" className="text-[10px] text-red-400 no-underline hover:underline">Regulariser</Link>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active DIDs */}
      <h2 className="text-[14px] font-bold text-[#9898b8] mb-3">Existing Dids:</h2>
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_1fr_100px_120px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
          <div>Destination</div><div>Contexte</div><div>Statut</div><div>Actions</div>
        </div>
        {activeOrders.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Aucun numero actif.</div>
        ) : activeOrders.map(o => (
          <div key={o.id} className="grid grid-cols-[1fr_1fr_100px_120px] px-5 py-3 border-b border-[#2e2e44]/60 items-center text-[13px]">
            <div className="text-[#eeeef8] font-mono">{o.country_code ? flag(o.country_code) + ' ' : ''}{o.phone_number}</div>
            <div className="text-[#9898b8]">{o.description || '-'}</div>
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-900/40 text-emerald-400">Actif</span>
              {o.is_free_included && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-900/40 text-blue-400">Gratuit</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(o)} className="px-3 py-1 bg-[#18181f] border border-[#2e2e44] rounded text-[11px] font-semibold text-[#9898b8] cursor-pointer hover:bg-[#1e1e2a]">Editer</button>
              {!o.is_free_included && <button onClick={() => requestCancel(o.id)} className="px-3 py-1 bg-red-950/30 border border-red-800/30 rounded text-[11px] font-semibold text-red-400 cursor-pointer hover:bg-red-950/50">Annuler</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {summary && (
        <div className="text-[12px] text-[#55557a]">
          Free did numbers: {summary.freeUsed} — Montant recurrent: <span className="text-[#7b61ff] font-semibold">{fmtCAD(summary.monthlyCost)} CAD$/mois</span>
        </div>
      )}

      {/* Edit drawer */}
      {editDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setEditDrawer(null)}>
          <div onClick={e => e.stopPropagation()} className="w-[480px] max-w-full h-full bg-[#0c0c1a] border-l border-[#2e2e44] flex flex-col overflow-y-auto">
            <div className="px-6 py-5 border-b border-[#2e2e44]">
              <div className="text-[17px] font-bold text-[#eeeef8]">Editer {editDrawer.country_code ? flag(editDrawer.country_code) + ' ' : ''}{editDrawer.phone_number}</div>
            </div>
            <div className="flex-1 px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] text-[#9898b8] mb-1 block">Action</label>
                <select value={editAction.type} onChange={e => setEditAction(p => ({ ...p, type: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none">
                  <option value="">Aucune</option>
                  <optgroup label="Extensions">{(actions?.extensions || []).map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>
                  <optgroup label="Files d'attente">{(actions?.queues || []).map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>
                  <optgroup label="Messagerie vocale">{(actions?.voicemails || []).map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label className="text-[12px] text-[#9898b8] mb-1 block">Description</label>
                <input value={editAction.description} onChange={e => setEditAction(p => ({ ...p, description: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" placeholder="Ex: Ligne principale" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2e2e44] flex justify-end gap-3">
              <button onClick={() => setEditDrawer(null)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
              <button onClick={saveEdit} className="px-5 py-2 bg-[#7b61ff] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer hover:bg-[#6145ff]">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
