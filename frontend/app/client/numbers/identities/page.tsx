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

function flag(code: string): string { return (code || '').toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397)) }

const STATUS: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'bg-amber-900/40 text-amber-400', label: 'En attente' },
  approved: { cls: 'bg-emerald-900/40 text-emerald-400', label: 'Approuvee' },
  rejected: { cls: 'bg-red-900/40 text-red-400', label: 'Rejetee' },
}

export default function IdentitiesPage() {
  const api = useApi()
  const [identities, setIdentities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', addressLine1: '', city: '', state: '', postalCode: '', countryCode: 'FR', documentType: 'passport' })
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const flash = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await api('/api/v1/telephony/did/identities')
    if (res.success) setIdentities(res.data || [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!form.name) { flash('Nom requis', 'error'); return }
    setSubmitting(true)
    const res = await api('/api/v1/telephony/did/identities', { method: 'POST', body: JSON.stringify(form) })
    if (res.success) { flash('Identite soumise pour validation'); setShowModal(false); setForm({ name: '', company: '', addressLine1: '', city: '', state: '', postalCode: '', countryCode: 'FR', documentType: 'passport' }); load() }
    else flash(res.error || 'Erreur', 'error')
    setSubmitting(false)
  }

  return (
    <div className="w-full">
      {toast && <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg text-sm font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'}`}>{toast.msg}</div>}

      <div className="text-[12px] text-[#55557a] mb-3">
        <Link href="/client/numbers" className="text-[#7b61ff] no-underline hover:underline">Mes numeros</Link> &gt; Mes identites
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#eeeef8] m-0">Mes identites</h1>
          <p className="text-[12px] text-[#55557a] mt-1 mb-0">Les identites sont requises pour activer des numeros dans certains pays (France, Allemagne, etc.)</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-[#7b61ff] text-white rounded-lg text-[12px] font-bold cursor-pointer border-none hover:bg-[#6145ff]">Nouvelle identite</button>
      </div>

      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_100px_100px_100px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
          <div>Nom</div><div>Pays</div><div>Statut</div><div>Soumise le</div><div>Actions</div>
        </div>
        {loading ? <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Chargement...</div> :
          identities.length === 0 ? <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Aucune identite.</div> :
          identities.map(i => {
            const st = STATUS[i.status] || STATUS.pending
            return (
              <div key={i.id}>
                <div className="grid grid-cols-[1fr_80px_100px_100px_100px] px-5 py-3 border-b border-[#2e2e44]/60 items-center text-[13px]">
                  <div className="text-[#eeeef8] font-semibold">{i.name}</div>
                  <div>{i.country_code ? flag(i.country_code) : '-'}</div>
                  <div><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span></div>
                  <div className="text-[#55557a] text-[12px]">{new Date(i.created_at).toLocaleDateString('fr-CA')}</div>
                  <div>
                    {i.document_url && <a href={i.document_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#7b61ff] no-underline hover:underline">Document</a>}
                    {i.status === 'rejected' && <button onClick={() => { setForm({ name: i.name, company: i.company || '', addressLine1: i.address_line1 || '', city: i.city || '', state: i.state || '', postalCode: i.postal_code || '', countryCode: i.country_code || 'FR', documentType: i.document_type || 'passport' }); setShowModal(true) }} className="ml-2 text-[11px] text-[#7b61ff] bg-transparent border-none cursor-pointer hover:underline">Retenter</button>}
                  </div>
                </div>
                {i.status === 'rejected' && i.rejection_reason && <div className="px-5 py-2 text-[11px] text-red-400 bg-red-950/20">{i.rejection_reason}</div>}
              </div>
            )
          })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl w-[550px] max-w-[95vw] max-h-[85vh] overflow-y-auto">
            <div className="px-7 pt-6 pb-4 border-b border-[#2e2e44]">
              <div className="text-[17px] font-bold text-[#eeeef8]">Nouvelle identite</div>
            </div>
            <div className="px-7 py-5 space-y-3">
              <div><label className="text-[12px] text-[#9898b8] mb-1 block">Nom complet *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              <div><label className="text-[12px] text-[#9898b8] mb-1 block">Entreprise</label><input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              <div><label className="text-[12px] text-[#9898b8] mb-1 block">Adresse</label><input value={form.addressLine1} onChange={e => setForm(p => ({ ...p, addressLine1: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Ville</label><input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Province</label><input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Code postal</label><input value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Pays</label><select value={form.countryCode} onChange={e => setForm(p => ({ ...p, countryCode: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none"><option value="FR">France</option><option value="DE">Allemagne</option><option value="BE">Belgique</option><option value="CH">Suisse</option><option value="ES">Espagne</option><option value="IT">Italie</option><option value="AU">Australie</option><option value="IL">Israel</option><option value="IN">Inde</option></select></div>
                <div><label className="text-[12px] text-[#9898b8] mb-1 block">Type document</label><select value={form.documentType} onChange={e => setForm(p => ({ ...p, documentType: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none"><option value="passport">Passeport</option><option value="drivers_license">Permis de conduire</option><option value="utility_bill">Facture de services</option><option value="business_registration">Enregistrement entreprise</option></select></div>
              </div>
            </div>
            <div className="px-7 py-4 border-t border-[#2e2e44] flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-[#7b61ff] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer hover:bg-[#6145ff]">{submitting ? '...' : 'Soumettre'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
