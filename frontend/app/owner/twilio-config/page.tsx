'use client'
import { useState, useEffect } from 'react'

const API = () => localStorage.getItem('vf_url') || 'http://localhost:4000'
const TOK = () => localStorage.getItem('vf_tok') || ''
const api = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API() + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...opts.headers as any } })
  return r.json()
}

export default function TwilioConfigPage() {
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ orgId: '', account_sid: '', auth_token: '', twiml_app_sid: '', api_key_sid: '', api_secret: '', friendly_name: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await api('/api/v1/owner/twilio-config')
    if (r.success) setConfigs(r.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.orgId || !form.account_sid || !form.auth_token) return
    setSaving(true)
    await api(`/api/v1/owner/twilio-config/${form.orgId}`, { method: 'POST', body: JSON.stringify(form) })
    setSaving(false)
    setShowForm(false)
    load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#eeeef8]">Configuration Twilio</h1>
          <p className="text-xs text-[#55557a]">Subcomptes Twilio par organisation</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="text-xs bg-[#7b61ff] text-white px-4 py-2 rounded-lg font-bold">
          {showForm ? 'Annuler' : '+ Configurer'}
        </button>
      </div>

      {showForm && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-6 space-y-3">
          {[
            { key: 'orgId', label: 'Organization ID', ph: 'org_test_001' },
            { key: 'account_sid', label: 'Account SID', ph: 'AC...' },
            { key: 'auth_token', label: 'Auth Token', ph: 'Secret' },
            { key: 'twiml_app_sid', label: 'TwiML App SID', ph: 'AP...' },
            { key: 'api_key_sid', label: 'API Key SID', ph: 'SK...' },
            { key: 'api_secret', label: 'API Secret', ph: 'Secret' },
            { key: 'friendly_name', label: 'Nom', ph: 'Mon organisation' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph} type={f.key.includes('token') || f.key.includes('secret') ? 'password' : 'text'}
                className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
            </div>
          ))}
          <button onClick={save} disabled={saving} className="bg-[#7b61ff] text-white px-6 py-2 rounded-lg text-sm font-bold">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      )}

      {loading ? <div className="text-xs text-[#55557a] py-8 text-center">Chargement...</div> : (
        <div className="space-y-2">
          {configs.map((c: any) => (
            <div key={c.id} className="bg-[#18181f] border border-[#2e2e44] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-[#eeeef8]">{c.friendly_name || c.organization_id}</div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-[#00d4aa]/15 text-[#00d4aa]' : 'bg-[#ff4d6d]/15 text-[#ff4d6d]'}`}>{c.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-[#55557a]">Org:</span> <span className="text-[#9898b8] font-mono">{c.organization_id}</span></div>
                <div><span className="text-[#55557a]">SID:</span> <span className="text-[#9898b8] font-mono">{c.account_sid}</span></div>
                {c.twiml_app_sid && <div><span className="text-[#55557a]">TwiML:</span> <span className="text-[#9898b8] font-mono">{c.twiml_app_sid}</span></div>}
                {c.default_caller_id && <div><span className="text-[#55557a]">CallerID:</span> <span className="text-[#9898b8]">{c.default_caller_id}</span></div>}
              </div>
            </div>
          ))}
          {configs.length === 0 && <div className="text-xs text-[#35355a] text-center py-8 border border-dashed border-[#2e2e44] rounded-xl">Aucune configuration Twilio</div>}
        </div>
      )}
    </div>
  )
}
