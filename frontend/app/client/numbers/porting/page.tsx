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

const STATUS: Record<string, { cls: string; label: string }> = {
  submitted: { cls: 'bg-blue-900/40 text-blue-400', label: 'Soumise' },
  in_progress: { cls: 'bg-amber-900/40 text-amber-400', label: 'En cours' },
  completed: { cls: 'bg-emerald-900/40 text-emerald-400', label: 'Completee' },
  rejected: { cls: 'bg-red-900/40 text-red-400', label: 'Rejetee' },
  canceled: { cls: 'bg-[#1e1e3a] text-[#55557a]', label: 'Annulee' },
}

export default function PortingPage() {
  const api = useApi()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ phoneNumber: '', currentCarrier: '', accountNumber: '', pin: '', authorizedName: '', address: '', city: '', state: '', postalCode: '', countryCode: 'CA' })
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)

  const flash = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api('/api/v1/telephony/porting')
    if (res.success) setRequests(res.data || [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!form.phoneNumber || !form.currentCarrier || !form.authorizedName || !form.address) { flash('Champs requis manquants', 'error'); return }
    setSubmitting(true)
    const res = await api('/api/v1/telephony/porting', { method: 'POST', body: JSON.stringify(form) })
    if (res.success) { flash('Demande soumise. Delai estime: 7-14 jours.'); setShowModal(false); setForm({ phoneNumber: '', currentCarrier: '', accountNumber: '', pin: '', authorizedName: '', address: '', city: '', state: '', postalCode: '', countryCode: 'CA' }); load() }
    else flash(res.error || 'Erreur', 'error')
    setSubmitting(false)
  }

  const handleCancel = async (id: string) => {
    const res = await api(`/api/v1/telephony/porting/${id}`, { method: 'DELETE' })
    if (res.success) { flash('Demande annulee'); setCancelId(null); load() }
    else flash(res.error || 'Erreur', 'error')
  }

  return (
    <div className="w-full">
      {toast && <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg text-sm font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'}`}>{toast.msg}</div>}

      <div className="text-[12px] text-[#55557a] mb-3">
        <Link href="/client/numbers" className="text-[#7b61ff] no-underline hover:underline">Mes numeros</Link> &gt; Portabilite
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#eeeef8] m-0">Portabilite de numero</h1>
          <p className="text-[12px] text-[#55557a] mt-1 mb-0">Transferez votre numero existant vers VoxFlow. Delai: 7-14 jours ouvrables.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-[#7b61ff] text-white rounded-lg text-[12px] font-bold cursor-pointer border-none hover:bg-[#6145ff]">Demander une portabilite</button>
      </div>

      {/* How it works */}
      <div className="flex gap-6 mb-6">
        {['Soumettez votre demande avec LOA', 'Nous contactons votre operateur actuel', 'Votre numero est active sur VoxFlow'].map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#7b61ff] text-white flex items-center justify-center text-[12px] font-bold flex-shrink-0">{i + 1}</div>
            <span className="text-[12px] text-[#9898b8]">{s}</span>
          </div>
        ))}
      </div>

      {/* Requests table */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_100px_100px_120px_80px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
          <div>Numero</div><div>Operateur</div><div>Statut</div><div>Soumise le</div><div>Completion</div><div>Actions</div>
        </div>
        {loading ? <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Chargement...</div> :
          requests.length === 0 ? <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Aucune demande de portabilite.</div> :
          requests.map(r => {
            const st = STATUS[r.status] || STATUS.submitted
            return (
              <div key={r.id}>
                <div className="grid grid-cols-[1fr_1fr_100px_100px_120px_80px] px-5 py-3 border-b border-[#2e2e44]/60 items-center text-[13px]">
                  <div className="text-[#eeeef8] font-mono">{r.phone_number}</div>
                  <div className="text-[#9898b8]">{r.current_carrier}</div>
                  <div><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span></div>
                  <div className="text-[#55557a] text-[12px]">{new Date(r.submitted_at || r.created_at).toLocaleDateString('fr-CA')}</div>
                  <div className="text-[#55557a] text-[12px]">{r.estimated_completion_date || '-'}</div>
                  <div>
                    {r.status === 'submitted' && <button onClick={() => setCancelId(r.id)} className="text-[11px] text-red-400 bg-transparent border-none cursor-pointer hover:underline">Annuler</button>}
                  </div>
                </div>
                {r.status === 'rejected' && r.rejection_reason && <div className="px-5 py-2 text-[11px] text-red-400 bg-red-950/20">{r.rejection_reason}</div>}
              </div>
            )
          })}
      </div>

      {/* Porting modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl w-[550px] max-w-[95vw] max-h-[85vh] overflow-y-auto">
            <div className="px-7 pt-6 pb-4 border-b border-[#2e2e44]"><div className="text-[17px] font-bold text-[#eeeef8]">Demande de portabilite</div></div>
            <div className="px-7 py-5 space-y-3">
              <div><label className="text-[12px] text-[#9898b8] mb-1 block">Numero a porter *</label><input value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="+15141234567" className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              <div><label className="text-[12px] text-[#9898b8] mb-1 block">Operateur actuel *</label><input value={form.currentCarrier} onChange={e => setForm(p => ({ ...p, currentCarrier: e.target.value }))} placeholder="Bell, Rogers, Videotron..." className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Numero de compte</label><input value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">PIN</label><input value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              </div>
              <div><label className="text-[12px] text-[#9898b8] mb-1 block">Nom autorise *</label><input value={form.authorizedName} onChange={e => setForm(p => ({ ...p, authorizedName: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              <div><label className="text-[12px] text-[#9898b8] mb-1 block">Adresse facturation *</label><input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Ville</label><input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Province</label><input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Code postal</label><input value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              </div>
              <div className="text-[11px] text-[#55557a]">Le LOA doit etre signe par le titulaire du compte.</div>
            </div>
            <div className="px-7 py-4 border-t border-[#2e2e44] flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-[#7b61ff] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer hover:bg-[#6145ff]">{submitting ? '...' : 'Soumettre'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setCancelId(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[400px]">
            <div className="text-[17px] font-bold text-[#eeeef8] mb-4">Annuler la demande?</div>
            <div className="text-[13px] text-[#9898b8] mb-6">La demande de portabilite sera annulee.</div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelId(null)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Retour</button>
              <button onClick={() => handleCancel(cancelId)} className="px-5 py-2 bg-[#ff4d6d] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer">Annuler la demande</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
