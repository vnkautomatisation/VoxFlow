'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''

const apiFetch = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(API() + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...(opts.headers || {}) },
        body: opts.body,
    })
    return r.json()
}

const fmtT = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtD = (dt: string) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STRATEGIES = [
    { value: 'ROUND_ROBIN', label: 'Tour de rôle', desc: 'Distribution cyclique entre agents' },
    { value: 'LEAST_BUSY', label: 'Moins occupé', desc: 'Agent avec le moins d\'appels actifs' },
    { value: 'PRIORITY', label: 'Priorité', desc: 'Par ordre de priorité défini' },
    { value: 'SKILLS_BASED', label: 'Compétences', desc: 'Selon les skills de l\'agent' },
    { value: 'RANDOM', label: 'Aléatoire', desc: 'Distribution aléatoire' },
]

interface Queue {
    id: string; name: string; description?: string
    strategy: string; max_wait_time: number
    welcome_message?: string; status?: string
    created_at: string; priority?: number
    sla_threshold?: number; is_vip?: boolean
    callback_enabled?: boolean
    realtime?: { waiting: number; onlineAgents: number; busyAgents: number; slaRate: number; todayAnswered: number }
}

interface Agent { id: string; name: string; email: string; extension?: string }

const EMPTY_FORM = {
    name: '', description: '', strategy: 'ROUND_ROBIN',
    max_wait_time: 300, sla_threshold: 20,
    welcome_message: '', priority: 1,
    is_vip: false, callback_enabled: true,
}

