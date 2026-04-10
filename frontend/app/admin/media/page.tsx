'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
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

const fmtSize = (bytes: number) => {
    if (!bytes) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const fmtDur = (sec: number) => {
    if (!sec) return '—'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

const fmtD = (dt: string) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
}

const AUDIO_TYPES = [
    {
        value: 'hold_music', label: 'Musique d\'attente', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/30',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    },
    {
        value: 'ivr_message', label: 'Message IVR', color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01-.07 1.17 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
    },
    {
        value: 'voicemail_greeting', label: 'Message messagerie', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="5.5" cy="11.5" r="4.5" /><circle cx="18.5" cy="11.5" r="4.5" /><line x1="9" y1="16" x2="15" y2="16" /></svg>
    },
    {
        value: 'announcement', label: 'Annonce', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 010 7.07" /><path d="M19.07 4.93a10 10 0 010 14.14" /></svg>
    },
    {
        value: 'other', label: 'Autre', color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-400/30',
        icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
    },
]

const getType = (v: string) => AUDIO_TYPES.find(t => t.value === v) || AUDIO_TYPES[4]

interface AudioFile {
    id: string; name: string; url: string; type: string
    duration: number; file_size: number; mime_type: string
    is_active: boolean; created_at: string
}

interface Queue { id: string; name: string; hold_music_id?: string }

const EMPTY_FORM = { name: '', url: '', type: 'hold_music', duration: 0 }
const ACCEPTED = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/x-m4a', 'audio/aac']

export default function MediaPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [files, setFiles] = useState<AudioFile[]>([])
    const [queues, setQueues] = useState<Queue[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [editFile, setEditFile] = useState<AudioFile | null>(null)
    const [saving, setSaving] = useState(false)
    const [delConfirm, setDelConfirm] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [playingId, setPlayingId] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadPreview, setUploadPreview] = useState<string | null>(null)

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const load = useCallback(async () => {
        try {
            const [ar, qr] = await Promise.all([
                apiFetch('/api/v1/admin/audio'),
                apiFetch('/api/v1/admin/queues'),
            ])
            if (ar.success) setFiles(ar.data || [])
            if (qr.success) setQueues(qr.data || [])
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const openAdd = () => {
        setForm(EMPTY_FORM); setEditFile(null)
        setUploadFile(null); setUploadPreview(null)
        setUploadProgress(0); setUploadMode('file')
        setShowModal(true)
    }
    const openEdit = (f: AudioFile) => {
        setForm({ name: f.name, url: f.url, type: f.type, duration: f.duration })
        setEditFile(f); setUploadFile(null); setUploadPreview(null)
        setUploadMode('url'); setShowModal(true)
    }

    const handleFileDrop = (file: File) => {
        if (!ACCEPTED.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
            showToast('Format non supporté. Utilisez MP3, WAV, OGG ou M4A', 'err'); return
        }
        setUploadFile(file)
        setUploadPreview(URL.createObjectURL(file))
        // Auto-remplir le nom si vide
        if (!form.name) setForm(p => ({ ...p, name: file.name.replace(/\.[^.]+$/, '') }))
        // Lire la durée
        const audio = new Audio(URL.createObjectURL(file))
        audio.onloadedmetadata = () => setForm(p => ({ ...p, duration: Math.round(audio.duration) }))
    }

    const uploadToSupabase = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop()
        const path = `audio/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
        const { createClient } = await import('@supabase/supabase-js')
        const sb = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        )
        const { data, error } = await sb.storage.from('audio').upload(path, file, { cacheControl: '3600', upsert: false })
        if (error) throw new Error(error.message)
        const { data: pub } = sb.storage.from('audio').getPublicUrl(path)
        return pub.publicUrl
    }

    const save = async () => {
        if (!form.name) { showToast('Nom requis', 'err'); return }
        if (!uploadFile && !form.url) { showToast('Fichier ou URL requis', 'err'); return }
        setSaving(true)
        try {
            let finalUrl = form.url
            let fileSize = 0

            // Upload vers Supabase Storage si fichier sélectionné
            if (uploadFile) {
                setUploadProgress(10)
                finalUrl = await uploadToSupabase(uploadFile)
                fileSize = uploadFile.size
                setUploadProgress(80)
            }

            const payload = { ...form, url: finalUrl, file_size: fileSize }
            const r = editFile
                ? await apiFetch(`/api/v1/admin/audio/${editFile.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
                : await apiFetch('/api/v1/admin/audio', { method: 'POST', body: JSON.stringify(payload) })

            setUploadProgress(100)
            if (r.success || r.data) {
                showToast(editFile ? 'Fichier mis à jour ✓' : 'Fichier uploadé ✓')
                setShowModal(false); load()
            } else showToast(r.error || r.message || 'Erreur', 'err')
        } catch (e: any) { showToast(e.message || 'Erreur upload', 'err') }
        setSaving(false)
        setUploadProgress(0)
    }

    const del = async (id: string) => {
        try {
            const r = await apiFetch(`/api/v1/admin/audio/${id}`, { method: 'DELETE' })
            if (r.success || r.deleted) { showToast('Fichier supprimé'); setDelConfirm(null); load() }
            else showToast(r.error || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
    }

    const assignToQueue = async (queueId: string, audioId: string | null) => {
        try {
            const r = await apiFetch(`/api/v1/admin/queues/${queueId}`, {
                method: 'PATCH', body: JSON.stringify({ hold_music_id: audioId })
            })
            if (r.success || r.data) { showToast('Assigné ✓'); load() }
            else showToast(r.error || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
    }

    const togglePlay = (file: AudioFile) => {
        if (playingId === file.id) {
            audioRef.current?.pause()
            setPlayingId(null)
            return
        }
        if (audioRef.current) audioRef.current.pause()
        const audio = new Audio(file.url)
        audio.onended = () => setPlayingId(null)
        audio.onerror = () => { showToast('Impossible de lire ce fichier', 'err'); setPlayingId(null) }
        audio.play().catch(() => showToast('Impossible de lire ce fichier', 'err'))
        audioRef.current = audio
        setPlayingId(file.id)
    }

    const filtered = files.filter(f => {
        const matchType = filter === 'all' || f.type === filter
        const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase())
        return matchType && matchSearch
    })

    // Stats
    const totalSize = files.reduce((s, f) => s + (f.file_size || 0), 0)
    const holdMusic = files.filter(f => f.type === 'hold_music').length
    const ivrMessages = files.filter(f => f.type === 'ivr_message').length

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement médiathèque...</div>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Médiathèque</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{files.length} fichier{files.length > 1 ? 's' : ''} audio</div>
                </div>
                <button onClick={openAdd}
                    className="self-start sm:self-auto bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors flex items-center gap-2">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Ajouter un fichier
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total fichiers', val: files.length, color: 'text-[#eeeef8]' },
                    { label: 'Musiques d\'attente', val: holdMusic, color: 'text-violet-400' },
                    { label: 'Messages IVR', val: ivrMessages, color: 'text-sky-400' },
                    { label: 'Taille totale', val: fmtSize(totalSize), color: 'text-emerald-400' },
                ].map(k => (
                    <div key={k.label} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                        <div className={`text-2xl font-bold font-mono ${k.color}`}>{k.val}</div>
                        <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mt-1">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Assignation musique aux files d'attente */}
            {queues.length > 0 && (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-6">
                    <div className="text-xs font-bold uppercase tracking-widest text-[#55557a] mb-4 flex items-center gap-2">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                        Musique d'attente par file
                    </div>
                    <div className="space-y-2">
                        {queues.map(q => {
                            const assigned = files.find(f => f.id === q.hold_music_id)
                            const holdFiles = files.filter(f => f.type === 'hold_music')
                            return (
                                <div key={q.id} className="flex items-center gap-3">
                                    <div className="w-32 text-sm font-medium text-[#9898b8] truncate">{q.name}</div>
                                    <select
                                        value={q.hold_music_id || ''}
                                        onChange={e => assignToQueue(q.id, e.target.value || null)}
                                        className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-xs text-[#eeeef8] outline-none focus:border-[#7b61ff] transition-colors">
                                        <option value="">— Aucune musique —</option>
                                        {holdFiles.map(f => (
                                            <option key={f.id} value={f.id}>{f.name} ({fmtDur(f.duration)})</option>
                                        ))}
                                    </select>
                                    {assigned && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-lg">
                                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                                            {assigned.name}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {files.filter(f => f.type === 'hold_music').length === 0 && (
                        <div className="text-xs text-[#55557a] mt-2">Ajoutez des fichiers de type "Musique d'attente" pour les assigner aux files</div>
                    )}
                </div>
            )}

            {/* Filtres */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="relative w-full sm:flex-1 sm:max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55557a]" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                        className="w-full bg-[#18181f] border border-[#2e2e44] rounded-lg pl-9 pr-4 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                </div>
                <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
                    {[{ val: 'all', label: 'Tous' }, ...AUDIO_TYPES.map(t => ({ val: t.value, label: t.label }))].map(f => (
                        <button key={f.val} onClick={() => setFilter(f.val)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0
                ${filter === f.val ? 'bg-[#7b61ff]/20 text-violet-300 border border-[#7b61ff]/40' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="text-xs text-[#55557a] sm:ml-auto whitespace-nowrap">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</div>
            </div>

            {/* Grille fichiers */}
            {filtered.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                    <p className="text-sm font-medium text-[#55557a]">Aucun fichier audio</p>
                    <button onClick={openAdd} className="text-xs text-[#7b61ff] hover:underline mt-2">Ajouter un fichier</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2">
                    {filtered.map(f => {
                        const t = getType(f.type)
                        const isPlaying = playingId === f.id
                        return (
                            <div key={f.id} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4 hover:border-[#3a3a55] transition-all">
                                <div className="flex items-center gap-4">

                                    {/* Play button */}
                                    <button onClick={() => togglePlay(f)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                      ${isPlaying ? 'bg-[#7b61ff] shadow-lg shadow-violet-500/30' : 'bg-[#2e2e44] hover:bg-[#3a3a55]'}`}>
                                        {isPlaying ? (
                                            <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                        ) : (
                                            <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                        )}
                                    </button>

                                    {/* Waveform visualizer */}
                                    <div className="flex items-center gap-0.5 w-24 flex-shrink-0">
                                        {Array.from({ length: 20 }).map((_, i) => (
                                            <div key={i}
                                                className={`rounded-full transition-all ${isPlaying ? 'bg-[#7b61ff]' : 'bg-[#2e2e44]'}`}
                                                style={{
                                                    width: '3px',
                                                    height: `${8 + Math.sin(i * 0.8) * 6 + Math.random() * 4}px`,
                                                    animation: isPlaying ? `wave ${0.4 + (i % 3) * 0.2}s ease-in-out infinite alternate` : 'none',
                                                    animationDelay: `${i * 0.05}s`,
                                                }} />
                                        ))}
                                    </div>

                                    {/* Infos */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-[#eeeef8] truncate">{f.name}</span>
                                            <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${t.bg} ${t.border} ${t.color}`}>
                                                {t.icon}{t.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] text-[#55557a]">{fmtDur(f.duration)}</span>
                                            <span className="text-[10px] text-[#55557a]">{fmtSize(f.file_size)}</span>
                                            <span className="text-[10px] text-[#55557a]">{f.mime_type || 'audio/mpeg'}</span>
                                            <span className="text-[10px] text-[#55557a]">Ajouté le {fmtD(f.created_at)}</span>
                                        </div>
                                        <div className="text-[10px] text-[#3a3a55] mt-0.5 truncate font-mono">{f.url}</div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => openEdit(f)}
                                            className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-2.5 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors">
                                            Modifier
                                        </button>
                                        {delConfirm === f.id ? (
                                            <div className="flex gap-1">
                                                <button onClick={() => setDelConfirm(null)} className="text-[10px] bg-[#2e2e44] text-[#9898b8] px-2 py-1.5 rounded-lg">Non</button>
                                                <button onClick={() => del(f.id)} className="text-[10px] bg-rose-500 text-white px-2 py-1.5 rounded-lg">Oui</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setDelConfirm(f.id)}
                                                className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-2.5 py-1.5 rounded-lg hover:bg-rose-400/20 transition-colors">
                                                Supprimer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`
        @keyframes wave {
          from { transform: scaleY(1); }
          to   { transform: scaleY(1.8); }
        }
      `}</style>

            {/* ── MODAL AJOUTER / MODIFIER ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] flex-shrink-0">
                            <h3 className="font-bold text-[#eeeef8]">{editFile ? 'Modifier le fichier' : 'Ajouter un fichier audio'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-6 space-y-4">

                            {/* Tabs upload / URL */}
                            {!editFile && (
                                <div className="flex gap-1 bg-[#111118] p-1 rounded-lg">
                                    {[
                                        { val: 'file', label: 'Depuis mon PC' },
                                        { val: 'url', label: 'Depuis une URL' },
                                    ].map(t => (
                                        <button key={t.val} onClick={() => setUploadMode(t.val as 'file' | 'url')}
                                            className={`flex-1 py-2 rounded-md text-xs font-bold transition-all
                        ${uploadMode === t.val ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Zone drag and drop */}
                            {uploadMode === 'file' && !editFile && (
                                <div>
                                    {/* Input caché */}
                                    <input ref={fileInputRef} type="file" accept=".mp3,.wav,.ogg,.m4a,.aac,audio/*"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }} />

                                    {uploadFile ? (
                                        /* Fichier sélectionné */
                                        <div className="bg-[#1f1f2a] border border-emerald-400/30 rounded-xl p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-emerald-400/15 flex items-center justify-center flex-shrink-0">
                                                    <svg width="18" height="18" fill="none" stroke="#00d4aa" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-[#eeeef8] truncate">{uploadFile.name}</div>
                                                    <div className="text-[10px] text-[#55557a]">{fmtSize(uploadFile.size)} · {uploadFile.type || 'audio'}</div>
                                                </div>
                                                <button onClick={() => { setUploadFile(null); setUploadPreview(null) }}
                                                    className="text-[#55557a] hover:text-rose-400 transition-colors">
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                </button>
                                            </div>
                                            {/* Lecteur preview */}
                                            {uploadPreview && (
                                                <audio controls src={uploadPreview}
                                                    className="w-full mt-3 rounded-lg"
                                                    style={{ height: '32px', accentColor: '#7b61ff' }} />
                                            )}
                                        </div>
                                    ) : (
                                        /* Zone drop */
                                        <div
                                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                                            onDragLeave={() => setDragOver(false)}
                                            onDrop={e => {
                                                e.preventDefault(); setDragOver(false)
                                                const f = e.dataTransfer.files?.[0]
                                                if (f) handleFileDrop(f)
                                            }}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                        ${dragOver
                                                    ? 'border-[#7b61ff] bg-[#7b61ff]/10'
                                                    : 'border-[#2e2e44] hover:border-[#7b61ff]/50 hover:bg-[#1f1f2a]'}`}>
                                            <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center transition-all
                        ${dragOver ? 'bg-[#7b61ff]/20' : 'bg-[#2e2e44]'}`}>
                                                <svg width="22" height="22" fill="none" stroke={dragOver ? '#7b61ff' : '#55557a'} strokeWidth="2" viewBox="0 0 24 24">
                                                    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                                                    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                                                </svg>
                                            </div>
                                            <p className={`text-sm font-semibold mb-1 ${dragOver ? 'text-violet-400' : 'text-[#9898b8]'}`}>
                                                {dragOver ? 'Déposer ici' : 'Glissez votre fichier ici'}
                                            </p>
                                            <p className="text-xs text-[#55557a]">ou <span className="text-[#7b61ff] hover:underline">cliquez pour parcourir</span></p>
                                            <p className="text-[10px] text-[#3a3a55] mt-2">MP3, WAV, OGG, M4A · Max 50 MB</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* URL mode */}
                            {(uploadMode === 'url' || editFile) && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">URL du fichier *</label>
                                    <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                                        placeholder="https://cdn.example.com/audio/musique.mp3"
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] font-mono outline-none focus:border-[#7b61ff]" />
                                    <div className="text-[10px] text-[#55557a] mt-1">Formats : MP3, WAV, OGG, M4A</div>
                                </div>
                            )}

                            {/* Nom */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom du fichier *</label>
                                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Musique d'attente principale"
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-2">Type *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {AUDIO_TYPES.map(t => (
                                        <label key={t.value} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all
                      ${form.type === t.value ? `${t.bg} ${t.border}` : 'bg-[#111118] border-[#2e2e44] hover:border-[#3a3a55]'}`}>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${form.type === t.value ? 'border-[#7b61ff] bg-[#7b61ff]' : 'border-[#3a3a55]'}`}>
                                                {form.type === t.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                            <input type="radio" className="hidden" checked={form.type === t.value}
                                                onChange={() => setForm(p => ({ ...p, type: t.value }))} />
                                            <span className={`text-xs font-medium ${t.color}`}>{t.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Durée */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Durée (secondes)</label>
                                <input type="number" min="0" value={form.duration}
                                    onChange={e => setForm(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))}
                                    placeholder="180"
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                {form.duration > 0 && <div className="text-[10px] text-[#55557a] mt-1">= {fmtDur(form.duration)}</div>}
                            </div>

                            {/* Barre de progression upload */}
                            {saving && uploadProgress > 0 && (
                                <div>
                                    <div className="flex justify-between text-[10px] text-[#55557a] mb-1">
                                        <span>Upload en cours...</span><span>{uploadProgress}%</span>
                                    </div>
                                    <div className="h-1.5 bg-[#2e2e44] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#7b61ff] rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            {/* Note Supabase Storage */}
                            {uploadMode === 'file' && !editFile && (
                                <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg p-3 flex items-start gap-2">
                                    <svg className="text-[#7b61ff] flex-shrink-0 mt-0.5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                    <div className="text-[10px] text-[#55557a] leading-relaxed">
                                        Le fichier sera uploadé dans le bucket <code className="bg-[#2e2e44] px-1 rounded text-violet-400">audio</code> de Supabase Storage.
                                        Assurez-vous que le bucket existe et est public dans votre console Supabase.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-3 flex-shrink-0">
                            <button onClick={() => setShowModal(false)} className="flex-1 bg-[#111118] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={save} disabled={saving || (!uploadFile && !form.url)}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? (uploadProgress > 0 ? `Upload ${uploadProgress}%` : 'Sauvegarde...') : editFile ? 'Mettre à jour' : uploadFile ? 'Uploader' : 'Ajouter'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}