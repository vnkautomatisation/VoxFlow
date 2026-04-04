import { supabaseAdmin } from '../../config/supabase'
import { hashPassword, comparePassword } from '../../utils/hash'
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt'
import { JwtPayload, Role } from '../../types'

interface RegisterDto {
  email:          string
  password:       string
  name:           string
  role:           Role
  organizationId?: string
}

interface LoginDto {
  email:    string
  password: string
}

export class AuthService {

  // ── Inscription ─────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Vérifier si l'email existe déjà
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single()

    if (existing) {
      throw new Error('Cet email est deja utilise')
    }

    // Hasher le mot de passe
    const passwordHash = await hashPassword(dto.password)

    // Créer l'utilisateur dans Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:         dto.email,
      password:      dto.password,
      email_confirm: true,
    })

    if (authError) {
      throw new Error(authError.message)
    }

    // Créer le profil utilisateur dans notre table
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

    if (userError) {
      throw new Error(userError.message)
    }

    // Générer les tokens
    const payload: JwtPayload = {
      userId:         user.id,
      email:          user.email,
      role:           user.role,
      organizationId: user.organization_id,
    }

    return {
      user: {
        id:             user.id,
        email:          user.email,
        name:           user.name,
        role:           user.role,
        organizationId: user.organization_id,
      },
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    }
  }

  // ── Connexion ────────────────────────────────────────────────
  async login(dto: LoginDto) {
    // Trouver l'utilisateur
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', dto.email)
      .single()

    if (error || !user) {
      throw new Error('Email ou mot de passe incorrect')
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Compte suspendu ou inactif')
    }

    // Vérifier le mot de passe
    const isValid = await comparePassword(dto.password, user.password_hash)
    if (!isValid) {
      throw new Error('Email ou mot de passe incorrect')
    }

    // Générer les tokens
    const payload: JwtPayload = {
      userId:         user.id,
      email:          user.email,
      role:           user.role,
      organizationId: user.organization_id,
    }

    return {
      user: {
        id:             user.id,
        email:          user.email,
        name:           user.name,
        role:           user.role,
        organizationId: user.organization_id,
      },
      accessToken:  generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    }
  }

  // ── Profil utilisateur connecté ──────────────────────────────
  async getMe(userId: string) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, organization_id, status, created_at')
      .eq('id', userId)
      .single()

    if (error || !user) {
      throw new Error('Utilisateur non trouve')
    }

    return user
  }

  // ── Refresh token ────────────────────────────────────────────
  async refreshToken(userId: string) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !user) {
      throw new Error('Utilisateur non trouve')
    }

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
}

export const authService = new AuthService()

