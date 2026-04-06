import { supabaseAdmin } from '../../config/supabase'
import { hashPassword, comparePassword } from '../../utils/hash'
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt'
import { JwtPayload, Role } from '../../types'

interface RegisterDto {
  email:           string
  password:        string
  name:            string
  role:            Role
  organizationId?: string
}

interface LoginDto {
  email:    string
  password: string
}

export class AuthService {

  // ── Inscription ──────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single()

    if (existing) throw new Error('Cet email est deja utilise')

    const passwordHash = await hashPassword(dto.password)

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:         dto.email,
      password:      dto.password,
      email_confirm: true,
    })
    if (authError) throw new Error(authError.message)

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id:              authUser.user.id,
        email:           dto.email,
        name:            dto.name,
        role:            dto.role,
        password_hash:   passwordHash,
        organization_id: dto.organizationId || null,
        status:          'ACTIVE',
      })
      .select()
      .single()

    if (userError) throw new Error(userError.message)

    const payload: JwtPayload = {
      userId:         user.id,
      email:          user.email,
      role:           user.role,
      organizationId: user.organization_id,
    }

    return {
      user: this._formatUser(user, null),
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    }
  }

  // ── Connexion ────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        agents!agents_user_id_fkey (
          extension,
          status
        ),
        organizations!users_organization_id_fkey (
          plan,
          name,
          status
        )
      `)
      .eq('email', dto.email)
      .single()

    if (error || !user) throw new Error('Email ou mot de passe incorrect')
    if (user.status !== 'ACTIVE') throw new Error('Compte suspendu ou inactif')

    const isValid = await comparePassword(dto.password, user.password_hash)
    if (!isValid) throw new Error('Email ou mot de passe incorrect')

    const payload: JwtPayload = {
      userId:         user.id,
      email:          user.email,
      role:           user.role,
      organizationId: user.organization_id,
    }

    const agent = Array.isArray(user.agents) ? user.agents[0] : user.agents
    const org   = Array.isArray(user.organizations) ? user.organizations[0] : user.organizations

    return {
      user:        this._formatUser(user, agent, org),
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    }
  }

  // ── Profil utilisateur connecté ──────────────────────────────
  async getMe(userId: string) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        id, email, name, first_name, last_name, role,
        organization_id, status, created_at, avatar_url,
        agent_status, last_seen_at,
        agents!agents_user_id_fkey (
          extension,
          status,
          skills,
          max_concurrent
        ),
        organizations!users_organization_id_fkey (
          plan,
          name,
          status,
          seats
        )
      `)
      .eq('id', userId)
      .single()

    if (error || !user) throw new Error('Utilisateur non trouve')

    const agent = Array.isArray(user.agents) ? user.agents[0] : user.agents
    const org   = Array.isArray(user.organizations) ? user.organizations[0] : user.organizations

    return this._formatUser(user, agent, org)
  }

  // ── Refresh token ────────────────────────────────────────────
  async refreshToken(userId: string) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !user) throw new Error('Utilisateur non trouve')

    const payload: JwtPayload = {
      userId:         user.id,
      email:          user.email,
      role:           user.role,
      organizationId: user.organization_id,
    }

    return {
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    }
  }

  // ── Helper formatage utilisateur ─────────────────────────────
  private _formatUser(user: any, agent: any, org?: any) {
    // Déterminer le plan d'accès au dialer
    const orgPlan   = org?.plan || 'STARTER'
    const dialerPlan = this._resolveDialerPlan(orgPlan, user.role)

    return {
      id:              user.id,
      email:           user.email,
      name:            user.name,
      first_name:      user.first_name || null,
      last_name:       user.last_name  || null,
      role:            user.role,
      organization_id: user.organization_id,
      status:          user.status,
      avatar_url:      user.avatar_url  || null,
      agent_status:    user.agent_status || 'OFFLINE',
      // Extension SIP — depuis la table agents
      extension:       agent?.extension || user.extension || null,
      // Plan dialer
      plan:            dialerPlan,
      // Organisation
      organization: org ? {
        name:   org.name,
        plan:   orgPlan,
        status: org.status,
        seats:  org.seats || null,
      } : null,
    }
  }

  // ── Résoudre le plan dialer selon le forfait org ─────────────
  // FULL        → accès complet entrant + sortant
  // INBOUND_ONLY → entrant uniquement (pas de dialer sortant)
  // NONE        → pas d'accès dialer (rôle owner sans extension)
  private _resolveDialerPlan(orgPlan: string, role: string): string {
    const upperPlan = (orgPlan || '').toUpperCase()

    // Plans qui incluent le dialer complet
    if (['PRO', 'ENTERPRISE', 'CONFORT', 'PREMIUM', 'FULL'].includes(upperPlan)) {
      return 'FULL'
    }
    // Plans entrants seulement
    if (['STARTER', 'BASIC', 'INBOUND'].includes(upperPlan)) {
      return 'INBOUND_ONLY'
    }
    // Par défaut FULL pour ne pas bloquer pendant le dev
    return 'FULL'
  }
}

export const authService = new AuthService()
