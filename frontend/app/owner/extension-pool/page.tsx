'use client'
import { useState, useEffect } from 'react'
import { PromptModal } from '@/components/shared/VFModal'

const API = () => localStorage.getItem('vf_url') || 'http://localhost:4000'
const TOK = () => localStorage.getItem('vf_tok') || ''
const api = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API() + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...opts.headers as any } })
  return r.json()
}

export default function ExtensionPoolPage() {
  const [data, setData] = useState<{ slots: any[]; counts: Record<string, number> }>({ slots: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  const load = async () => {
    setLoading(true)
    const r = await api('/api/v1/owner/extension-pool' + (filter ? `?status=${filter}` : ''))
    if (r.success) setData(r.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  const [showAllocate, setShowAllocate] = useState(false)
  const [showRelease, setShowRelease] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const allocate = async (vals: Record<string, string>) => {
    const r = await api('/api/v1/owner/extension-pool/allocate', { method: 'POST', body: JSON.stringify({ organization_id: vals.orgId }) })
    setShowAllocate(false)
    if (r.success) { setResult(`Extension ${r.data.extension_number} allouee`); load() }
    else setResult(r.error || 'Erreur')
    setTimeout(() => setResult(null), 3000)
  }

  const release = async (vals: Record<string, string>) => {
    await api('/api/v1/owner/extension-pool/release', { method: 'POST', body: JSON.stringify({ extension_number: vals.ext }) })
    setShowRelease(false)
    load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#eeeef8]">Pool d'extensions</h1>
          <p className="text-xs text-[#55557a]">
            {data.counts.FREE || 0} libres · {data.counts.ALLOCATED || 0} allouees · {data.counts.RESERVED || 0} reservees
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAllocate(true)} className="text-xs bg-[#00d4aa] text-white px-4 py-2 rounded-lg font-bold">Allouer</button>
          <button onClick={() => setShowRelease(true)} className="text-xs bg-[#ff4d6d]/15 text-[#ff4d6d] border border-[#ff4d6d]/30 px-4 py-2 rounded-lg font-bold">Liberer</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'FREE', 'ALLOCATED', 'RESERVED', 'RETIRED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${filter === s ? 'bg-[#7b61ff]/15 border-[#7b61ff]/30 text-[#7b61ff]' : 'border-[#2e2e44] text-[#55557a]'}`}>
            {s || 'Tous'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-xs text-[#55557a] py-8 text-center">Chargement...</div> : (
        <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 gap-1">
          {data.slots.slice(0, 200).map((s: any) => (
            <div key={s.id} title={`${s.extension_number} — ${s.status}${s.organization_id ? ` (${s.organization_id})` : ''}`}
              className={`text-center text-[9px] font-mono py-1 rounded ${
                s.status === 'FREE'      ? 'bg-[#00d4aa]/10 text-[#00d4aa]' :
                s.status === 'ALLOCATED' ? 'bg-[#7b61ff]/15 text-[#7b61ff]' :
                s.status === 'RESERVED'  ? 'bg-[#ffb547]/15 text-[#ffb547]' :
                'bg-[#2e2e44]/30 text-[#35355a]'
              }`}>
              {s.extension_number}
            </div>
          ))}
        </div>
      )}
      {!loading && data.slots.length > 200 && <div className="text-[10px] text-[#55557a] text-center mt-2">Affiche 200 / {data.slots.length}</div>}

      {result && <div className="fixed bottom-6 right-6 bg-[#18181f] border border-[#2e2e44] rounded-xl px-4 py-2.5 text-sm text-[#eeeef8] shadow-xl z-50">{result}</div>}

      {showAllocate && (
        <PromptModal title="Allouer une extension" fields={[
          { key: 'orgId', label: 'Organization ID', placeholder: 'org_test_001', required: true },
        ]} submitLabel="Allouer" onSubmit={allocate} onCancel={() => setShowAllocate(false)} />
      )}
      {showRelease && (
        <PromptModal title="Liberer une extension" fields={[
          { key: 'ext', label: 'Numero extension', placeholder: '201', required: true },
        ]} submitLabel="Liberer" onSubmit={release} onCancel={() => setShowRelease(false)} />
      )}
    </div>
  )
}
