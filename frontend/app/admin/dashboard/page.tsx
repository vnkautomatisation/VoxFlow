'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminDashboard, CallRow, AgentRow } from '../../../hooks/useAdminDashboard'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

const fmtT = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtD = (dt: string) => {
  if (!dt) return ''
  const d = new Date(dt), df = (Date.now() - d.getTime()) / 1000
  if (df < 60) return 'À l\'instant'
  if (df < 3600) return `${Math.floor(df / 60)}min`
  if (df < 86400) return `${Math.floor(df / 3600)}h`
  return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' })
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'text-emerald-400', RINGING: 'text-amber-400',
  IN_PROGRESS: 'text-sky-400', NO_ANSWER: 'text-rose-400',
  BUSY: 'text-amber-400', FAILED: 'text-rose-400', CANCELLED: 'text-zinc-400',
}
const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Terminé', RINGING: 'Sonnerie', IN_PROGRESS: 'En cours',
  NO_ANSWER: 'Sans réponse', BUSY: 'Occupé', FAILED: 'Échec', CANCELLED: 'Annulé',
}

type Tab = 'overview' | 'agents' | 'queues' | 'reports' | 'ivr'

export default function AdminDashboardPage() {
  const {
    stats, agents, queues, calls, ivr,
    loading, period, setPeriod, refresh, deactivateAgent,
  } = useAdminDashboard()

  const [tab, setTab] = useState<Tab>('overview')
  const [callFilter, setCallFilter] = useState<'all' | 'INBOUND' | 'OUTBOUND' | 'MISSED'>('all')
  const [showNewAgent, setShowNewAgent] = useState(false)
  const [showNewQueue, setShowNewQueue] = useState(false)
  const [newAgent, setNewAgent] = useState({ email: '', name: '', password: '', extension: '' })
  const [newQueue, setNewQueue] = useState({ name: '', strategy: 'ROUND_ROBIN' })

  const filteredCalls = calls.filter(c => {
    if (callFilter === 'all') return true
    if (callFilter === 'INBOUND') return c.direction === 'INBOUND'
    if (callFilter === 'OUTBOUND') return c.direction === 'OUTBOUND'
    if (callFilter === 'MISSED') return ['NO_ANSWER', 'MISSED'].includes(c.status)
    return true
  })

  const KPI = ({ label, value, color = 'text-violet-400', sub }: { label: string; value: string | number; color?: string; sub?: string }) => (
    <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#55557a] mt-1">{sub}</div>}
    </div>
  )

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Vue globale' },
    { id: 'agents', label: 'Agents', count: agents.length },
    { id: 'queues', label: 'Files', count: queues.length },
    { id: 'reports', label: 'Rapports' },
    { id: 'ivr', label: 'IVR', count: ivr.length },
  ]

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-[#55557a] text-sm animate-pulse">Chargement du tableau de bord...</div>
    </div>
  )

  return (
    <div className="h-[calc(100vh-49px)] overflow-hidden flex flex-col">
      {error && (
        <div className="mx-4 mt-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {error}
        </div>
      )}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-6 flex-shrink-0">

        {/* Header — responsive stack sur mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#eeeef8] truncate">Tableau de bord</h1>
            <div className="text-xs text-[#55557a] mt-0.5">Mise à jour toutes les 20s</div>
          </div>
          <button onClick={refresh}
            className="self-start sm:self-auto text-xs bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-1.5 rounded-lg hover:text-[#eeeef8] hover:border-[#7b61ff]/30 transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Rafraîchir
          </button>
        </div>

        {/* Tabs — scrollables horizontalement sur petit écran */}
        <div className="flex gap-1 border-b border-[#2e2e44] overflow-x-auto scrollbar-hide -mx-4 sm:-mx-0 px-4 sm:px-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0
                ${tab === t.id ? 'text-[#eeeef8] border-[#7b61ff]' : 'text-[#55557a] border-transparent hover:text-[#9898b8]'}`}>
              {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Zone contenu scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">

      {/* ── VUE GLOBALE ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI label="Agents en ligne" value={`${stats.agentsOnline}/${stats.agentsTotal}`} color="text-emerald-400" />
            <KPI label="En appel" value={stats.agentsBusy} color="text-rose-400" />
            <KPI label="En pause" value={stats.agentsBreak} color="text-amber-400" />
            <KPI label="Appels (30j)" value={stats.callsToday} color="text-violet-400" />
            <KPI label="Durée moy." value={fmtT(stats.avgDuration)} color="text-sky-400" />
            <KPI label="Résolution" value={`${stats.resolutionRate}%`} color="text-emerald-400" />
          </div>

          {/* Agents + Files */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Agents récents */}
            <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold uppercase tracking-widest text-[#55557a]">Agents</div>
                <button onClick={() => setTab('agents')} className="text-xs text-[#7b61ff] hover:underline">Voir tout</button>
              </div>
              <div className="space-y-2">
                {agents.slice(0, 5).map(a => {
                  const st = a.current_call ? 'busy' : (a.agentStatus || a.status || 'OFFLINE').toLowerCase()
                  const stColors: Record<string, string> = { online: 'bg-emerald-400', busy: 'bg-rose-400', break: 'bg-amber-400', offline: 'bg-zinc-600', active: 'bg-emerald-400' }
                  const stLabels: Record<string, string> = { online: 'Disponible', busy: 'En appel', break: 'Pause', offline: 'Hors ligne', active: 'Actif' }
                  const ini = (a.name || 'A').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                  return (
                    <div key={a.id} className="flex items-center gap-3 py-2 border-b border-[#1f1f2a] last:border-0">
                      <div className="w-8 h-8 rounded-full bg-[#2d1a80] flex items-center justify-center text-xs font-bold text-[#a78bfa] flex-shrink-0">
                        {ini}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#eeeef8] truncate">{a.name}</div>
                        <div className="text-[10px] text-[#55557a]">{a.email}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${stColors[st] || 'bg-zinc-600'}`} />
                        <span className="text-[10px] text-[#9898b8]">{stLabels[st] || st}</span>
                      </div>
                    </div>
                  )
                })}
                {!agents.length && <div className="text-center text-[#55557a] text-sm py-4">Aucun agent</div>}
              </div>
            </div>

            {/* Files + Appels récents */}
            <div className="space-y-4">
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#55557a]">Files d'attente</div>
                  <button onClick={() => setTab('queues')} className="text-xs text-[#7b61ff] hover:underline">Voir tout</button>
                </div>
                <div className="space-y-2">
                  {queues.slice(0, 3).map(q => (
                    <div key={q.id} className="flex items-center justify-between py-1.5 border-b border-[#1f1f2a] last:border-0">
                      <div>
                        <div className="text-sm font-medium text-[#eeeef8]">{q.name}</div>
                        <div className="text-[10px] text-[#55557a]">{q.strategy}</div>
                      </div>
                      <div className="text-[10px] text-[#9898b8]">{q.waiting || 0} en attente</div>
                    </div>
                  ))}
                  {!queues.length && <div className="text-center text-[#55557a] text-sm py-2">Aucune file</div>}
                </div>
              </div>

              {/* Stats rapides */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-3 text-center">
                  <div className="text-lg font-bold font-mono text-violet-400">{stats.callsAnswered}</div>
                  <div className="text-[9px] text-[#55557a] font-bold uppercase tracking-wider mt-0.5">Répondus</div>
                </div>
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-3 text-center">
                  <div className="text-lg font-bold font-mono text-sky-400">{stats.activeQueues}</div>
                  <div className="text-[9px] text-[#55557a] font-bold uppercase tracking-wider mt-0.5">Files actives</div>
                </div>
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-3 text-center">
                  <div className="text-lg font-bold font-mono text-amber-400">{stats.ivrCount}</div>
                  <div className="text-[9px] text-[#55557a] font-bold uppercase tracking-wider mt-0.5">Menus IVR</div>
                </div>
              </div>
            </div>
          </div>

          {/* Derniers appels */}
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[#55557a]">Derniers appels</div>
              <button onClick={() => setTab('reports')} className="text-xs text-[#7b61ff] hover:underline">Voir tout</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#55557a] border-b border-[#2e2e44]">
                    <th className="text-left py-2 pr-4 font-bold uppercase tracking-wider">De</th>
                    <th className="text-left py-2 pr-4 font-bold uppercase tracking-wider">Vers</th>
                    <th className="text-left py-2 pr-4 font-bold uppercase tracking-wider">Statut</th>
                    <th className="text-left py-2 pr-4 font-bold uppercase tracking-wider">Durée</th>
                    <th className="text-left py-2 font-bold uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.slice(0, 6).map(c => (
                    <tr key={c.id} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a] transition-colors">
                      <td className="py-2 pr-4 font-mono text-[#9898b8]">{c.from_number || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-[#9898b8]">{c.to_number || '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`font-bold ${STATUS_COLORS[c.status] || 'text-zinc-400'}`}>
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-[#9898b8]">{c.duration ? fmtT(c.duration) : '—'}</td>
                      <td className="py-2 text-[#55557a]">{fmtD(c.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!calls.length && <div className="text-center text-[#55557a] py-6">Aucun appel</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── AGENTS ── */}
      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[#9898b8]">{agents.length} agent{agents.length > 1 ? 's' : ''}</div>
            <button onClick={() => setShowNewAgent(true)}
              className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors">
              + Nouvel agent
            </button>
          </div>

          {/* Modal nouveau agent */}
          {showNewAgent && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl p-6 w-full max-w-md">
                <h3 className="font-bold text-[#eeeef8] mb-4">Nouvel agent</h3>
                <div className="space-y-3">
                  {[
                    { key: 'name', label: 'Nom complet', type: 'text' },
                    { key: 'email', label: 'Email', type: 'email' },
                    { key: 'password', label: 'Mot de passe', type: 'password' },
                    { key: 'extension', label: 'Extension (optionnel)', type: 'text' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}</label>
                      <input type={f.type}
                        value={(newAgent as any)[f.key]}
                        onChange={e => setNewAgent(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowNewAgent(false)}
                    className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-sm">
                    Annuler
                  </button>
                  <button onClick={async () => {
                    if (!newAgent.email || !newAgent.name) return
                    await createAgent(newAgent)
                    setShowNewAgent(false)
                    setNewAgent({ email: '', name: '', password: '', extension: '' })
                  }} className="flex-1 bg-[#7b61ff] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#6145ff]">
                    Créer
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#55557a] border-b border-[#2e2e44] bg-[#1f1f2a]">
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Agent</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Rôle</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Depuis</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => {
                  const st = a.current_call ? 'busy' : (a.agentStatus || a.status || 'OFFLINE').toLowerCase()
                  const stColors: Record<string, string> = { online: 'text-emerald-400 bg-emerald-400/10', busy: 'text-rose-400 bg-rose-400/10', break: 'text-amber-400 bg-amber-400/10', offline: 'text-zinc-400 bg-zinc-400/10', active: 'text-emerald-400 bg-emerald-400/10' }
                  const stLabels: Record<string, string> = { online: 'Disponible', busy: 'En appel', break: 'Pause', offline: 'Hors ligne', active: 'Actif' }
                  const ini = (a.name || 'A').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                  return (
                    <tr key={a.id} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2d1a80] flex items-center justify-center text-xs font-bold text-[#a78bfa] flex-shrink-0">{ini}</div>
                          <div>
                            <div className="font-medium text-[#eeeef8]">{a.name}</div>
                            <div className="text-[10px] text-[#55557a]">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-400/10 text-sky-400">{a.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stColors[st] || 'text-zinc-400 bg-zinc-400/10'}`}>
                          {stLabels[st] || st}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#55557a]">{a.created_at ? new Date(a.created_at).toLocaleDateString('fr-CA') : '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deactivateAgent(a.id)}
                          className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-2 py-1 rounded-lg hover:bg-rose-400/20 transition-colors">
                          Désactiver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!agents.length && <div className="text-center text-[#55557a] py-8">Aucun agent</div>}
          </div>
        </div>
      )}

      {/* ── FILES ── */}
      {tab === 'queues' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[#9898b8]">{queues.length} file{queues.length > 1 ? 's' : ''}</div>
            <button onClick={() => setShowNewQueue(true)}
              className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors">
              + Nouvelle file
            </button>
          </div>

          {showNewQueue && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl p-6 w-full max-w-md">
                <h3 className="font-bold text-[#eeeef8] mb-4">Nouvelle file</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom</label>
                    <input type="text" value={newQueue.name} onChange={e => setNewQueue(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Stratégie</label>
                    <select value={newQueue.strategy} onChange={e => setNewQueue(p => ({ ...p, strategy: e.target.value }))}
                      className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                      <option value="ROUND_ROBIN">Tournant</option>
                      <option value="LEAST_BUSY">Moins occupé</option>
                      <option value="PRIORITY">Priorité</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowNewQueue(false)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-sm">Annuler</button>
                  <button onClick={async () => {
                    if (!newQueue.name) return
                    await createQueue(newQueue.name, newQueue.strategy)
                    setShowNewQueue(false)
                    setNewQueue({ name: '', strategy: 'ROUND_ROBIN' })
                  }} className="flex-1 bg-[#7b61ff] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#6145ff]">Créer</button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queues.map(q => (
              <div key={q.id} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-[#eeeef8]">{q.name}</div>
                    <div className="text-[10px] text-[#55557a] mt-0.5">{q.strategy}</div>
                  </div>
                  <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1f1f2a] rounded-lg p-2 text-center">
                    <div className="text-lg font-bold font-mono text-amber-400">{q.waiting || 0}</div>
                    <div className="text-[9px] text-[#55557a] uppercase tracking-wider">En attente</div>
                  </div>
                  <div className="bg-[#1f1f2a] rounded-lg p-2 text-center">
                    <div className="text-lg font-bold font-mono text-emerald-400">{q.active || 0}</div>
                    <div className="text-[9px] text-[#55557a] uppercase tracking-wider">Actifs</div>
                  </div>
                </div>
                <div className="text-[10px] text-[#55557a] mt-3">Créé le {new Date(q.created_at).toLocaleDateString('fr-CA')}</div>
              </div>
            ))}
            {!queues.length && (
              <div className="col-span-2 bg-[#18181f] border border-[#2e2e44] rounded-xl p-8 text-center text-[#55557a]">
                Aucune file d'attente configurée
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RAPPORTS ── */}
      {tab === 'reports' && (
        <div className="space-y-4">
          {/* Période */}
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-colors
                  ${period === p ? 'bg-[#7b61ff] text-white' : 'bg-[#1f1f2a] text-[#9898b8] hover:text-[#eeeef8]'}`}>
                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
              </button>
            ))}
          </div>

          {/* KPIs rapports */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI label="Total appels" value={stats.callsToday} />
            <KPI label="Répondus" value={stats.callsAnswered} color="text-emerald-400" />
            <KPI label="Taux résolution" value={`${stats.resolutionRate}%`} color="text-emerald-400" />
            <KPI label="Durée moy." value={fmtT(stats.avgDuration)} color="text-sky-400" />
            <KPI label="Entrants" value={calls.filter(c => c.direction === 'INBOUND').length} color="text-violet-400" />
            <KPI label="Sortants" value={calls.filter(c => c.direction === 'OUTBOUND').length} color="text-amber-400" />
          </div>

          {/* Charts */}
          {calls.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Area chart - volume par jour */}
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-3">Volume d'appels</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={(() => {
                    const days: Record<string, number> = {}
                    calls.forEach(c => { const d = new Date(c.started_at).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' }); days[d] = (days[d] || 0) + 1 })
                    return Object.entries(days).slice(-7).map(([d, v]) => ({ day: d, count: v }))
                  })()}>
                    <defs><linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7b61ff" stopOpacity={0.3} /><stop offset="100%" stopColor="#7b61ff" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#55557a' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: '#18181f', border: '1px solid #2e2e44', borderRadius: 8, fontSize: 11, color: '#eeeef8' }} />
                    <Area type="monotone" dataKey="count" stroke="#7b61ff" fill="url(#gVol)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Bar chart - entrants vs sortants */}
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-3">Direction</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={[
                    { name: 'Entrants', value: calls.filter(c => c.direction === 'INBOUND').length },
                    { name: 'Sortants', value: calls.filter(c => c.direction === 'OUTBOUND').length },
                  ]}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9898b8' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: '#18181f', border: '1px solid #2e2e44', borderRadius: 8, fontSize: 11, color: '#eeeef8' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      <Cell fill="#7b61ff" />
                      <Cell fill="#00d4aa" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Pie chart - statuts */}
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-3">Statuts</div>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={(() => {
                      const s: Record<string, number> = {}
                      calls.forEach(c => { s[c.status] = (s[c.status] || 0) + 1 })
                      const colors: Record<string, string> = { COMPLETED: '#00d4aa', IN_PROGRESS: '#7b61ff', NO_ANSWER: '#ffb547', MISSED: '#ff4d6d', BUSY: '#ff4d6d', FAILED: '#ff4d6d' }
                      return Object.entries(s).map(([name, value]) => ({ name, value, fill: colors[name] || '#55557a' }))
                    })()} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                    </Pie>
                    <Tooltip contentStyle={{ background: '#18181f', border: '1px solid #2e2e44', borderRadius: 8, fontSize: 11, color: '#eeeef8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Filtres + Table */}
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-[#2e2e44]">
              {(['all', 'INBOUND', 'OUTBOUND', 'MISSED'] as const).map(f => (
                <button key={f} onClick={() => setCallFilter(f)}
                  className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors
                    ${callFilter === f ? 'bg-violet-400/20 text-violet-400 border border-violet-400/30' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                  {f === 'all' ? 'Tous' : f === 'INBOUND' ? 'Entrants' : f === 'OUTBOUND' ? 'Sortants' : 'Manqués'}
                </button>
              ))}
              <div className="ml-auto text-[10px] text-[#55557a]">{filteredCalls.length} appel{filteredCalls.length > 1 ? 's' : ''}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#55557a] border-b border-[#2e2e44] bg-[#1f1f2a]">
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Contact</th>
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">De</th>
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Vers</th>
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Dir.</th>
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Statut</th>
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Durée</th>
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Audio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.map(c => (
                    <tr key={c.id} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a] transition-colors">
                      <td className="px-4 py-2.5 text-[#eeeef8]">
                        {c.contact ? `${c.contact.first_name} ${c.contact.last_name}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#9898b8]">{c.from_number || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-[#9898b8]">{c.to_number || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[9px] font-bold ${c.direction === 'INBOUND' ? 'text-emerald-400' : 'text-sky-400'}`}>
                          {c.direction === 'INBOUND' ? '↓ Entrant' : '↑ Sortant'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-bold ${STATUS_COLORS[c.status] || 'text-zinc-400'}`}>
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#9898b8]">{c.duration ? fmtT(c.duration) : '—'}</td>
                      <td className="px-4 py-2.5 text-[#55557a]">{fmtD(c.started_at)}</td>
                      <td className="px-4 py-2.5">
                        {c.recording_url && (
                          <button
                            onClick={() => {
                              const tok = localStorage.getItem('vf_tok')
                              const base = localStorage.getItem('vf_url') || 'http://localhost:4000'
                              const proxyUrl = c.recording_url!.includes('twilio.com') && tok
                                ? `${base}/api/v1/telephony/recording-proxy?url=${encodeURIComponent(c.recording_url!)}`
                                : c.recording_url!
                              window.open(proxyUrl, '_blank')
                            }}
                            className="text-[10px] font-bold text-sky-400 border border-sky-400/30 bg-sky-400/10 px-2 py-1 rounded-lg hover:bg-sky-400/20 transition-colors">
                            ▶ Audio
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredCalls.length && <div className="text-center text-[#55557a] py-8">Aucun appel</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── IVR ── */}
      {tab === 'ivr' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[#9898b8]">{ivr.length} menu{ivr.length > 1 ? 's' : ''} IVR</div>
            <button onClick={() => router.push('/admin/ivr')} className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] transition-colors">
              + Nouveau menu IVR
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ivr.map(i => (
              <div key={i.id} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                <div className="font-semibold text-[#eeeef8] mb-1">{i.name}</div>
                {i.description && <div className="text-xs text-[#55557a]">{i.description}</div>}
                <div className="text-[10px] text-[#55557a] mt-3">Créé le {new Date(i.created_at).toLocaleDateString('fr-CA')}</div>
              </div>
            ))}
            {!ivr.length && (
              <div className="col-span-2 bg-[#18181f] border border-[#2e2e44] rounded-xl p-8 text-center text-[#55557a]">
                Aucun menu IVR configuré
              </div>
            )}
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  )
}
