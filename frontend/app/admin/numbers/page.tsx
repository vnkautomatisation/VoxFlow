'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''
const apiFetch = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(API() + path, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...(opts.headers || {}) }, body: opts.body,
    }); return r.json()
}

interface DIDNumber { sid: string; phoneNumber: string; friendlyName: string; voiceUrl?: string; statusCallback?: string }
interface IVRConfig { id: string; name: string }
interface Queue { id: string; name: string }

export default function NumbersPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [numbers, setNumbers] = useState<DIDNumber[]>([])
    const [ivrs, setIvrs] = useState<IVRConfig[]>([])
    const [queues, setQueues] = useState<Queue[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [selected, setSelected] = useState<DIDNumber | null>(null)
    const [assign, setAssign] = useState<{ ivr: string; queue: string; agentId: string }>({ ivr: '', queue: '', agentId: '' })
    const [saving, setSaving] = useState(false)
    const [agents, setAgents] = useState<any[]>([])

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

    const load = useCallback(async () => {
        try {
            const [nr, ir, qr, ar] = await Promise.all([
                apiFetch('/api/v1/telephony/numbers'),
                apiFetch('/api/v1/admin/ivr'),
                apiFetch('/api/v1/admin/queues'),
                apiFetch('/api/v1/admin/agents'),
            ])
            if (nr.success) setNumbers(nr.data || [])
            if (ir.success) setIvrs(ir.data || [])
            if (qr.success) setQueues(qr.data || [])
            if (ar.success) setAgents(ar.data || [])
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const saveAssignment = async () => {
        if (!selected) return
        setSaving(true)
        try {
            // Assigner l'IVR au numéro via Twilio
            const payload: any = {}
            if (assign.ivr) payload.ivrId = assign.ivr
            if (assign.queue) payload.queueId = assign.queue
            const r = await apiFetch(`/api/v1/telephony/numbers/${selected.sid}/assign`, {
                method: 'POST', body: JSON.stringify(payload)
            })
            if (r.success || r.data) { showToast('Assignation sauvegardée ✓'); setSelected(null) }
            else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement des numéros...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-7xl mx-auto">

            {toast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full text-sm font-bold shadow-xl
          ${toast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Numéros DID</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{numbers.length} numéro{numbers.length > 1 ? 's' : ''} Twilio</div>
                </div>
                <button onClick={() => window.open(`${window.location.origin}/client/numbers`, '_blank')}
                    className="self-start sm:self-auto flex items-center gap-2 bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Commander un numéro
                </button>
            </div>

            {/* Liste numéros */}
            {numbers.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    <p className="text-sm font-medium text-[#55557a]">Aucun numéro Twilio</p>
                    <p className="text-xs text-[#3a3a55] mt-1">Contactez votre administrateur pour ajouter un numéro</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {numbers.map(n => (
                        <div key={n.sid} className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden hover:border-[#3a3a55] transition-all">
                            <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4">
                                {/* Icône téléphone */}
                                <div className="w-10 h-10 rounded-xl bg-[#7b61ff]/15 border border-[#7b61ff]/30 flex items-center justify-center flex-shrink-0">
                                    <svg width="18" height="18" fill="none" stroke="#7b61ff" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                    </svg>
                                </div>

                                {/* Infos numéro */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-[#eeeef8] font-mono text-base sm:text-lg">{n.phoneNumber}</span>
                                        <span className="text-[9px] font-bold bg-emerald-400/15 text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded-full">ACTIF</span>
                                    </div>
                                    <span className="text-[10px] text-[#55557a] truncate block">{n.friendlyName}</span>
                                </div>

                                {/* Bouton assigner */}
                                <button onClick={() => { setSelected(n); setAssign({ ivr: '', queue: '', agentId: '' }) }}
                                    className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors flex-shrink-0">
                                    Assigner
                                </button>
                            </div>

                            {/* Statut simplifié */}
                            <div className="border-t border-[#1f1f2a] px-5 py-3 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${n.voiceUrl ? 'bg-emerald-400' : 'bg-[#3a3a55]'}`} />
                                <span className="text-xs text-[#9898b8]">
                                    {n.voiceUrl ? 'Destination configurée' : 'Aucune destination assignée'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Drawer assignation */}
            {selected && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
                    <div className="w-full sm:w-[440px] max-w-full bg-[#111118] border-l border-[#2e2e44] flex flex-col h-full">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] bg-[#18181f]">
                            <div>
                                <div className="font-bold text-[#eeeef8] font-mono">{selected.phoneNumber}</div>
                                <div className="text-xs text-[#55557a]">Assigner ce numéro</div>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Schéma flux */}
                            <div className="bg-[#1f1f2a] rounded-xl p-4 font-mono text-xs text-[#9898b8] space-y-1">
                                <div className="text-violet-400 font-bold flex items-center gap-1">
                                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                    {selected.phoneNumber}
                                </div>
                                <div className="ml-3 text-[#55557a]">↓</div>
                                {assign.agentId ? (
                                    <div className="ml-3 text-violet-400 flex items-center gap-1">
                                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        {agents.find((a: any) => a.id === assign.agentId)?.name} — EXT {agents.find((a: any) => a.id === assign.agentId)?.extension}
                                    </div>
                                ) : assign.ivr ? (
                                    <>
                                        <div className="ml-3 text-sky-400">IVR → {ivrs.find(i => i.id === assign.ivr)?.name}</div>
                                        <div className="ml-6 text-[#55557a]">↓</div>
                                        <div className="ml-6 text-emerald-400">File d'attente / Agent</div>
                                    </>
                                ) : assign.queue ? (
                                    <div className="ml-3 text-emerald-400">File → {queues.find(q => q.id === assign.queue)?.name}</div>
                                ) : (
                                    <div className="ml-3 text-[#3a3a55] italic">Sélectionnez une destination</div>
                                )}
                            </div>

                            {/* Option 1 — IVR */}
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Option 1 — Menu IVR<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="text-xs text-[#55557a] mb-2">L'appelant passe d'abord par le menu vocal interactif</div>
                                <select value={assign.ivr}
                                    onChange={e => setAssign(p => ({ ...p, ivr: e.target.value, queue: e.target.value ? '' : p.queue }))}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">— Aucun IVR —</option>
                                    {ivrs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>

                            {/* Option 3 — Agent avec extension */}
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Option 3 — Agent direct<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="text-xs text-[#55557a] mb-2">Les appels sonnent directement sur l'extension de cet agent</div>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {agents.filter((a: any) => a.extension).map((a: any) => (
                                        <label key={a.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all
                      ${assign.agentId === a.id ? 'border-violet-400/40 bg-violet-400/10' : 'border-[#2e2e44] bg-[#1f1f2a] hover:border-[#3a3a55]'}`}>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                        ${assign.agentId === a.id ? 'border-[#7b61ff] bg-[#7b61ff]' : 'border-[#3a3a55]'}`}>
                                                {assign.agentId === a.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            <input type="radio" className="hidden" checked={assign.agentId === a.id}
                                                onChange={() => setAssign({ ivr: '', queue: '', agentId: a.id })} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-[#eeeef8]">{a.name}</div>
                                                <div className="text-[10px] text-[#55557a]">{a.email}</div>
                                            </div>
                                            <span className="text-[10px] font-bold font-mono text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded">
                                                EXT {a.extension}
                                            </span>
                                        </label>
                                    ))}
                                    {agents.filter((a: any) => a.extension).length === 0 && (
                                        <div className="text-xs text-[#55557a] italic p-2">Aucun agent avec extension configurée</div>
                                    )}
                                </div>
                            </div>

                            {/* Option 2 — File directe */}
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Option 2 — File directe<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="text-xs text-[#55557a] mb-2">L'appelant est directement mis en attente dans cette file</div>
                                <select value={assign.queue}
                                    onChange={e => setAssign(p => ({ ...p, queue: e.target.value, ivr: e.target.value ? '' : p.ivr }))}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">— Aucune file —</option>
                                    {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                </select>
                            </div>

                            <div className="bg-[#1f1f2a] border border-amber-400/20 rounded-lg p-3 flex items-start gap-2">
                                <svg className="text-amber-400 flex-shrink-0 mt-0.5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                <div className="text-[10px] text-[#9898b8] leading-relaxed">
                                    L'assignation met à jour la configuration Twilio directement. Choisissez IVR <strong>ou</strong> file directe, pas les deux.
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-[#2e2e44] bg-[#18181f] flex gap-3">
                            <button onClick={() => setSelected(null)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={saveAssignment} disabled={saving || (!assign.ivr && !assign.queue && !assign.agentId)}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}