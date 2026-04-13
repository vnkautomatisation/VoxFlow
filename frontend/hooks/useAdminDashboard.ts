'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const API = () => (typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000')
const TOK = () => (typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : '')

const apiFetch = async (path: string) => {
  const r = await fetch(API() + path, {
    headers: { Authorization: 'Bearer ' + TOK(), 'Content-Type': 'application/json' },
  })
  return r.json()
}

export interface AdminStats {
  agentsOnline: number
  agentsTotal: number
  agentsBusy: number
  agentsBreak: number
  activeQueues: number
  callsToday: number
  callsAnswered: number
  avgDuration: number
  resolutionRate: number
  ivrCount: number
}

export interface AgentRow {
  id: string
  name: string
  email: string
  role: string
  status: string
  extension?: string
  created_at: string
  agentStatus?: string
  current_call?: boolean
  call_duration?: number
}

export interface QueueRow {
  id: string
  name: string
  strategy: string
  waiting: number
  active: number
  created_at: string
}

export interface CallRow {
  id: string
  from_number: string
  to_number: string
  direction: string
  status: string
  duration: number
  started_at: string
  recording_url?: string
  notes?: string
  contact?: { first_name: string; last_name: string; company?: string }
}

export interface IVRRow {
  id: string
  name: string
  description?: string
  created_at: string
}

export function useAdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    agentsOnline: 0, agentsTotal: 0, agentsBusy: 0, agentsBreak: 0,
    activeQueues: 0, callsToday: 0, callsAnswered: 0, avgDuration: 0,
    resolutionRate: 0, ivrCount: 0,
  })
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [queues, setQueues] = useState<QueueRow[]>([])
  const [calls, setCalls] = useState<CallRow[]>([])
  const [ivr, setIvr] = useState<IVRRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [statsR, agentsR, queuesR, callsR, ivrR, snapR] = await Promise.allSettled([
        apiFetch('/api/v1/admin/stats'),
        apiFetch('/api/v1/admin/agents'),
        apiFetch('/api/v1/admin/queues'),
        apiFetch(`/api/v1/admin/reports?period=${period}`),
        apiFetch('/api/v1/admin/ivr'),
        apiFetch('/api/v1/supervision/snapshot'),
      ])

      // Stats
      if (statsR.status === 'fulfilled' && statsR.value?.success) {
        const d = statsR.value.data
        setStats(prev => ({
          ...prev,
          agentsTotal:    d.agentsTotal    ?? prev.agentsTotal,
          agentsOnline:   d.agentsOnline   ?? prev.agentsOnline,
          agentsBusy:     d.agentsBusy     ?? prev.agentsBusy,
          agentsBreak:    d.agentsBreak    ?? prev.agentsBreak,
          activeQueues:   d.activeQueues   ?? prev.activeQueues,
          callsToday:     d.callsToday     ?? prev.callsToday,
          callsAnswered:  d.callsAnswered  ?? prev.callsAnswered,
          avgDuration:    d.avgDuration    ?? prev.avgDuration,
          resolutionRate: d.resolutionRate ?? prev.resolutionRate,
          ivrCount:       d.ivrCount       ?? prev.ivrCount,
        }))
      }

      // Agents
      if (agentsR.status === 'fulfilled' && agentsR.value?.success) {
        let agentList: AgentRow[] = agentsR.value.data || []
        // Merge avec snapshot supervision
        if (snapR.status === 'fulfilled' && snapR.value?.success && snapR.value?.data) {
          const snap = snapR.value.data
          const snapAgents = snap.agentStatuses || snap.agents || snap || []
          agentList = agentList.map((a: AgentRow) => {
            const s = snapAgents.find((x: any) => x.agentId === a.id || x.userId === a.id)
            return s ? { ...a, agentStatus: s.status, current_call: !!s.callId, call_duration: s.callDuration || 0 } : a
          })
          // Stats live depuis snapshot
          const online = agentList.filter(a => a.agentStatus === 'ONLINE' && !a.current_call).length
          const busy   = agentList.filter(a => a.current_call || a.agentStatus === 'BUSY').length
          const brk    = agentList.filter(a => a.agentStatus === 'BREAK').length
          setStats(prev => ({ ...prev, agentsOnline: online, agentsBusy: busy, agentsBreak: brk }))
        }
        setAgents(agentList)
      }

      // Queues
      if (queuesR.status === 'fulfilled' && queuesR.value?.success) {
        setQueues(queuesR.value.data || [])
        setStats(prev => ({ ...prev, activeQueues: (queuesR.value.data || []).length }))
      }

      // Calls / Reports
      if (callsR.status === 'fulfilled' && callsR.value?.success) {
        const d = callsR.value.data
        if (Array.isArray(d)) {
          setCalls(d)
          const completed = d.filter((c: CallRow) => c.status === 'COMPLETED').length
          const answered  = d.filter((c: CallRow) => ['COMPLETED', 'IN_PROGRESS'].includes(c.status)).length
          const avgDur    = d.length ? Math.round(d.reduce((a: number, c: CallRow) => a + (c.duration || 0), 0) / d.length) : 0
          setStats(prev => ({
            ...prev,
            callsToday:     d.length,
            callsAnswered:  answered,
            avgDuration:    avgDur,
            resolutionRate: d.length ? Math.round((completed / d.length) * 100) : 0,
          }))
        } else if (d?.calls) {
          setCalls(d.calls)
          setStats(prev => ({
            ...prev,
            callsToday:     d.total     ?? d.calls.length,
            callsAnswered:  d.answered  ?? 0,
            avgDuration:    d.avgDuration ?? 0,
            resolutionRate: d.resolutionRate ?? 0,
          }))
        }
      } else {
        // Fallback: charger les appels depuis telephony
        const fallback = await apiFetch('/api/v1/telephony/calls?limit=50')
        if (fallback?.success) {
          const d = fallback.data || []
          setCalls(d)
          const completed = d.filter((c: CallRow) => c.status === 'COMPLETED').length
          const answered  = d.filter((c: CallRow) => ['COMPLETED'].includes(c.status)).length
          const avgDur    = d.length ? Math.round(d.reduce((a: number, c: CallRow) => a + (c.duration || 0), 0) / d.length) : 0
          setStats(prev => ({
            ...prev,
            callsToday:     d.length,
            callsAnswered:  answered,
            avgDuration:    avgDur,
            resolutionRate: d.length ? Math.round((completed / d.length) * 100) : 0,
          }))
        }
      }

      // IVR
      if (ivrR.status === 'fulfilled' && ivrR.value?.success) {
        setIvr(ivrR.value.data || [])
        setStats(prev => ({ ...prev, ivrCount: (ivrR.value.data || []).length }))
      }

      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadAll()
    pollRef.current = setInterval(loadAll, 20000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadAll])

  const deactivateAgent = async (agentId: string) => {
    await apiFetch(`/api/v1/admin/agents/${agentId}`, { method: 'DELETE' }).catch(() => {})
    loadAll()
  }

  const createAgent = async (data: { email: string; name: string; password: string; extension?: string }) => {
    const r = await apiFetch('/api/v1/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => ({ success: false }))
    loadAll()
    return r
  }

  const createQueue = async (name: string, strategy: string) => {
    await apiFetch('/api/v1/admin/queues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, strategy }),
    }).catch(() => {})
    loadAll()
  }

  return {
    stats, agents, queues, calls, ivr,
    loading, error, period, setPeriod,
    refresh: loadAll, deactivateAgent, createAgent, createQueue,
  }
}
