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

const PRESET_COLORS = [
    '#7b61ff', '#6366f1', '#8b5cf6', '#a855f7',
    '#ec4899', '#f43f5e', '#ef4444',
    '#f97316', '#eab308', '#84cc16',
    '#22c55e', '#16a34a', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#2563eb',
    '#55557a', '#9898b8',
]

interface Tag { id: string; name: string; color: string; created_at?: string }

export default function TagsPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [tags, setTags] = useState<Tag[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editTag, setEditTag] = useState<Tag | null>(null)
    const [tagName, setTagName] = useState('')
    const [tagColor, setTagColor] = useState(PRESET_COLORS[0])
    const [saving, setSaving] = useState(false)

    // Delete confirmation
    const [deleteId, setDeleteId] = useState<string | null>(null)

    // Usage counts (contact_tags count per tag)
    const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

    const load = useCallback(async () => {
        try {
            const r = await apiFetch('/api/v1/crm/tags')
            if (r.success) setTags(r.data || [])
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const openCreate = () => {
        setEditTag(null)
        setTagName('')
        setTagColor(PRESET_COLORS[0])
        setShowModal(true)
    }

    const openEdit = (tag: Tag) => {
        setEditTag(tag)
        setTagName(tag.name)
        setTagColor(tag.color)
        setShowModal(true)
    }

    const saveTag = async () => {
        if (!tagName.trim()) return
        setSaving(true)
        try {
            if (editTag) {
                const r = await apiFetch(`/api/v1/crm/tags/${editTag.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: tagName.trim(), color: tagColor }),
                })
                if (r.success) {
                    setTags(p => p.map(t => t.id === editTag.id ? { ...t, name: tagName.trim(), color: tagColor } : t))
                    setShowModal(false)
                    showToast('Tag modifie')
                } else showToast(r.error || 'Erreur', 'err')
            } else {
                const r = await apiFetch('/api/v1/crm/tags', {
                    method: 'POST',
                    body: JSON.stringify({ name: tagName.trim(), color: tagColor }),
                })
                if (r.success) {
                    setTags(p => [...p, r.data])
                    setShowModal(false)
                    showToast('Tag cree')
                } else showToast(r.error || 'Erreur', 'err')
            }
        } catch { showToast('Erreur reseau', 'err') }
        setSaving(false)
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        try {
            const r = await apiFetch(`/api/v1/crm/tags/${deleteId}`, { method: 'DELETE' })
            if (r.success) {
                setTags(p => p.filter(t => t.id !== deleteId))
                showToast('Tag supprime')
            } else showToast(r.error || 'Erreur', 'err')
        } catch { showToast('Erreur reseau', 'err') }
        setDeleteId(null)
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement des tags...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-5xl mx-auto">

            {toast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full text-sm font-bold shadow-xl
                    ${toast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Tags d'appels</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{tags.length} tag{tags.length > 1 ? 's' : ''} configure{tags.length > 1 ? 's' : ''}</div>
                </div>
                <button onClick={openCreate}
                    className="self-start sm:self-auto flex items-center gap-2 bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Nouveau tag
                </button>
            </div>

            {/* Liste tags */}
            {tags.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    <p className="text-sm font-medium text-[#55557a]">Aucun tag configure</p>
                    <p className="text-xs text-[#3a3a55] mt-1">Creez des tags pour classifier vos appels et contacts</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {tags.map(tag => (
                        <div key={tag.id}
                            className="bg-[#18181f] border border-[#2e2e44] rounded-xl px-5 py-3.5 flex items-center gap-4 hover:border-[#3a3a55] transition-all group">

                            {/* Color dot */}
                            <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/10"
                                style={{ backgroundColor: tag.color }} />

                            {/* Tag name */}
                            <div className="flex-1 min-w-0">
                                <span className="font-bold text-[#eeeef8] text-sm">{tag.name}</span>
                                {usageCounts[tag.id] !== undefined && (
                                    <span className="text-[10px] text-[#55557a] ml-3">{usageCounts[tag.id]} contact{usageCounts[tag.id] > 1 ? 's' : ''}</span>
                                )}
                            </div>

                            {/* Preview badge */}
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                                style={{ color: tag.color, backgroundColor: tag.color + '20', borderColor: tag.color + '40' }}>
                                {tag.name}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(tag)}
                                    className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 rounded-lg hover:bg-violet-400/20 transition-colors">
                                    Modifier
                                </button>
                                <button onClick={() => setDeleteId(tag.id)}
                                    className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 rounded-lg hover:bg-rose-400/20 transition-colors">
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal create/edit tag */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-[#111118] border border-[#2e2e44] rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-base font-bold text-[#eeeef8] mb-4">
                            {editTag ? 'Modifier le tag' : 'Nouveau tag'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#55557a] block mb-1.5">Nom du tag</label>
                                <input value={tagName} onChange={e => setTagName(e.target.value)}
                                    placeholder="Ex: VIP, Rappel, Urgent..."
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]"
                                    autoFocus onKeyDown={e => e.key === 'Enter' && saveTag()} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#55557a] block mb-2">Couleur</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(c => (
                                        <button key={c} onClick={() => setTagColor(c)}
                                            className={`w-7 h-7 rounded-lg transition-all ${tagColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111118] scale-110' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            {tagName.trim() && (
                                <div>
                                    <label className="text-xs font-bold text-[#55557a] block mb-1.5">Apercu</label>
                                    <div className="bg-[#1f1f2a] rounded-lg p-3 flex items-center gap-3">
                                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tagColor }} />
                                        <span className="text-sm text-[#eeeef8] font-medium">{tagName.trim()}</span>
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ml-auto"
                                            style={{ color: tagColor, backgroundColor: tagColor + '20', borderColor: tagColor + '40' }}>
                                            {tagName.trim()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)}
                                className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button disabled={!tagName.trim() || saving} onClick={saveTag}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Enregistrement...' : editTag ? 'Sauvegarder' : 'Creer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal confirmation suppression */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
                    <div className="relative bg-[#111118] border border-[#2e2e44] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-base font-bold text-[#eeeef8] mb-2">Supprimer ce tag ?</h3>
                        <p className="text-sm text-[#55557a] mb-5">
                            Cette action est irreversible. Le tag sera retire de tous les contacts associes.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)}
                                className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={confirmDelete}
                                className="flex-1 bg-rose-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-rose-600 transition-colors">
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
