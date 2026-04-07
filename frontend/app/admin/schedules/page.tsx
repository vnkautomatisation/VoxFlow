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

const DAYS = [
    { key: 'monday', label: 'Lundi' },
    { key: 'tuesday', label: 'Mardi' },
    { key: 'wednesday', label: 'Mercredi' },
    { key: 'thursday', label: 'Jeudi' },
    { key: 'friday', label: 'Vendredi' },
    { key: 'saturday', label: 'Samedi' },
    { key: 'sunday', label: 'Dimanche' },
]

const TIMEZONES = [
    'America/Toronto', 'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles', 'America/Vancouver',
    'Europe/Paris', 'Europe/London', 'UTC',
]

interface DayHours { enabled: boolean; open: string; close: string }
interface Schedule {
    id: string; name: string; timezone: string
    hours: Record<string, DayHours>
    holidays: any[]; holiday_dates: string[]
    closed_message: string; is_active: boolean; created_at: string
}

const EMPTY_SCHEDULE = {
    name: 'Heures d\'ouverture',
    timezone: 'America/Toronto',
    closed_message: 'Nous sommes actuellement fermés. Nos heures d\'ouverture sont du lundi au vendredi, de 9h à 17h.',
    hours: Object.fromEntries(DAYS.map(d => [d.key, {
        enabled: !['saturday', 'sunday'].includes(d.key),
        open: '09:00', close: '17:00'
    }])),
    holidays: [], holiday_dates: [],
}

