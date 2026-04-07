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

const fmtD = (dt: string) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
}

const NODE_ICONS: Record<string, React.ReactNode> = {
    menu: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    queue: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    message: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></svg>,
    voicemail: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="5.5" cy="11.5" r="4.5" /><circle cx="18.5" cy="11.5" r="4.5" /><line x1="9" y1="16" x2="15" y2="16" /></svg>,
    transfer: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>,
    hangup: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.19" /><line x1="23" y1="1" x2="1" y2="23" /></svg>,
}

const NODE_TYPES = [
    { value: 'menu', label: 'Menu', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/30', desc: 'Menu à choix multiples (Appuyez sur 1, 2...)' },
    { value: 'queue', label: 'File d\'attente', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', desc: 'Transférer vers une file d\'attente' },
    { value: 'message', label: 'Message', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30', desc: 'Lire un message préenregistré ou TTS' },
    { value: 'voicemail', label: 'Messagerie', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', desc: 'Laisser un message vocal' },
    { value: 'transfer', label: 'Transfert', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30', desc: 'Transférer vers un numéro externe' },
    { value: 'hangup', label: 'Raccrocher', color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-400/30', desc: 'Terminer l\'appel' },
]

interface IVRNode {
    id: string; type: string; label: string
    message?: string; digit?: string
    target?: string; children?: IVRNode[]
}

interface IVRConfig {
    id: string; name: string; welcome_message?: string
    timeout: number; max_retries: number
    nodes: IVRNode[]; created_at: string; updated_at?: string
}

interface Queue { id: string; name: string }

const genId = () => Math.random().toString(36).substring(2, 10)

const EMPTY_FORM = {
    name: '', welcome_message: 'Bienvenue chez VoxFlow. Votre appel est important pour nous.',
    timeout: 5, max_retries: 3,
}

const EMPTY_NODE: Omit<IVRNode, 'id'> = {
    type: 'menu', label: 'Nouveau nœud', digit: '1',
    message: '', target: '', children: [],
}

export default function IVRPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [ivrs, setIvrs] = useState<IVRConfig[]>([])
    const [queues, setQueues] = useState<Queue[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIVR, setSelectedIVR] = useState<IVRConfig | null>(null)
    const [showDrawer, setShowDrawer] = useState(false)
    const [showNewModal, setShowNewModal] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [editForm, setEditForm] = useState<any>({})
    const [nodes, setNodes] = useState<IVRNode[]>([])
    const [saving, setSaving] = useState(false)
    const [delConfirm, setDelConfirm] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [selectedNode, setSelectedNode] = useState<IVRNode | null>(null)
    const [showNodeEditor, setShowNodeEditor] = useState(false)

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const load = useCallback(async () => {
        try {
            const [ir, qr] = await Promise.all([
                apiFetch('/api/v1/admin/ivr'),
                apiFetch('/api/v1/admin/queues'),
            ])
            if (ir.success) setIvrs(ir.data || [])
            if (qr.success) setQueues(qr.data || [])
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const openDrawer = (ivr: IVRConfig) => {
        setSelectedIVR(ivr)
        setEditForm({
            name: ivr.name,
            welcome_message: ivr.welcome_message || '',
            timeout: ivr.timeout || 5,
            max_retries: ivr.max_retries || 3,
        })
        setNodes(ivr.nodes || [])
        setSelectedNode(null)
        setShowDrawer(true)
    }

    const saveIVR = async () => {
        if (!selectedIVR) return
        setSaving(true)
        try {
            const r = await apiFetch(`/api/v1/admin/ivr/${selectedIVR.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ ...editForm, nodes }),
            })
            if (r.success || r.data) { showToast('IVR mis à jour ✓'); setShowDrawer(false); load() }
            else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const createIVR = async () => {
        if (!form.name) { showToast('Nom requis', 'err'); return }
        setSaving(true)
        try {
            const r = await apiFetch('/api/v1/admin/ivr', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name,
                    welcomeMessage: form.welcome_message,
                    nodes: [],
                }),
            })
            if (r.success || r.data) {
                showToast('IVR créé ✓')
                setShowNewModal(false)
                setForm(EMPTY_FORM)
                load()
            } else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    // Gestion des nœuds
    const addNode = () => {
        const newNode: IVRNode = { ...EMPTY_NODE, id: genId(), children: [] }
        setNodes(prev => [...prev, newNode])
        setSelectedNode(newNode)
        setShowNodeEditor(true)
    }

    const updateNode = (id: string, updates: Partial<IVRNode>) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n))
        if (selectedNode?.id === id) setSelectedNode(prev => prev ? { ...prev, ...updates } : prev)
    }

    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id))
        if (selectedNode?.id === id) { setSelectedNode(null); setShowNodeEditor(false) }
    }

    const addChildNode = (parentId: string) => {
        const child: IVRNode = { ...EMPTY_NODE, id: genId(), digit: String(nodes.find(n => n.id === parentId)?.children?.length || 0 + 1), children: [] }
        setNodes(prev => prev.map(n => n.id === parentId ? { ...n, children: [...(n.children || []), child] } : n))
    }

    const getNodeType = (type: string) => NODE_TYPES.find(t => t.value === type) || NODE_TYPES[0]

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement IVR...</div>
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
                    <h1 className="text-xl font-bold text-[#eeeef8]">Menus vocaux (IVR)</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{ivrs.length} menu{ivrs.length > 1 ? 's' : ''} configuré{ivrs.length > 1 ? 's' : ''}</div>
                </div>
                <button onClick={() => setShowNewModal(true)}
                    className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors flex items-center gap-2">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Nouveau menu IVR
                </button>
            </div>

            {/* Info box */}
            <div className="bg-[#18181f] border border-[#7b61ff]/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <svg className="text-[#7b61ff] flex-shrink-0 mt-0.5" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="text-xs text-[#9898b8] leading-relaxed">
                    Les menus IVR définissent le parcours d'appel automatique. Chaque menu peut contenir des nœuds (choix clavier, transferts vers files, messages, messagerie vocale).
                    Assignez un menu IVR à un numéro DID depuis la page <button className="text-[#7b61ff] hover:underline">Numéros</button>.
                </div>
            </div>

            {/* Liste IVR */}
            {ivrs.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    <p className="text-sm font-medium text-[#55557a]">Aucun menu IVR configuré</p>
                    <p className="text-xs text-[#55557a] mt-1">Créez votre premier menu vocal interactif</p>
                    <button onClick={() => setShowNewModal(true)} className="mt-3 text-xs text-[#7b61ff] hover:underline">Créer un menu IVR</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {ivrs.map(ivr => (
                        <div key={ivr.id} className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden hover:border-[#3a3a55] transition-all">

                            {/* Header */}
                            <div className="flex items-center gap-4 px-5 py-4">
                                <div className="w-10 h-10 rounded-xl bg-[#7b61ff]/15 border border-[#7b61ff]/30 flex items-center justify-center flex-shrink-0">
                                    <svg width="18" height="18" fill="none" stroke="#7b61ff" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-[#eeeef8]">{ivr.name}</div>
                                    <div className="text-xs text-[#55557a] mt-0.5 truncate">
                                        {ivr.welcome_message || 'Aucun message d\'accueil'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openDrawer(ivr)}
                                        className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors">
                                        Configurer
                                    </button>
                                    <button onClick={() => setDelConfirm(delConfirm === ivr.id ? null : ivr.id)}
                                        className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 rounded-lg hover:bg-rose-400/20 transition-colors">
                                        Supprimer
                                    </button>
                                </div>
                            </div>

                            {/* Confirmation suppression */}
                            {delConfirm === ivr.id && (
                                <div className="mx-5 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-center justify-between gap-3">
                                    <span className="text-sm text-rose-400">Supprimer "{ivr.name}" ?</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDelConfirm(null)} className="text-xs bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-1.5 rounded-lg">Annuler</button>
                                        <button onClick={async () => {
                                            try {
                                                const r = await apiFetch(`/api/v1/admin/ivr/${ivr.id}`, { method: 'DELETE' })
                                                if (r.success || r.deleted) { showToast('Menu IVR supprimé ✓'); setDelConfirm(null); load() }
                                                else showToast(r.error || 'Erreur', 'err')
                                            } catch { showToast('Erreur réseau', 'err') }
                                        }} className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg">Confirmer</button>
                                    </div>
                                </div>
                            )}

                            {/* Stats / infos */}
                            <div className="border-t border-[#1f1f2a] grid grid-cols-4 divide-x divide-[#1f1f2a]">
                                {[
                                    { label: 'Nœuds', val: (ivr.nodes || []).length },
                                    { label: 'Timeout', val: `${ivr.timeout || 5}s` },
                                    { label: 'Max essais', val: ivr.max_retries || 3 },
                                    { label: 'Mis à jour', val: fmtD(ivr.updated_at || ivr.created_at) },
                                ].map(s => (
                                    <div key={s.label} className="py-3 px-4 text-center">
                                        <div className="text-sm font-bold font-mono text-[#9898b8]">{s.val}</div>
                                        <div className="text-[9px] text-[#55557a] uppercase tracking-wider mt-0.5">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Aperçu des nœuds */}
                            {(ivr.nodes || []).length > 0 && (
                                <div className="border-t border-[#1f1f2a] px-5 py-3">
                                    <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-2">Nœuds du menu</div>
                                    <div className="flex gap-2 flex-wrap">
                                        {(ivr.nodes || []).map((node: IVRNode) => {
                                            const nt = getNodeType(node.type)
                                            return (
                                                <div key={node.id} className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-lg border ${nt.bg} ${nt.border} ${nt.color}`}>
                                                    <span>{NODE_ICONS[nt.value]}</span>
                                                    <span>{node.digit ? `[${node.digit}]` : ''} {node.label}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── DRAWER CONFIGURER IVR ── */}
            {showDrawer && selectedIVR && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
                    <div className="w-[580px] bg-[#111118] border-l border-[#2e2e44] flex flex-col h-full">

                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] bg-[#18181f]">
                            <div>
                                <div className="font-bold text-[#eeeef8]">{selectedIVR.name}</div>
                                <div className="text-xs text-[#55557a]">Configurer le menu IVR</div>
                            </div>
                            <button onClick={() => setShowDrawer(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Paramètres généraux */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Paramètres généraux<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom du menu</label>
                                        <input value={editForm.name || ''} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Message d'accueil (TTS)</label>
                                        <textarea value={editForm.welcome_message || ''} rows={3}
                                            onChange={e => setEditForm((p: any) => ({ ...p, welcome_message: e.target.value }))}
                                            placeholder="Bienvenue chez [Entreprise]. Pour le support, appuyez sur 1. Pour les ventes, appuyez sur 2."
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-none" />
                                        <div className="text-[10px] text-[#55557a] mt-1">Ce message sera lu automatiquement lors de l'entrée dans ce menu</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Timeout (sec)</label>
                                            <input type="number" min="3" max="30"
                                                value={editForm.timeout || 5}
                                                onChange={e => setEditForm((p: any) => ({ ...p, timeout: parseInt(e.target.value) }))}
                                                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                            <div className="text-[10px] text-[#55557a] mt-1">Attente avant répétition</div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Essais max</label>
                                            <input type="number" min="1" max="5"
                                                value={editForm.max_retries || 3}
                                                onChange={e => setEditForm((p: any) => ({ ...p, max_retries: parseInt(e.target.value) }))}
                                                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                            <div className="text-[10px] text-[#55557a] mt-1">Avant raccroché automatique</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Builder de nœuds */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Nœuds du menu<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>

                                {/* Types disponibles */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {NODE_TYPES.map(t => (
                                        <button key={t.value} onClick={() => {
                                            const newNode: IVRNode = {
                                                id: genId(), type: t.value,
                                                label: t.label, digit: String(nodes.length + 1),
                                                message: '', target: '', children: [],
                                            }
                                            setNodes(prev => [...prev, newNode])
                                            setSelectedNode(newNode)
                                            setShowNodeEditor(true)
                                        }}
                                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all hover:scale-105 ${t.bg} ${t.border}`}>
                                            <span className="flex items-center justify-center">{NODE_ICONS[t.value]}</span>
                                            <div>
                                                <div className={`text-[10px] font-bold ${t.color}`}>{t.label}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Liste des nœuds */}
                                {nodes.length === 0 ? (
                                    <div className="bg-[#1f1f2a] border border-dashed border-[#3a3a55] rounded-xl p-6 text-center">
                                        <p className="text-xs text-[#55557a]">Aucun nœud — cliquez sur un type ci-dessus pour ajouter</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {nodes.map((node, idx) => {
                                            const nt = getNodeType(node.type)
                                            const isSelected = selectedNode?.id === node.id
                                            return (
                                                <div key={node.id}>
                                                    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer
                            ${isSelected ? `${nt.bg} ${nt.border}` : 'bg-[#1f1f2a] border-[#2e2e44] hover:border-[#3a3a55]'}`}
                                                        onClick={() => { setSelectedNode(node); setShowNodeEditor(true) }}>
                                                        {/* Digit */}
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${nt.bg} ${nt.color} border ${nt.border}`}>
                                                            {node.digit || idx + 1}
                                                        </div>
                                                        {/* Infos */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-bold ${nt.color}`}>{NODE_ICONS[nt.value]} {nt.label}</span>
                                                                <span className="text-sm font-medium text-[#eeeef8]">{node.label}</span>
                                                            </div>
                                                            {node.message && <div className="text-[10px] text-[#55557a] mt-0.5 truncate">"{node.message}"</div>}
                                                            {node.target && <div className="text-[10px] text-[#55557a] mt-0.5">→ {node.target}</div>}
                                                        </div>
                                                        {/* Actions */}
                                                        <button onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                                                            className="text-[#55557a] hover:text-rose-400 transition-colors flex-shrink-0">
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                        </button>
                                                    </div>

                                                    {/* Éditeur nœud inline */}
                                                    {isSelected && showNodeEditor && (
                                                        <div className="ml-4 mt-1 bg-[#18181f] border border-[#3a3a55] rounded-lg p-4 space-y-3">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Touche DTMF</label>
                                                                    <input value={node.digit || ''} onChange={e => updateNode(node.id, { digit: e.target.value })}
                                                                        placeholder="1, 2, *, #"
                                                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Étiquette</label>
                                                                    <input value={node.label || ''} onChange={e => updateNode(node.id, { label: e.target.value })}
                                                                        placeholder="Support, Ventes..."
                                                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                                                </div>
                                                            </div>
                                                            {(node.type === 'message' || node.type === 'menu') && (
                                                                <div>
                                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Message TTS</label>
                                                                    <textarea value={node.message || ''} rows={2}
                                                                        onChange={e => updateNode(node.id, { message: e.target.value })}
                                                                        placeholder="Pour le support technique, appuyez sur 1..."
                                                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-none" />
                                                                </div>
                                                            )}
                                                            {node.type === 'queue' && (
                                                                <div>
                                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">File d'attente cible</label>
                                                                    <select value={node.target || ''} onChange={e => updateNode(node.id, { target: e.target.value })}
                                                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                                                        <option value="">— Sélectionner une file —</option>
                                                                        {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                                                    </select>
                                                                </div>
                                                            )}
                                                            {node.type === 'transfer' && (
                                                                <div>
                                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Numéro de destination</label>
                                                                    <input value={node.target || ''} onChange={e => updateNode(node.id, { target: e.target.value })}
                                                                        placeholder="+15141234567"
                                                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* Aperçu du flux */}
                            {nodes.length > 0 && (
                                <section>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                        <div className="flex-1 h-px bg-[#2e2e44]" />Aperçu du flux<div className="flex-1 h-px bg-[#2e2e44]" />
                                    </div>
                                    <div className="bg-[#1f1f2a] rounded-xl p-4 font-mono text-xs text-[#9898b8] space-y-1">
                                        <div className="text-violet-400 font-bold flex items-center gap-1">
                                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                            Appel entrant
                                        </div>
                                        <div className="ml-3 text-[#55557a]">↓</div>
                                        <div className="ml-3 text-sky-400 flex items-center gap-1">
                                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /></svg>
                                            "{editForm.welcome_message || 'Message d\'accueil...'}"
                                        </div>
                                        {nodes.map(n => {
                                            const nt = getNodeType(n.type)
                                            return (
                                                <div key={n.id} className={`ml-3 ${nt.color}`}>
                                                    → [{n.digit}] {NODE_ICONS[nt.value]} {n.label}
                                                    {n.target && queues.find(q => q.id === n.target) && (
                                                        <span className="text-[#55557a]"> → {queues.find(q => q.id === n.target)?.name}</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        <div className="ml-3 text-zinc-500">→ [*] ✕ Raccrocher</div>
                                    </div>
                                </section>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-[#2e2e44] bg-[#18181f] flex gap-3">
                            <button onClick={() => setShowDrawer(false)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={saveIVR} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL NOUVEAU IVR ── */}
            {showNewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44]">
                            <h3 className="font-bold text-[#eeeef8]">Nouveau menu IVR</h3>
                            <button onClick={() => setShowNewModal(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom du menu *</label>
                                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Menu principal, Support, Ventes..."
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Message d'accueil</label>
                                <textarea value={form.welcome_message} rows={3}
                                    onChange={e => setForm(p => ({ ...p, welcome_message: e.target.value }))}
                                    placeholder="Bienvenue chez [Entreprise]. Pour le support, appuyez sur 1..."
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Timeout (sec)</label>
                                    <input type="number" min="3" max="30" value={form.timeout}
                                        onChange={e => setForm(p => ({ ...p, timeout: parseInt(e.target.value) }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Essais max</label>
                                    <input type="number" min="1" max="5" value={form.max_retries}
                                        onChange={e => setForm(p => ({ ...p, max_retries: parseInt(e.target.value) }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-3">
                            <button onClick={() => setShowNewModal(false)} className="flex-1 bg-[#111118] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={createIVR} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Création...' : 'Créer le menu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}