import { supabaseAdmin } from "../../config/supabase"
import { v4 as uuidv4 } from "uuid"

export class TokenService {

  async createToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET"): Promise<string> {
    const token     = uuidv4() + "-" + Date.now().toString(36)
    const expiresIn = type === "EMAIL_VERIFY" ? 24 * 60 : 60 // minutes
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString()

    // Invalider les anciens tokens du meme type
    await supabaseAdmin
      .from("auth_tokens")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("type", type)
      .eq("used", false)

    const { data, error } = await supabaseAdmin
      .from("auth_tokens")
      .insert({ user_id: userId, token, type, expires_at: expiresAt })
      .select().single()

    if (error) throw new Error(error.message)
    return token
  }

  async verifyToken(token: string, type: string): Promise<{ userId: string }> {
    const { data, error } = await supabaseAdmin
      .from("auth_tokens")
      .select("*")
      .eq("token", token)
      .eq("type", type)
      .eq("used", false)
      .single()

    if (error || !data) throw new Error("Token invalide ou expire")

    if (new Date(data.expires_at) < new Date()) {
      throw new Error("Token expire")
    }

    // Marquer comme utilise
    await supabaseAdmin
      .from("auth_tokens")
      .update({ used: true })
      .eq("id", data.id)

    return { userId: data.user_id }
  }
}

export const tokenService = new TokenService()
