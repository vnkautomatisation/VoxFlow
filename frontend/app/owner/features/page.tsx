'use client'
import { useState, useEffect } from 'react'

const API = () => localStorage.getItem('vf_url') || 'http://localhost:4000'
const TOK = () => localStorage.getItem('vf_tok') || ''
const api = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API() + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...opts.headers as any } })
  return r.json()
}

export default function FeaturesPage() {
  const [data, setData] = useState<{ allFeatures: string[]; plans: any[] }>({ allFeatures: [], plans: [] })
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState('')

  const load = async () => {
    setLoading(true)
    const r = await api('/api/v1/owner/features')
    if (r.success) setData(r.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggle = async (planId: string, feature: string, current: boolean) => {
    setToggling(`${planId}-${feature}`)
    await api(`/api/v1/owner/features/${planId}/${feature}`, { method: 'PUT', body: JSON.stringify({ enabled: !current }) })
    await load()
    setToggling('')
  }

  if (loading) return <div className="p-8 text-[#55557a] text-sm">Chargement...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-[#eeeef8] mb-1">Feature Flags</h1>
      <p className="text-xs text-[#55557a] mb-6">{data.allFeatures.length} features × {data.plans.length} plans</p>

      <div className="overflow-x-auto rounded-xl border border-[#2e2e44]">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[#18181f]">
              <th className="text-left p-3 text-[#55557a] font-bold uppercase tracking-wider sticky left-0 bg-[#18181f] z-10 min-w-[180px]">Feature</th>
              {data.plans.map(p => (
                <th key={p.id} className="p-3 text-center text-[#9898b8] font-bold min-w-[90px]">{p.name || p.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.allFeatures.map((feat, i) => (
              <tr key={feat} className={i % 2 === 0 ? 'bg-[#111118]' : 'bg-[#0e0e16]'}>
                <td className="p-2.5 text-[#9898b8] font-mono sticky left-0 z-10" style={{ background: i % 2 === 0 ? '#111118' : '#0e0e16' }}>{feat}</td>
                {data.plans.map(p => {
                  const on = p.features?.[feat] === true
                  const key = `${p.id}-${feat}`
                  return (
                    <td key={key} className="p-2 text-center">
                      <button onClick={() => toggle(p.id, feat, on)} disabled={toggling === key}
                        className={`w-8 h-5 rounded-full transition-colors ${on ? 'bg-[#00d4aa]' : 'bg-[#2e2e44]'} ${toggling === key ? 'opacity-50' : ''}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
