import { supabaseAdmin } from '../../config/supabase'
import { hashPassword, comparePassword } from '../../utils/hash'
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt'
import { JwtPayload, Role } from '../../types'

// Features minimales de fallback si un plan est introuvable — ne débloque
// que la lecture (inbound, history, contacts). Utilisé pour éviter de tout
// bloquer en dev quand la migration 027 n'est pas encore appliquée.
const FALLBACK_FEATURES: Record<string, boolean> = {
  inbound_calls:   true,
  outbound_calls:  false,
  queues:          true,
  history:         true,
  contacts_search: true,
  reports_basic:   true,
}

// Cache en mémoire des plan_definitions (invalidé toutes les 60s)
// pour éviter un round-trip DB à chaque login/me.
const _planCache: Map<string, { data: any; ts: number }> = new Map()
const PLAN_CACHE_TTL_MS = 60_000

export function invalidatePlanCache(planId?: string) {
  if (planId) _planCache.delete(planId.toUpperCase())
  else _planCache.clear()
}

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
      user:         await this._formatUser(user, null, org),
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
          status,
          seats,
          trial_started_at,
          trial_ends_at
        )
      `)
      .eq('email', dto.email)
      .single()

    if (error || !user) throw new Error('Email ou mot de passe incorrect')
    if (user.status !== 'ACTIVE') throw new Error('Compte suspendu ou inactif')

    // Les users SSO n'ont pas de password_hash local — refuser le login password
    if (!user.password_hash) {
      throw new Error('Ce compte utilise une connexion SSO (Google/Microsoft). Utilisez le bouton SSO approprié.')
    }

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
      user:        await this._formatUser(user, agent, org),
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
          seats,
          trial_started_at,
          trial_ends_at
        )
      `)
      .eq('id', userId)
      .single()

    if (error || !user) throw new Error('Utilisateur non trouve')

    const agent = Array.isArray(user.agents) ? user.agents[0] : user.agents
    const org   = Array.isArray(user.organizations) ? user.organizations[0] : user.organizations

    return await this._formatUser(user, agent, org)
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
        organizations!users_organization_id_fkey (plan, name, status, seats, trial_started_at, trial_ends_at)
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
          organizations!users_organization_id_fkey (plan, name, status, seats, trial_started_at, trial_ends_at)
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
      user:         await this._formatUser(finalUser, agent, org),
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
  // Devient async parce qu'on va chercher la plan_definition en DB
  // (avec un cache 60s pour ne pas faire un round-trip par login).
  //
  // Règle : OWNER et OWNER_STAFF (staff VNK) ont TOUJOURS accès à
  // toutes les features, sans égard au plan de leur org (ils n'ont
  // souvent pas d'org attachée). Ils peuvent tout voir/faire dans
  // le dialer car c'est leur produit.
  private async _formatUser(user: any, agent: any, org?: any) {
    const isStaff = user.role === 'OWNER' || user.role === 'OWNER_STAFF'

    const orgPlanId = isStaff
      ? 'ENTERPRISE' // staff VNK = accès Enterprise par défaut
      : (org?.plan || 'STARTER').toUpperCase()
    const planDef = await this._getPlanDefinition(orgPlanId)

    let features: Record<string, boolean> =
      planDef?.features && typeof planDef.features === 'object'
        ? planDef.features
        : FALLBACK_FEATURES

    // OWNER/OWNER_STAFF : override — tout activé quel que soit le plan
    if (isStaff) {
      features = {
        outbound_calls: true, inbound_calls: true, queues: true,
        agents_supervision: true, history: true, voicemails: true,
        contacts_search: true, messaging: true, call_recording: true,
        ai_transcription: true, ai_sentiment: true, robot_dialer: true,
        crm_basic: true, crm_advanced: true, reports_basic: true,
        reports_advanced: true, api_access: true, white_label: true,
      }
    }

    // Rétrocompatibilité : 'FULL' | 'INBOUND_ONLY' déduit des features
    const dialerPlan = features.outbound_calls ? 'FULL' : 'INBOUND_ONLY'

    // Trial info si l'org est en essai
    let trial: any = null
    if (org?.status === 'TRIAL' && org?.trial_ends_at) {
      const endsAt  = new Date(org.trial_ends_at)
      const now     = new Date()
      const msLeft  = endsAt.getTime() - now.getTime()
      const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
      trial = {
        starts_at:  org.trial_started_at || null,
        ends_at:    org.trial_ends_at,
        days_left:  daysLeft,
        expired:    msLeft <= 0,
      }
    }

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
      // Plan dialer (legacy 'FULL'|'INBOUND_ONLY' pour rétrocompat)
      plan:            dialerPlan,
      // Nouveau : plan ID + nom + features JSON + limites + trial
      planId:          orgPlanId,
      planName:        planDef?.name || orgPlanId,
      features,
      limits: {
        max_agents:      planDef?.max_agents      ?? null,
        max_dids:        planDef?.max_dids        ?? null,
        max_calls_month: planDef?.max_calls_month ?? null,
      },
      trial,
      // Organisation
      organization: org ? {
        name:   org.name,
        plan:   orgPlanId,
        status: org.status,
        seats:  org.seats || null,
      } : null,
    }
  }

  // ── Récupère une plan_definition depuis la DB (avec cache 60s) ─
  private async _getPlanDefinition(planId: string): Promise<any> {
    const key = (planId || 'STARTER').toUpperCase()
    const now = Date.now()
    const cached = _planCache.get(key)
    if (cached && now - cached.ts < PLAN_CACHE_TTL_MS) {
      return cached.data
    }
    try {
      const { data } = await supabaseAdmin
        .from('plan_definitions')
        .select('id, name, features, max_agents, max_dids, max_calls_month, price_monthly')
        .eq('id', key)
        .maybeSingle()
      _planCache.set(key, { data, ts: now })
      return data
    } catch {
      return null
    }
  }

  // ── Résoudre le plan dialer selon le forfait org ─────────────
  // Conservé pour rétrocompat si du code externe l'appelle.
  // FULL         → accès complet entrant + sortant
  // INBOUND_ONLY → entrant uniquement (pas de dialer sortant)
  private _resolveDialerPlan(orgPlan: string, role: string): string {
    const upperPlan = (orgPlan || '').toUpperCase()
    if (['PRO', 'ENTERPRISE', 'CONFORT', 'PREMIUM', 'FULL'].includes(upperPlan)) return 'FULL'
    if (['STARTER', 'BASIC', 'TRIAL', 'INBOUND'].includes(upperPlan))           return 'INBOUND_ONLY'
    return 'FULL'
  }
}

export const authService = new AuthService()
