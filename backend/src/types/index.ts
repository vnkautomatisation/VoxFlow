export type Role = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'AGENT'
export type Plan = 'STARTER' | 'PRO' | 'ENTERPRISE'
export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'TRIAL'
export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'ON_CALL' | 'BREAK' | 'BUSY'
export type CallStatus = 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER'
export type CallDirection = 'INBOUND' | 'OUTBOUND'

export interface JwtPayload {
  userId:         string
  email:          string
  role:           Role
  organizationId: string | null
}

export interface ApiResponse<T = any> {
  success: boolean
  data?:   T
  error?:  string
  message?: string
}
