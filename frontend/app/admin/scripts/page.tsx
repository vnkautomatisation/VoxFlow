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

const fmtD = (dt: string) => { if (!dt) return '—'; return new Date(dt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' }) }

interface Script { id: string; name: string; content: string; queue_id?: string; created_at: string; updated_at?: string }
interface Queue { id: string; name: string }

const EMPTY_FORM = { name: '', content: '', queue_id: '' }

const SCRIPT_TEMPLATES = [
    {
        name: 'Accueil entrant',
        content: `Bonjour, [Nom de l'entreprise], [Votre prénom] à l'appareil, comment puis-je vous aider ?

[Écouter le client]

Très bien, je comprends votre demande. Laissez-moi vérifier ça pour vous.

[Consulter le système]

Voici ce que je peux faire pour vous : [solution]

Y a-t-il autre chose que je puisse faire pour vous aujourd'hui ?

Merci d'avoir contacté [Nom de l'entreprise]. Bonne journée !`
    },
    {
        name: 'Appel sortant — Prospection',
        content: `Bonjour, puis-je parler à [Nom du contact] ?

[Si disponible]
Bonjour [Prénom], je m'appelle [Votre prénom] de [Entreprise]. Je vous contacte au sujet de [Raison].

Est-ce que vous avez 2 minutes pour que je vous explique ?

[Si oui]
Parfait ! Nous proposons [Solution/Produit] qui permettrait à votre entreprise de [Bénéfice principal].

Seriez-vous disponible pour une démonstration cette semaine ?

[Objection — Prix]
Je comprends votre préoccupation. Notre solution est justement conçue pour offrir un retour sur investissement rapide. En moyenne, nos clients voient [ROI] en [délai].

[Conclusion]
Je vous envoie nos informations par courriel. Mon adresse est [email]. À bientôt !`
    },
    {
        name: 'Support technique',
        content: `Bonjour, support technique [Entreprise], [Prénom] à l'écoute.

Puis-je avoir votre numéro de client ou votre courriel ?

[Vérifier le compte dans le CRM]

Merci [Nom]. Quel est le problème rencontré ?

[Écouter et noter]

D'accord, je vais vous guider. Pouvez-vous [étape 1] ?

[Continuer le dépannage]

Niveau de priorité : [ ] Urgent  [ ] Normal  [ ] Bas

Solution appliquée : ________________________________

Le problème est-il résolu ?
[ ] Oui → "Parfait ! Y a-t-il autre chose ?"
[ ] Non → Escalader vers niveau 2`
    },
]

export default function ScriptsPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [scripts, setScripts] = useState<Script[]>([])
    const [queues, setQueues] = useState<Queue[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Script | null>(null)
    const [showDrawer, setShowDrawer] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [editForm, setEditForm] = useState<any>({})
    const [newForm, setNewForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [delConfirm, setDelConfirm] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [searchVal, setSearchVal] = useState('')
    const [showTemplates, setShowTemplates] = useState(false)

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

    const load = useCallback(async () => {
        try {
            const [sr, qr] = await Promise.all([
                apiFetch('/api/v1/admin/scripts'),
                apiFetch('/api/v1/admin/queues'),
            ])
            if (sr.success) setScripts(sr.data || [])
            if (qr.success) setQueues(qr.data || [])
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const openDrawer = (s: Script) => {
        setSelected(s)
        setEditForm({ name: s.name, content: s.content, queue_id: s.queue_id || '' })
        setShowDrawer(true)
    }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        try {
            const r = await apiFetch(`/api/v1/admin/scripts/${selected.id}`, {
                method: 'PATCH', body: JSON.stringify(editForm)
            })
            if (r.success || r.data) { showToast('Script sauvegardé ✓'); setShowDrawer(false); load() }
            else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const create = async () => {
        if (!newForm.name || !newForm.content) { showToast('Nom et contenu requis', 'err'); return }
        setSaving(true)
        try {
            const r = await apiFetch('/api/v1/admin/scripts', {
                method: 'POST', body: JSON.stringify({ ...newForm, queueId: newForm.queue_id })
            })
            if (r.success || r.data) { showToast('Script créé ✓'); setShowNew(false); setNewForm(EMPTY_FORM); load() }
            else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const del = async (id: string) => {
        try {
            const r = await apiFetch(`/api/v1/admin/scripts/${id}`, { method: 'DELETE' })
            if (r.success || r.deleted) { showToast('Script supprimé'); setDelConfirm(null); setShowDrawer(false); load() }
            else showToast(r.error || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
    }

    const filtered = scripts.filter(s =>
        !searchVal || s.name.toLowerCase().includes(searchVal.toLowerCase()) || s.content.toLowerCase().includes(searchVal.toLowerCase())
    )

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement des scripts...</div>
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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Scripts d'appel</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{scripts.length} script{scripts.length > 1 ? 's' : ''}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowTemplates(true)}
                        className="flex items-center gap-2 text-[10px] font-bold text-[#9898b8] border border-[#2e2e44] bg-[#18181f] px-3 py-2 rounded-lg hover:text-[#eeeef8] hover:border-[#3a3a55] transition-colors">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        Modèles
                    </button>
                    <button onClick={() => { setNewForm(EMPTY_FORM); setShowNew(true) }}
                        className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors flex items-center gap-2">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nouveau script
                    </button>
                </div>
            </div>

            {/* Recherche */}
            <div className="relative mb-4 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55557a]" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Rechercher un script..."
                    className="w-full bg-[#18181f] border border-[#2e2e44] rounded-lg pl-9 pr-4 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
            </div>

            {/* Liste scripts */}
            {filtered.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                    <p className="text-sm font-medium text-[#55557a]">{searchVal ? 'Aucun résultat' : 'Aucun script créé'}</p>
                    {!searchVal && (
                        <div className="flex gap-2 justify-center mt-3">
                            <button onClick={() => setShowTemplates(true)} className="text-xs text-[#9898b8] hover:text-[#eeeef8] border border-[#2e2e44] px-3 py-1.5 rounded-lg">Utiliser un modèle</button>
                            <button onClick={() => setShowNew(true)} className="text-xs text-[#7b61ff] hover:underline">Créer depuis zéro</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filtered.map(s => {
                        const queue = queues.find(q => q.id === s.queue_id)
                        const preview = s.content.split('\n').filter(Boolean)[0] || ''
                        return (
                            <div key={s.id} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 hover:border-[#3a3a55] transition-all cursor-pointer"
                                onClick={() => openDrawer(s)}>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-[#7b61ff]/15 border border-[#7b61ff]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg width="16" height="16" fill="none" stroke="#7b61ff" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-sm text-[#eeeef8]">{s.name}</span>
                                            {queue && (
                                                <span className="text-[9px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full">
                                                    {queue.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[#55557a] truncate">{preview}</div>
                                        <div className="text-[10px] text-[#3a3a55] mt-1">
                                            {s.content.split('\n').filter(Boolean).length} lignes · Modifié le {fmtD(s.updated_at || s.created_at)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => openDrawer(s)}
                                            className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-2.5 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors">
                                            Modifier
                                        </button>
                                        {delConfirm === s.id ? (
                                            <div className="flex gap-1">
                                                <button onClick={() => setDelConfirm(null)} className="text-[10px] bg-[#2e2e44] text-[#9898b8] px-2 py-1.5 rounded-lg">Non</button>
                                                <button onClick={() => del(s.id)} className="text-[10px] bg-rose-500 text-white px-2 py-1.5 rounded-lg">Oui</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setDelConfirm(s.id)}
                                                className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-2.5 py-1.5 rounded-lg hover:bg-rose-400/20 transition-colors">
                                                Suppr.
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Drawer modifier script */}
            {showDrawer && selected && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
                    <div className="w-[600px] bg-[#111118] border-l border-[#2e2e44] flex flex-col h-full">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] bg-[#18181f]">
                            <div>
                                <div className="font-bold text-[#eeeef8]">{selected.name}</div>
                                <div className="text-xs text-[#55557a]">Modifier le script</div>
                            </div>
                            <button onClick={() => setShowDrawer(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom du script</label>
                                <input value={editForm.name || ''} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">File d'attente associée</label>
                                <select value={editForm.queue_id || ''} onChange={e => setEditForm((p: any) => ({ ...p, queue_id: e.target.value }))}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">— Aucune file —</option>
                                    {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">
                                    Contenu du script
                                    <span className="ml-2 text-[#3a3a55] normal-case font-normal">
                                        Utilisez [crochets] pour les champs variables
                                    </span>
                                </label>
                                <textarea value={editForm.content || ''} rows={20}
                                    onChange={e => setEditForm((p: any) => ({ ...p, content: e.target.value }))}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-4 py-3 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-none font-mono leading-relaxed"
                                    placeholder="Bonjour, [Nom de l'entreprise]..." />
                            </div>

                            {/* Zone danger */}
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500/60 mb-2 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-rose-500/20" />Zone dangereuse<div className="flex-1 h-px bg-rose-500/20" />
                                </div>
                                {delConfirm === selected.id ? (
                                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-center justify-between">
                                        <span className="text-sm text-rose-400">Supprimer ce script ?</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => setDelConfirm(null)} className="text-xs bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-1.5 rounded-lg">Annuler</button>
                                            <button onClick={() => del(selected.id)} className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg">Supprimer</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setDelConfirm(selected.id)}
                                        className="w-full text-rose-400 border border-rose-400/30 bg-rose-400/5 px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-rose-400/15 transition-colors">
                                        Supprimer ce script
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-[#2e2e44] bg-[#18181f] flex gap-3">
                            <button onClick={() => setShowDrawer(false)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={save} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal nouveau script */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] flex-shrink-0">
                            <h3 className="font-bold text-[#eeeef8]">Nouveau script</h3>
                            <button onClick={() => setShowNew(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom *</label>
                                    <input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Accueil entrant"
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">File associée</label>
                                    <select value={newForm.queue_id} onChange={e => setNewForm(p => ({ ...p, queue_id: e.target.value }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                        <option value="">— Aucune —</option>
                                        {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Contenu *</label>
                                <textarea value={newForm.content} rows={16}
                                    onChange={e => setNewForm(p => ({ ...p, content: e.target.value }))}
                                    placeholder="Bonjour, [Entreprise], [Prénom] à l'appareil..."
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-4 py-3 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-none font-mono leading-relaxed" />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-3 flex-shrink-0">
                            <button onClick={() => setShowNew(false)} className="flex-1 bg-[#111118] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={create} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Création...' : 'Créer le script'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal modèles */}
            {showTemplates && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] flex-shrink-0">
                            <h3 className="font-bold text-[#eeeef8]">Modèles de scripts</h3>
                            <button onClick={() => setShowTemplates(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-4 space-y-3">
                            {SCRIPT_TEMPLATES.map(t => (
                                <div key={t.name} className="bg-[#1f1f2a] border border-[#2e2e44] rounded-xl p-4 hover:border-[#7b61ff]/40 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm text-[#eeeef8] mb-1">{t.name}</div>
                                            <div className="text-[10px] text-[#55557a] line-clamp-2 font-mono">{t.content.split('\n')[0]}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setNewForm({ name: t.name, content: t.content, queue_id: '' })
                                                setShowTemplates(false)
                                                setShowNew(true)
                                            }}
                                            className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors whitespace-nowrap flex-shrink-0">
                                            Utiliser
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}