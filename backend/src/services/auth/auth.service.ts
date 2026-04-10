import { supabaseAdmin } from '../../config/supabase'
import { hashPassword, comparePassword } from '../../utils/hash'
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt'
import { JwtPayload, Role } from '../../types'

/**
 * Self-signup public — crée une nouvelle organisation ADMIN avec son owner.
 * Le rôle est TOUJOURS forcé à ADMIN. Les rôles OWNER et OWNER_STAFF ne
 * peuvent être créés que manuellement en DB ou via /api/v1/owner/organizations
 * (qui exige déjà un OWNER authentifié).
 */
interface RegisterDto {
  email:    string
  password: string
  name:     string
  orgName:  string
  plan?:    string
}

interface LoginDto {
  email:    string
  password: string
}

export class AuthService {

  // ── Inscription publique (self-signup ADMIN) ────────────────
  async register(dto: RegisterDto) {
    // 1. Vérifier que l'email n'est pas déjà pris
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .maybeSingle()

    if (existing) throw new Error('Cet email est déjà utilisé')

    // 2. Créer l'organisation — slug auto-généré
    const slug = dto.orgName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Essai gratuit 14 jours par défaut
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name:             dto.orgName,
        slug,
        plan:             (dto.plan || 'STARTER').toUpperCase(),
        status:           'TRIAL',
        trial_started_at: now.toISOString(),
        trial_ends_at:    trialEnd.toISOString(),
      })
      .select()
      .single()

    if (orgError) throw new Error('Erreur création organisation: ' + orgError.message)

    // 3. Hash password + créer user Supabase Auth
    const passwordHash = await hashPassword(dto.password)

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:         dto.email,
      password:      dto.password,
      email_confirm: true,
    })
    if (authError) {
      // Rollback: supprimer l'org orpheline
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      throw new Error(authError.message)
    }

    // 4. Créer le user — role forcé à ADMIN, lié à l'org créée
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id:              authUser.user.id,
        email:           dto.email,
        name:            dto.name,
        role:            'ADMIN', // FORCÉ — jamais OWNER via register public
        password_hash:   passwordHash,
        organization_id: org.id,
        status:          'ACTIVE',
      })
      .select()
      .single()

    if (userError) {
      // Rollback: supprimer org + user auth
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id).catch(() => {})
      throw new Error('Erreur création utilisateur: ' + userError.message)
    }

    const payload: JwtPayload = {
      userId:         user.id,
      email:          user.email,
      role:           user.role,
      organizationId: user.organization_id,
    }

    return {
      user:         this._formatUser(user, null, org),
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

  // ── SSO Exchange (Google / Microsoft via Supabase OAuth) ────
  // Called after a successful Supabase OAuth redirect. The frontend
  // passes the Supabase access_token, we validate it server-side,
  // look up or create the user in our DB, and return our own JWT.
  //
  // Flow :
  //  1. Validate the Supabase token via supabaseAdmin.auth.getUser()
  //  2. Look up our users table by email
  //  3a. If exists → login path (return JWT + user)
  //  3b. If not → create org + user atomically (role=ADMIN, trial 14j)
  //  4. Track 'google' or 'azure' in auth_providers[]
  async ssoExchange(supabaseAccessToken: string, provider: 'google' | 'azure') {
    // 1. Validate the Supabase token — this confirms the user has a
    // valid session with Google/Microsoft via Supabase.
    const { data: sbData, error: sbError } = await supabaseAdmin.auth.getUser(supabaseAccessToken)
    if (sbError || !sbData?.user) {
      throw new Error('Session SSO invalide ou expirée')
    }

    const sbUser = sbData.user
    const email  = sbUser.email
    if (!email) {
      throw new Error('Le provider SSO n\'a pas fourni d\'email')
    }

    // Infos extraites du profil OAuth (Google/Microsoft)
    const metadata  = (sbUser.user_metadata || {}) as any
    const fullName  = metadata.full_name || metadata.name || metadata.display_name || email.split('@')[0]
    const avatarUrl = metadata.avatar_url || metadata.picture || null

    // 2. Chercher un user existant par email (pas par sbUser.id — les
    // users créés via password ont leur propre id Supabase)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        agents!agents_user_id_fkey (extension, status),
        organizations!users_organization_id_fkey (plan, name, status)
      `)
      .eq('email', email)
      .maybeSingle()

    let finalUser = existingUser

    if (existingUser) {
      // 3a. User existe — vérifier statut et ajouter le provider
      if (existingUser.status !== 'ACTIVE') {
        throw new Error('Compte suspendu ou inactif')
      }

      const currentProviders = Array.isArray(existingUser.auth_providers)
        ? existingUser.auth_providers
        : []
      if (!currentProviders.includes(provider)) {
        const newProviders = [...currentProviders, provider]
        const updates: any = { auth_providers: newProviders }
        if (avatarUrl && !existingUser.avatar_url) updates.avatar_url = avatarUrl
        await supabaseAdmin
          .from('users')
          .update(updates)
          .eq('id', existingUser.id)
      }
    } else {
      // 3b. Nouveau user via SSO — création org + user atomique
      // Nom de l'org dérivé du profil
      const orgName = (metadata.org_name as string) || `${fullName}'s workspace`
      const slug    = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)

      const now      = new Date()
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name:             orgName,
          slug:             `${slug}-${Math.random().toString(36).slice(2, 7)}`, // éviter collision slug
          plan:             'STARTER',
          status:           'TRIAL',
          trial_started_at: now.toISOString(),
          trial_ends_at:    trialEnd.toISOString(),
        })
        .select()
        .single()

      if (orgError) throw new Error('Erreur création organisation: ' + orgError.message)

      // Créer le user dans notre table avec l'id Supabase (sbUser.id)
      const { data: newUser, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id:              sbUser.id, // Réutilise l'id Supabase Auth
          email,
          name:            fullName,
          role:            'ADMIN', // FORCÉ — jamais OWNER via SSO public
          password_hash:   null,     // SSO only — pas de mot de passe local
          organization_id: org.id,
          status:          'ACTIVE',
          avatar_url:      avatarUrl,
          auth_providers:  [provider],
        })
        .select(`
          *,
          agents!agents_user_id_fkey (extension, status),
          organizations!users_organization_id_fkey (plan, name, status)
        `)
        .single()

      if (userError) {
        // Rollback : supprimer l'org orpheline
        await supabaseAdmin.from('organizations').delete().eq('id', org.id)
        throw new Error('Erreur création utilisateur: ' + userError.message)
      }

      finalUser = newUser
    }

    // 4. Générer notre JWT
    const payload: JwtPayload = {
      userId:         finalUser.id,
      email:          finalUser.email,
      role:           finalUser.role,
      organizationId: finalUser.organization_id,
    }

    const agent = Array.isArray(finalUser.agents) ? finalUser.agents[0] : finalUser.agents
    const org   = Array.isArray(finalUser.organizations) ? finalUser.organizations[0] : finalUser.organizations

    return {
      user:         this._formatUser(finalUser, agent, org),
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
      isNew:        !existingUser,
    }
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