export default function SchedulesPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Schedule | null>(null)
    const [showDrawer, setShowDrawer] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [editForm, setEditForm] = useState<any>({})
    const [newForm, setNewForm] = useState<any>(EMPTY_SCHEDULE)
    const [saving, setSaving] = useState(false)
    const [newHoliday, setNewHoliday] = useState('')
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

    const load = useCallback(async () => {
        try {
            const r = await apiFetch('/api/v1/queues/schedules')
            if (r.success) setSchedules(r.data || [])
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const openDrawer = (s: Schedule) => {
        setSelected(s)
        setEditForm(JSON.parse(JSON.stringify(s)))
        setShowDrawer(true)
    }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        try {
            const r = await apiFetch(`/api/v1/queues/schedules/${selected.id}`, {
                method: 'PATCH', body: JSON.stringify(editForm)
            })
            if (r.success || r.data) { showToast('Horaires sauvegardés ✓'); setShowDrawer(false); load() }
            else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const create = async () => {
        if (!newForm.name) { showToast('Nom requis', 'err'); return }
        setSaving(true)
        try {
            const r = await apiFetch('/api/v1/queues/schedules', {
                method: 'POST', body: JSON.stringify(newForm)
            })
            if (r.success || r.data) { showToast('Horaire créé ✓'); setShowNew(false); setNewForm(EMPTY_SCHEDULE); load() }
            else showToast(r.error || r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const updateDay = (form: any, setForm: any, day: string, field: string, value: any) => {
        setForm((p: any) => ({
            ...p, hours: { ...p.hours, [day]: { ...p.hours?.[day], [field]: value } }
        }))
    }

    const addHoliday = (form: any, setForm: any) => {
        if (!newHoliday) return
        setForm((p: any) => ({ ...p, holiday_dates: [...(p.holiday_dates || []), newHoliday] }))
        setNewHoliday('')
    }

    const removeHoliday = (form: any, setForm: any, date: string) => {
        setForm((p: any) => ({ ...p, holiday_dates: (p.holiday_dates || []).filter((d: string) => d !== date) }))
    }

    const DayRow = ({ form, setForm, day }: { form: any; setForm: any; day: typeof DAYS[0] }) => {
        const h = form.hours?.[day.key] || { enabled: false, open: '09:00', close: '17:00' }
        return (
            <div className={`flex items-center gap-4 p-3 rounded-lg border transition-all
        ${h.enabled ? 'bg-[#1f1f2a] border-[#2e2e44]' : 'bg-[#18181f] border-[#1f1f2a] opacity-60'}`}>
                {/* Toggle */}
                <div className={`w-9 h-5 rounded-full transition-all relative cursor-pointer flex-shrink-0
          ${h.enabled ? 'bg-[#7b61ff]' : 'bg-[#2e2e44]'}`}
                    onClick={() => updateDay(form, setForm, day.key, 'enabled', !h.enabled)}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${h.enabled ? 'left-4' : 'left-0.5'}`} />
                </div>
                {/* Nom jour */}
                <div className="w-20 text-xs font-semibold text-[#9898b8]">{day.label}</div>
                {/* Heures */}
                {h.enabled ? (
                    <div className="flex items-center gap-2 flex-1">
                        <input type="time" value={h.open}
                            onChange={e => updateDay(form, setForm, day.key, 'open', e.target.value)}
                            className="bg-[#111118] border border-[#2e2e44] rounded-lg px-2 py-1.5 text-xs text-[#eeeef8] outline-none focus:border-[#7b61ff] font-mono" />
                        <span className="text-[#55557a] text-xs">—</span>
                        <input type="time" value={h.close}
                            onChange={e => updateDay(form, setForm, day.key, 'close', e.target.value)}
                            className="bg-[#111118] border border-[#2e2e44] rounded-lg px-2 py-1.5 text-xs text-[#eeeef8] outline-none focus:border-[#7b61ff] font-mono" />
                        <span className="text-[10px] text-emerald-400 ml-1">Ouvert</span>
                    </div>
                ) : (
                    <div className="flex-1 text-xs text-[#3a3a55] italic">Fermé</div>
                )}
            </div>
        )
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement des horaires...</div>
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

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Horaires d'ouverture</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{schedules.length} horaire{schedules.length > 1 ? 's' : ''} configuré{schedules.length > 1 ? 's' : ''}</div>
                </div>
                <button onClick={() => { setNewForm(JSON.parse(JSON.stringify(EMPTY_SCHEDULE))); setShowNew(true) }}
                    className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors flex items-center gap-2">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Nouvel horaire
                </button>
            </div>

            {schedules.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    <p className="text-sm font-medium text-[#55557a]">Aucun horaire configuré</p>
                    <button onClick={() => setShowNew(true)} className="text-xs text-[#7b61ff] hover:underline mt-2">Créer le premier horaire</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {schedules.map(s => {
                        const openDays = DAYS.filter(d => s.hours?.[d.key]?.enabled)
                        return (
                            <div key={s.id} className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden hover:border-[#3a3a55] transition-all">
                                <div className="flex items-center gap-4 px-5 py-4">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.is_active ? 'bg-emerald-400' : 'bg-zinc-500'}`}
                                        style={{ boxShadow: s.is_active ? '0 0 8px rgba(0,212,170,.5)' : 'none' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-[#eeeef8]">{s.name}</div>
                                        <div className="text-xs text-[#55557a] mt-0.5">{s.timezone}</div>
                                    </div>
                                    <button onClick={() => openDrawer(s)}
                                        className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors">
                                        Modifier
                                    </button>
                                </div>

                                {/* Aperçu jours */}
                                <div className="border-t border-[#1f1f2a] px-5 py-3">
                                    <div className="flex gap-1 flex-wrap">
                                        {DAYS.map(d => {
                                            const h = s.hours?.[d.key]
                                            const isOpen = h?.enabled
                                            return (
                                                <div key={d.key} className={`text-[9px] font-bold px-2 py-1 rounded-lg
                          ${isOpen ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-[#1f1f2a] text-[#3a3a55]'}`}>
                                                    {d.label.substring(0, 3).toUpperCase()}
                                                    {isOpen && <span className="ml-1 opacity-70">{h.open}–{h.close}</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {(s.holiday_dates || []).length > 0 && (
                                        <div className="text-[10px] text-[#55557a] mt-2">
                                            {(s.holiday_dates || []).length} jour{(s.holiday_dates || []).length > 1 ? 's' : ''} férié{(s.holiday_dates || []).length > 1 ? 's' : ''} configuré{(s.holiday_dates || []).length > 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Drawer modifier */}
            {showDrawer && selected && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
                    <div className="w-[520px] bg-[#111118] border-l border-[#2e2e44] flex flex-col h-full">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] bg-[#18181f]">
                            <div>
                                <div className="font-bold text-[#eeeef8]">{selected.name}</div>
                                <div className="text-xs text-[#55557a]">Modifier les horaires</div>
                            </div>
                            <button onClick={() => setShowDrawer(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Infos générales */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Général<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom</label>
                                        <input value={editForm.name || ''} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Fuseau horaire</label>
                                        <select value={editForm.timezone || 'America/Toronto'} onChange={e => setEditForm((p: any) => ({ ...p, timezone: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Message si fermé (TTS)</label>
                                        <textarea value={editForm.closed_message || ''} rows={2}
                                            onChange={e => setEditForm((p: any) => ({ ...p, closed_message: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-none" />
                                    </div>
                                </div>
                            </section>

                            {/* Jours et heures */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Jours et heures<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="space-y-2">
                                    {DAYS.map(d => <DayRow key={d.key} form={editForm} setForm={setEditForm} day={d} />)}
                                </div>
                            </section>

                            {/* Jours fériés */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Jours fériés<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)}
                                        className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    <button onClick={() => addHoliday(editForm, setEditForm)}
                                        disabled={!newHoliday}
                                        className="bg-[#7b61ff]/20 text-violet-400 border border-violet-400/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#7b61ff]/30 disabled:opacity-40 transition-colors">
                                        Ajouter
                                    </button>
                                </div>
                                {(editForm.holiday_dates || []).length === 0 ? (
                                    <div className="text-xs text-[#3a3a55] italic">Aucun jour férié configuré</div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {(editForm.holiday_dates || []).map((date: string) => (
                                            <div key={date} className="flex items-center justify-between bg-[#1f1f2a] rounded-lg px-3 py-2">
                                                <span className="text-xs font-mono text-[#9898b8]">{date}</span>
                                                <button onClick={() => removeHoliday(editForm, setEditForm, date)}
                                                    className="text-[#55557a] hover:text-rose-400 transition-colors">
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
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

            {/* Modal nouvel horaire */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] flex-shrink-0">
                            <h3 className="font-bold text-[#eeeef8]">Nouvel horaire</h3>
                            <button onClick={() => setShowNew(false)} className="text-[#55557a] hover:text-[#eeeef8]">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom *</label>
                                <input value={newForm.name} onChange={e => setNewForm((p: any) => ({ ...p, name: e.target.value }))}
                                    placeholder="Heures d'ouverture principale"
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Fuseau horaire</label>
                                <select value={newForm.timezone} onChange={e => setNewForm((p: any) => ({ ...p, timezone: e.target.value }))}
                                    className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a]">Jours et heures</label>
                                {DAYS.map(d => <DayRow key={d.key} form={newForm} setForm={setNewForm} day={d} />)}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-3 flex-shrink-0">
                            <button onClick={() => setShowNew(false)} className="flex-1 bg-[#111118] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={create} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Création...' : 'Créer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}