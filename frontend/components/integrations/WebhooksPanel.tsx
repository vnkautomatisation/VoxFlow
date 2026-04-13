"use client"

import { useState } from "react"
import { integrationsApi } from "@/lib/integrationsApi"

const WEBHOOK_EVENTS = [
  "call.started", "call.completed", "call.missed",
  "contact.created", "contact.updated",
  "conversation.created", "conversation.resolved",
  "campaign.completed",
]

interface Props {
  token:     string
  webhooks:  any[]
  onRefresh: () => void
}

export default function WebhooksPanel({ token, webhooks, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] })
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [logs,    setLogs]    = useState<Record<string, any[]>>({})
  const [showLogs, setShowLogs] = useState<string | null>(null)
  const [delConfirm, setDelConfirm] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", url: "", events: [] as string[] })

  const startEdit = (wh: any) => {
    setEditId(wh.id)
    setEditForm({ name: wh.name, url: wh.url, events: wh.events || [] })
  }

  const handleUpdate = async () => {
    if (!editId || !editForm.name || !editForm.url) return
    setSaving(true)
    try {
      await integrationsApi.updateWebhook(token, editId, editForm)
      setEditId(null)
      onRefresh()
    } catch {}
    setSaving(false)
  }

  const toggleEditEvent = (ev: string) => {
    setEditForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev]
    }))
  }

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev]
    }))
  }

  const handleCreate = async () => {
    if (!form.name || !form.url || form.events.length === 0) return
    setSaving(true)
    try {
      await integrationsApi.createWebhook(token, form)
      setShowForm(false)
      setForm({ name: "", url: "", events: [] })
      onRefresh()
    } catch {}
    finally { setSaving(false) }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try { await integrationsApi.testWebhook(token, id) } catch {}
    finally { setTesting(null) }
  }

  const handleShowLogs = async (id: string) => {
    if (showLogs === id) { setShowLogs(null); return }
    const res = await integrationsApi.getWebhookLogs(token, id)
    if (res.success) setLogs((prev) => ({ ...prev, [id]: res.data }))
    setShowLogs(id)
  }

  const handleDelete = async (id: string) => {
    await integrationsApi.deleteWebhook(token, id)
    setDelConfirm(null)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#9898b8]">{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""}</div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-[#7b61ff] hover:bg-[#6145ff] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5"  y1="12" x2="19" y2="12" />
          </svg>
          Nouveau webhook
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
          <h3 className="text-[#eeeef8] font-bold text-sm mb-4">Nouveau webhook sortant</h3>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mon webhook Zapier"
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">URL</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://hooks.zapier.com/..."
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors font-mono"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-2">Événements à écouter</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                    form.events.includes(ev)
                      ? "border-[#7b61ff]/40 bg-[#7b61ff]/10 text-[#7b61ff]"
                      : "border-[#2e2e44] text-[#55557a] hover:text-[#9898b8] hover:border-[#3a3a55]"
                  }`}
                >{ev}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)}
              className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-sm font-bold hover:text-[#eeeef8] transition-colors"
            >
              Annuler
            </button>
            <button onClick={handleCreate} disabled={saving || !form.name || !form.url || form.events.length === 0}
              className="flex-1 bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? "Création..." : "Créer le webhook"}
            </button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 ? (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#2e2e44] mx-auto mb-3">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <p className="text-[#9898b8] text-sm font-medium">Aucun webhook configuré</p>
          <p className="text-[#55557a] text-xs mt-1">
            Les webhooks envoient des événements vers Zapier, Make, n8n, ou votre propre serveur
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${wh.is_active ? "bg-emerald-400" : "bg-[#55557a]"}`}
                      style={{ boxShadow: wh.is_active ? "0 0 8px #34d399" : undefined }}
                    />
                    <p className="text-[#eeeef8] font-semibold text-sm truncate">{wh.name}</p>
                    {wh.is_active && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">
                        Actif
                      </span>
                    )}
                  </div>
                  <p className="text-[#55557a] text-[11px] font-mono truncate">{wh.url}</p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(wh)}
                    className="text-[10px] font-bold bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-2.5 py-1 rounded-lg hover:text-[#eeeef8] hover:border-[#7b61ff]/30 transition-colors"
                  >Editer</button>
                  <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id}
                    className="text-[10px] font-bold bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-2.5 py-1 rounded-lg hover:text-[#7b61ff] hover:border-[#7b61ff]/30 transition-colors"
                  >
                    {testing === wh.id ? "..." : "Tester"}
                  </button>
                  <button onClick={() => handleShowLogs(wh.id)}
                    className={`text-[10px] font-bold border px-2.5 py-1 rounded-lg transition-colors ${
                      showLogs === wh.id
                        ? "border-[#7b61ff]/40 bg-[#7b61ff]/10 text-[#7b61ff]"
                        : "bg-[#1f1f2a] border-[#2e2e44] text-[#9898b8] hover:text-[#eeeef8]"
                    }`}
                  >
                    Logs
                  </button>
                  {delConfirm === wh.id ? (
                    <>
                      <button onClick={() => setDelConfirm(null)}
                        className="text-[10px] font-bold bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-2.5 py-1 rounded-lg hover:text-[#eeeef8]"
                      >Annuler</button>
                      <button onClick={() => handleDelete(wh.id)}
                        className="text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg"
                      >Confirmer</button>
                    </>
                  ) : (
                    <button onClick={() => setDelConfirm(wh.id)}
                      className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 hover:bg-rose-400/20 px-2.5 py-1 rounded-lg transition-colors"
                    >Supprimer</button>
                  )}
                </div>
              </div>

              {/* Events list */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(wh.events || []).map((ev: string) => (
                  <span key={ev} className="text-[9px] font-bold bg-[#2e2e44] text-[#9898b8] px-1.5 py-0.5 rounded">
                    {ev}
                  </span>
                ))}
              </div>

              {/* Last triggered */}
              {wh.last_triggered_at && (
                <p className="text-[10px] text-[#55557a]">
                  Dernier envoi: <span className="font-mono text-[#9898b8]">{new Date(wh.last_triggered_at).toLocaleString("fr-CA")}</span>
                  {wh.last_status && (
                    <span className={wh.last_status === "SUCCESS" ? " text-emerald-400 ml-2" : " text-rose-400 ml-2"}>
                      · {wh.last_status}
                    </span>
                  )}
                </p>
              )}

              {/* Logs expand */}
              {showLogs === wh.id && logs[wh.id] && (
                <div className="mt-3 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg overflow-hidden">
                  {logs[wh.id].length === 0 ? (
                    <p className="text-[#55557a] text-[11px] p-3 text-center">Aucun log pour ce webhook</p>
                  ) : (
                    <div className="divide-y divide-[#2e2e44]">
                      {logs[wh.id].slice(0, 5).map((log: any) => (
                        <div key={log.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[#eeeef8] text-[11px] font-mono truncate">{log.event}</p>
                            <p className="text-[#55557a] text-[10px] mt-0.5">{new Date(log.created_at).toLocaleString("fr-CA")}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono text-[#55557a]">{log.status_code}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              log.success
                                ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                                : "bg-rose-400/10 text-rose-400 border border-rose-400/30"
                            }`}>
                              {log.success ? "OK" : "FAIL"}
                            </span>
                            <span className="text-[10px] font-mono text-[#55557a]">{log.duration_ms}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* ── MODAL EDIT WEBHOOK ── */}
      {editId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setEditId(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 pt-6 pb-2">
              <div className="font-bold text-[#eeeef8] mb-4">Modifier le webhook</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom</label>
                  <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">URL</label>
                  <input value={editForm.url} onChange={e => setEditForm(p => ({ ...p, url: e.target.value }))}
                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] font-mono outline-none focus:border-[#7b61ff]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Evenements</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEBHOOK_EVENTS.map(ev => (
                      <button key={ev} type="button" onClick={() => toggleEditEvent(ev)}
                        className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-colors ${editForm.events.includes(ev) ? 'bg-[#7b61ff]/15 border-[#7b61ff]/40 text-[#7b61ff]' : 'bg-[#1f1f2a] border-[#2e2e44] text-[#55557a] hover:text-[#9898b8]'}`}>
                        {ev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3">
              <button onClick={() => setEditId(null)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] py-2.5 rounded-xl text-sm font-bold hover:text-[#eeeef8] transition-colors">Annuler</button>
              <button onClick={handleUpdate} disabled={saving}
                className="flex-1 bg-[#7b61ff] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
