'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

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

export default function BlacklistPage() {
  const api = useApi()
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const flash = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await api('/api/v1/robot/blacklist')
    if (res.success) { setItems(res.data?.items || []); setTotal(res.data?.total || 0) }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const handleAdd = async () => {
    if (!phone.trim()) return
    const res = await api('/api/v1/robot/blacklist', { method: 'POST', body: JSON.stringify({ phones: [phone.trim()], reason }) })
    if (res.success) { flash('Numero ajoute'); setAddModal(false); setPhone(''); setReason(''); loadData() }
    else flash(res.error || 'Erreur', 'error')
  }

  const handleDelete = async (id: string) => {
    const res = await api(`/api/v1/robot/blacklist/${id}`, { method: 'DELETE' })
    if (res.success) { flash('Numero retire'); setDeleteId(null); loadData() }
    else flash(res.error || 'Erreur', 'error')
  }

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const phones = text.split(/[\r\n,]+/).map(p => p.trim()).filter(p => /^\+?\d{7,}$/.test(p))
    if (phones.length === 0) { flash('Aucun numero valide', 'error'); return }
    const res = await api('/api/v1/robot/blacklist/import', { method: 'POST', body: JSON.stringify({ phones }) })
    if (res.success) { flash(`${res.data?.added || 0} numeros ajoutes`); loadData() }
    else flash(res.error || 'Erreur', 'error')
  }

  return (
    <div className="w-full">
      {toast && <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg text-sm font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'}`}>{toast.msg}</div>}

      <Link href="/client/robot" className="text-[12px] text-[#7b61ff] no-underline hover:underline mb-4 inline-block">&larr; Retour aux campagnes</Link>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#eeeef8] m-0">Liste noire RGPD — Robot d&apos;appel</h1>
          <p className="text-[12px] text-[#55557a] mt-1 mb-0">Les numeros blacklistes ne seront jamais appeles par vos campagnes robot.</p>
        </div>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-[#18181f] border border-[#2e2e44] text-[#9898b8] rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-[#1e1e2a]">
            Importer CSV
            <input type="file" accept=".csv,.txt" onChange={handleImportCsv} className="hidden" />
          </label>
          <button onClick={() => setAddModal(true)} className="px-4 py-2 bg-[#7b61ff] text-white rounded-lg text-[12px] font-bold cursor-pointer border-none hover:bg-[#6145ff]">Ajouter un numero</button>
        </div>
      </div>

      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
          <div>Numero</div><div>Raison</div><div>Ajoute par</div><div>Date</div><div />
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Aucun numero dans la liste noire.</div>
        ) : items.map((item: any) => (
          <div key={item.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] px-5 py-3 border-b border-[#2e2e44]/60 items-center text-[13px]">
            <div className="text-[#eeeef8] font-mono">{item.phone}</div>
            <div className="text-[#9898b8]">{item.reason || '-'}</div>
            <div className="text-[#9898b8]">{item.user?.name || item.user?.email || '-'}</div>
            <div className="text-[#55557a]">{new Date(item.created_at).toLocaleDateString('fr-CA')}</div>
            <div><button onClick={() => setDeleteId(item.id)} className="text-[11px] text-red-400 bg-transparent border-none cursor-pointer hover:underline">Retirer</button></div>
          </div>
        ))}
      </div>
      {total > 0 && <div className="text-[11px] text-[#55557a] mt-2">{total} numero(s) total</div>}

      {/* Add modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setAddModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[400px]">
            <div className="text-[17px] font-bold text-[#eeeef8] mb-4">Ajouter un numero</div>
            <div className="space-y-3 mb-5">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+15141234567" className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" />
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison (optionnel)" className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setAddModal(false)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
              <button onClick={handleAdd} className="px-5 py-2 bg-[#7b61ff] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setDeleteId(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[400px]">
            <div className="text-[17px] font-bold text-[#eeeef8] mb-4">Retirer ce numero?</div>
            <div className="text-[13px] text-[#9898b8] mb-6">Ce numero pourra a nouveau etre appele par vos campagnes.</div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} className="px-5 py-2 bg-[#ff4d6d] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer">Retirer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