export default function QueuesPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [queues, setQueues] = useState<Queue[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null)
    const [showDrawer, setShowDrawer] = useState(false)
    const [showNewModal, setShowNewModal] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [editForm, setEditForm] = useState<any>({})
    const [saving, setSaving] = useState(false)
    const [delConfirm, setDelConfirm] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [queueAgents, setQueueAgents] = useState<string[]>([])

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const load = useCallback(async () => {
        try {
            const [qr, ar] = await Promise.all([
                apiFetch('/api/v1/admin/queues'),
                apiFetch('/api/v1/admin/agents'),
            ])
            if (qr.success) setQueues(qr.data || [])
            if (ar.success) setAgents(ar.data || [])
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
        const poll = setInterval(load, 15000)
        return () => clearInterval(poll)
    }, [isAuth, load])

    const openDrawer = (queue: Queue) => {
        setSelectedQueue(queue)
        setEditForm({
            name: queue.name,
            description: queue.description || '',
            strategy: queue.strategy,
            max_wait_time: queue.max_wait_time || 300,
            sla_threshold: queue.sla_threshold || 20,
            welcome_message: queue.welcome_message || '',
            priority: queue.priority || 1,
            is_vip: queue.is_vip || false,
            callback_enabled: queue.callback_enabled !== false,
        })
        // Agents assignés à cette file
        const assigned = agents.filter(a => (a as any).queue_ids?.includes(queue.id)).map(a => a.id)
        setQueueAgents(assigned)
        setShowDrawer(true)
    }

    const saveQueue = async () => {
        if (!selectedQueue) return
        setSaving(true)
        try {
            const r = await apiFetch(`/api/v1/admin/queues/${selectedQueue.id}`, {
                method: 'PATCH', body: JSON.stringify(editForm),
            })
            if (r.success || r.data) { showToast('File mise à jour ✓'); setShowDrawer(false); load() }
            else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const createQueue = async () => {
        if (!form.name) { showToast('Nom requis', 'err'); return }
        setSaving(true)
        try {
            const r = await apiFetch('/api/v1/admin/queues', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name, description: form.description,
                    strategy: form.strategy, maxWaitTime: form.max_wait_time,
                    welcomeMessage: form.welcome_message,
                }),
            })
            if (r.success || r.data) {
                showToast('File créée ✓'); setShowNewModal(false)
                setForm(EMPTY_FORM); load()
            } else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const deleteQueue = async (id: string) => {
        try {
            const r = await apiFetch(`/api/v1/admin/queues/${id}`, { method: 'DELETE' })
            if (r.success || r.deleted) { showToast('File supprimée'); setShowDrawer(false); setDelConfirm(null); load() }
            else showToast(r.error || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
    }

    // Stats globales
    const totalWaiting = queues.reduce((s, q) => s + (q.realtime?.waiting || 0), 0)
    const totalAgentsOnline = queues.reduce((s, q) => s + (q.realtime?.onlineAgents || 0), 0)
    const avgSLA = queues.length ? Math.round(queues.reduce((s, q) => s + (q.realtime?.slaRate || 0), 0) / queues.length) : 0

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement des files...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-7xl mx-auto">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full text-sm font-bold shadow-xl
          ${toast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Files d'attente</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{queues.length} file{queues.length > 1 ? 's' : ''} · Mise à jour toutes les 15s</div>
                </div>
                <button onClick={() => setShowNewModal(true)}
                    className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors flex items-center gap-2">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Nouvelle file
                </button>
            </div>

            {/* KPIs globaux */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                    <div className="text-2xl font-bold font-mono text-amber-400">{totalWaiting}</div>
                    <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mt-1">En attente total</div>
                </div>
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                    <div className="text-2xl font-bold font-mono text-emerald-400">{totalAgentsOnline}</div>
                    <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mt-1">Agents disponibles</div>
                </div>
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                    <div className={`text-2xl font-bold font-mono ${avgSLA >= 80 ? 'text-emerald-400' : avgSLA >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>{avgSLA}%</div>
                    <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mt-1">SLA moyen</div>
                </div>
            </div>

            {/* Liste des files */}
            {queues.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <p className="text-sm font-medium text-[#55557a]">Aucune file d'attente</p>
                    <button onClick={() => setShowNewModal(true)} className="text-xs text-[#7b61ff] hover:underline mt-2">Créer la première file</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {queues.map(q => {
                        const strategy = STRATEGIES.find(s => s.value === q.strategy)
                        const rt = q.realtime
                        const slaOk = rt ? rt.slaRate >= (q.sla_threshold || 80) : true
                        return (
                            <div key={q.id} className={`bg-[#18181f] border rounded-xl overflow-hidden transition-all hover:border-[#3a3a55]
                ${q.is_vip ? 'border-violet-400/40' : 'border-[#2e2e44]'}`}>
                                {/* Header file */}
                                <div className="flex items-center gap-4 px-5 py-4">
                                    {/* Statut dot */}
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${q.status === 'ACTIVE' || !q.status ? 'bg-emerald-400' : 'bg-zinc-500'}`}
                                        style={{ boxShadow: '0 0 8px rgba(0,212,170,.5)' }} />

                                    {/* Infos */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-[#eeeef8]">{q.name}</span>
                                            {q.is_vip && <span className="text-[9px] font-bold bg-violet-400/15 text-violet-400 border border-violet-400/30 px-1.5 py-0.5 rounded">VIP</span>}
                                            {q.callback_enabled && <span className="text-[9px] font-bold bg-sky-400/15 text-sky-400 border border-sky-400/30 px-1.5 py-0.5 rounded">Callback</span>}
                                            <span className="text-[10px] text-[#55557a]">{strategy?.label || q.strategy}</span>
                                        </div>
                                        {q.description && <div className="text-xs text-[#55557a] mt-0.5">{q.description}</div>}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => openDrawer(q)}
                                            className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors">
                                            Modifier
                                        </button>
                                        <button onClick={() => setDelConfirm(delConfirm === q.id ? null : q.id)}
                                            className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 rounded-lg hover:bg-rose-400/20 transition-colors">
                                            Supprimer
                                        </button>
                                    </div>
                                </div>

                                {/* Confirmation suppression */}
                                {delConfirm === q.id && (
                                    <div className="mx-5 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-center justify-between gap-3">
                                        <span className="text-sm text-rose-400">Supprimer "{q.name}" définitivement ?</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => setDelConfirm(null)} className="text-xs bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-1.5 rounded-lg">Annuler</button>
                                            <button onClick={() => deleteQueue(q.id)} className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition-colors">Confirmer</button>
                                        </div>
                                    </div>
                                )}

                                {/* Stats temps réel */}
                                <div className="border-t border-[#1f1f2a] grid grid-cols-5 divide-x divide-[#1f1f2a]">
                                    {[
                                        { label: 'En attente', val: rt?.waiting ?? 0, color: (rt?.waiting ?? 0) > 0 ? 'text-amber-400' : 'text-[#9898b8]' },
                                        { label: 'Agents dispo', val: rt?.onlineAgents ?? 0, color: (rt?.onlineAgents ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400' },
                                        { label: 'En appel', val: rt?.busyAgents ?? 0, color: 'text-sky-400' },
                                        { label: 'SLA', val: (rt?.slaRate ?? 100) + '%', color: slaOk ? 'text-emerald-400' : 'text-rose-400' },
                                        { label: 'Répondus auj.', val: rt?.todayAnswered ?? 0, color: 'text-violet-400' },
                                    ].map(s => (
                                        <div key={s.label} className="py-3 px-4 text-center">
                                            <div className={`text-lg font-bold font-mono ${s.color}`}>{s.val}</div>
                                            <div className="text-[9px] text-[#55557a] uppercase tracking-wider mt-0.5">{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Agents assignés */}
                                <div className="border-t border-[#1f1f2a] px-5 py-3 flex items-center gap-3">
                                    <span className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider">Agents :</span>
                                    {agents.filter(a => (a as any).queue_ids?.includes(q.id)).length === 0 ? (
                                        <span className="text-xs text-[#55557a] italic">Aucun agent assigné</span>
                                    ) : (
                                        <div className="flex gap-1.5 flex-wrap">
                                            {agents.filter(a => (a as any).queue_ids?.includes(q.id)).map(a => (
                                                <span key={a.id} className="text-[10px] font-medium bg-[#2e2e44] text-[#9898b8] px-2 py-0.5 rounded-full">
                                                    {a.name}{a.extension ? ` (${a.extension})` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="ml-auto text-[10px] text-[#55557a]">
                                        Attente max : {fmtT(q.max_wait_time || 300)} · Créée le {fmtD(q.created_at)}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── DRAWER MODIFIER ── */}
            {showDrawer && selectedQueue && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
                    <div className="w-[480px] bg-[#111118] border-l border-[#2e2e44] flex flex-col h-full">

                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] bg-[#18181f]">
                            <div>
                                <div className="font-bold text-[#eeeef8]">{selectedQueue.name}</div>
                                <div className="text-xs text-[#55557a]">Modifier la file d'attente</div>
                            </div>
                            <button onClick={() => setShowDrawer(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Infos de base */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Informations<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom de la file</label>
                                        <input value={editForm.name || ''} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Description</label>
                                        <input value={editForm.description || ''} onChange={e => setEditForm((p: any) => ({ ...p, description: e.target.value }))}
                                            placeholder="Support technique, ventes, etc."
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Message d'accueil</label>
                                        <textarea value={editForm.welcome_message || ''} onChange={e => setEditForm((p: any) => ({ ...p, welcome_message: e.target.value }))}
                                            rows={2} placeholder="Bienvenue, votre appel est important..."
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-none" />
                                    </div>
                                </div>
                            </section>

                            {/* Stratégie */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Routage<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="space-y-2">
                                    {STRATEGIES.map(s => (
                                        <label key={s.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${editForm.strategy === s.value ? 'border-violet-400/40 bg-violet-400/8' : 'border-[#2e2e44] bg-[#1f1f2a] hover:border-[#3a3a55]'}`}>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all
                        ${editForm.strategy === s.value ? 'border-[#7b61ff] bg-[#7b61ff]' : 'border-[#3a3a55]'}`}>
                                                {editForm.strategy === s.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            <input type="radio" className="hidden" checked={editForm.strategy === s.value}
                                                onChange={() => setEditForm((p: any) => ({ ...p, strategy: s.value }))} />
                                            <div>
                                                <div className="text-sm font-medium text-[#eeeef8]">{s.label}</div>
                                                <div className="text-[10px] text-[#55557a]">{s.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </section>

                            {/* Paramètres */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Paramètres<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Attente max (sec)</label>
                                        <input type="number" min="30" max="3600"
                                            value={editForm.max_wait_time || 300}
                                            onChange={e => setEditForm((p: any) => ({ ...p, max_wait_time: parseInt(e.target.value) }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                        <div className="text-[10px] text-[#55557a] mt-1">= {fmtT(editForm.max_wait_time || 300)}</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">SLA cible (sec)</label>
                                        <input type="number" min="10" max="300"
                                            value={editForm.sla_threshold || 20}
                                            onChange={e => setEditForm((p: any) => ({ ...p, sla_threshold: parseInt(e.target.value) }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                        <div className="text-[10px] text-[#55557a] mt-1">Réponse avant {editForm.sla_threshold || 20}s</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Priorité (1-10)</label>
                                        <input type="number" min="1" max="10"
                                            value={editForm.priority || 1}
                                            onChange={e => setEditForm((p: any) => ({ ...p, priority: parseInt(e.target.value) }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                    <div className="flex flex-col gap-2 justify-end pb-1">
                                        {[
                                            { key: 'is_vip', label: 'File VIP' },
                                            { key: 'callback_enabled', label: 'Callback activé' },
                                        ].map(opt => (
                                            <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                                                <div className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0
                          ${(editForm as any)[opt.key] ? 'bg-[#7b61ff]' : 'bg-[#2e2e44]'}`}
                                                    onClick={() => setEditForm((p: any) => ({ ...p, [opt.key]: !(p as any)[opt.key] }))}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all
                            ${(editForm as any)[opt.key] ? 'left-4' : 'left-0.5'}`} />
                                                </div>
                                                <span className="text-xs text-[#9898b8]">{opt.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Agents assignés */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Agents assignés<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="text-xs text-[#55557a] bg-[#1f1f2a] rounded-lg p-3">
                                    Pour assigner des agents à cette file, modifiez l'agent depuis la page <button onClick={() => router.push('/admin/agents')} className="text-[#7b61ff] hover:underline">Agents</button> et cochez cette file.
                                </div>
                            </section>

                            {/* Zone danger */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500/60 mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-rose-500/20" />Zone dangereuse<div className="flex-1 h-px bg-rose-500/20" />
                                </div>
                                {delConfirm === selectedQueue.id ? (
                                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                                        <p className="text-sm text-rose-400 font-medium mb-3">Supprimer "{selectedQueue.name}" ?</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => setDelConfirm(null)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-2 rounded-lg text-xs font-bold">Annuler</button>
                                            <button onClick={() => deleteQueue(selectedQueue.id)} className="flex-1 bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Supprimer</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setDelConfirm(selectedQueue.id)}
                                        className="w-full text-rose-400 border border-rose-400/30 bg-rose-400/5 px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-rose-400/15 transition-colors">
                                        Supprimer cette file
                                    </button>
                                )}
                            </section>
                        </div>

                        <div className="px-6 py-4 border-t border-[#2e2e44] bg-[#18181f] flex gap-3">
                            <button onClick={() => setShowDrawer(false)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={saveQueue} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL NOUVELLE FILE ── */}
            {showNewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44]">
                            <h3 className="font-bold text-[#eeeef8]">Nouvelle file d'attente</h3>
                            <button onClick={() => setShowNewModal(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom *</label>
                                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Support technique"
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Description</label>
                                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Description optionnelle"
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Stratégie</label>
                                <select value={form.strategy} onChange={e => setForm(p => ({ ...p, strategy: e.target.value }))}
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Attente max (sec)</label>
                                    <input type="number" value={form.max_wait_time}
                                        onChange={e => setForm(p => ({ ...p, max_wait_time: parseInt(e.target.value) }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">SLA cible (sec)</label>
                                    <input type="number" value={form.sla_threshold}
                                        onChange={e => setForm(p => ({ ...p, sla_threshold: parseInt(e.target.value) }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Message d'accueil</label>
                                <input value={form.welcome_message} onChange={e => setForm(p => ({ ...p, welcome_message: e.target.value }))}
                                    placeholder="Bienvenue, votre appel est important..."
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                            </div>
                            <div className="flex gap-4">
                                {[{ key: 'is_vip', label: 'File VIP' }, { key: 'callback_enabled', label: 'Callback' }].map(opt => (
                                    <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                                        <div className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0
                      ${(form as any)[opt.key] ? 'bg-[#7b61ff]' : 'bg-[#2e2e44]'}`}
                                            onClick={() => setForm(p => ({ ...p, [opt.key]: !(p as any)[opt.key] }))}>
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all
                        ${(form as any)[opt.key] ? 'left-4' : 'left-0.5'}`} />
                                        </div>
                                        <span className="text-xs text-[#9898b8]">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-3">
                            <button onClick={() => setShowNewModal(false)} className="flex-1 bg-[#111118] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={createQueue} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Création...' : 'Créer la file'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}