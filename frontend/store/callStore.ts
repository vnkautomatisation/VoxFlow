import { create } from "zustand"

export type CallState  = "idle" | "ringing_in" | "ringing_out" | "in_call" | "on_hold" | "wrap_up"
export type AgentStatus = "ONLINE" | "OFFLINE" | "BREAK" | "BUSY" | "ON_CALL"

export interface ActiveCall {
  id:          string
  from:        string
  to:          string
  direction:   "INBOUND" | "OUTBOUND"
  startedAt:   Date
  duration:    number
  contact?:    {
    id:        string
    firstName: string
    lastName:  string
    company?:  string
    phone?:    string
  } | null
}

interface CallStore {
  callState:    CallState
  agentStatus:  AgentStatus
  activeCall:   ActiveCall | null
  isMuted:      boolean
  isOnHold:     boolean
  isRecording:  boolean
  notes:        string
  duration:     number
  device:       any
  isMinimized:  boolean

  setCallState:      (s: CallState)      => void
  setAgentStatus:    (s: AgentStatus)    => void
  setActiveCall:     (c: ActiveCall | null) => void
  setMuted:          (v: boolean)        => void
  setOnHold:         (v: boolean)        => void
  setRecording:      (v: boolean)        => void
  setNotes:          (n: string)         => void
  setDevice:         (d: any)            => void
  setMinimized:      (v: boolean)        => void
  incrementDuration: ()                  => void
  setContact:        (c: any)            => void
  reset:             ()                  => void
}

export const useCallStore = create<CallStore>((set) => ({
  callState:   "idle",
  agentStatus: "OFFLINE",
  activeCall:  null,
  isMuted:     false,
  isOnHold:    false,
  isRecording: false,
  notes:       "",
  duration:    0,
  device:      null,
  isMinimized: false,

  setCallState:      (callState)   => set({ callState }),
  setAgentStatus:    (agentStatus) => set({ agentStatus }),
  setActiveCall:     (activeCall)  => set({ activeCall }),
  setMuted:          (isMuted)     => set({ isMuted }),
  setOnHold:         (isOnHold)    => set({ isOnHold }),
  setRecording:      (isRecording) => set({ isRecording }),
  setNotes:          (notes)       => set({ notes }),
  setDevice:         (device)      => set({ device }),
  setMinimized:      (isMinimized) => set({ isMinimized }),
  incrementDuration: ()            => set((s) => ({ duration: s.duration + 1 })),
  setContact:        (contact)     => set((s) => ({
    activeCall: s.activeCall ? { ...s.activeCall, contact } : null
  })),
  reset: () => set({
    callState: "idle", activeCall: null,
    isMuted: false, isOnHold: false, isRecording: false,
    notes: "", duration: 0
  }),
}))
