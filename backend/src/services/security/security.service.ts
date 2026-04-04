import { supabaseAdmin } from "../../config/supabase"
import crypto from "crypto"

export class SecurityService {

  // ── 2FA TOTP ──────────────────────────────────────────────────

  async setup2FA(userId: string): Promise<{ secret: string; qrUrl: string; backupCodes: string[] }> {
    const secret = this.generateTOTPSecret()

    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    )

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("email, name")
      .eq("id", userId)
      .single()

    await supabaseAdmin.from("two_factor_auth").upsert({
      user_id:      userId,
      secret,
      backup_codes: backupCodes,
      is_enabled:   false,
    }, { onConflict: "user_id" })

    const issuer = "VoxFlow"
    const label  = encodeURIComponent(user?.email || userId)
    const qrUrl  = "otpauth://totp/" + issuer + ":" + label +
      "?secret=" + secret + "&issuer=" + issuer + "&algorithm=SHA1&digits=6&period=30"

    return { secret, qrUrl, backupCodes }
  }

  async verify2FA(userId: string, code: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from("two_factor_auth")
      .select("secret, backup_codes")
      .eq("user_id", userId)
      .single()

    if (!data) return false

    // Verifier code TOTP
    const isValid = this.verifyTOTP(data.secret, code)
    if (isValid) return true

    // Verifier backup codes
    const backupCodes = data.backup_codes || []
    const codeIndex   = backupCodes.indexOf(code.toUpperCase())
    if (codeIndex >= 0) {
      const newCodes = [...backupCodes]
      newCodes.splice(codeIndex, 1)
      await supabaseAdmin.from("two_factor_auth")
        .update({ backup_codes: newCodes })
        .eq("user_id", userId)
      return true
    }

    return false
  }

  async enable2FA(userId: string, code: string): Promise<boolean> {
    const isValid = await this.verify2FA(userId, code)
    if (!isValid) return false

    await supabaseAdmin.from("two_factor_auth")
      .update({ is_enabled: true, enabled_at: new Date().toISOString() })
      .eq("user_id", userId)

    await supabaseAdmin.from("users")
      .update({ two_fa_enabled: true })
      .eq("id", userId)

    return true
  }

  async disable2FA(userId: string): Promise<void> {
    await supabaseAdmin.from("two_factor_auth")
      .update({ is_enabled: false })
      .eq("user_id", userId)

    await supabaseAdmin.from("users")
      .update({ two_fa_enabled: false })
      .eq("id", userId)
  }

  async get2FAStatus(userId: string) {
    const { data } = await supabaseAdmin
      .from("two_factor_auth")
      .select("is_enabled, enabled_at, backup_codes")
      .eq("user_id", userId)
      .single()

    return {
      enabled:         data?.is_enabled || false,
      enabledAt:       data?.enabled_at || null,
      backupCodesLeft: data?.backup_codes?.length || 0,
    }
  }

  private generateTOTPSecret(): string {
    const chars  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    let secret   = ""
    const bytes  = crypto.randomBytes(20)
    for (let i = 0; i < 32; i++) {
      secret += chars[bytes[i % 20] % 32]
    }
    return secret
  }

  private verifyTOTP(secret: string, token: string): boolean {
    const now     = Math.floor(Date.now() / 1000)
    const counter = Math.floor(now / 30)

    for (let delta = -1; delta <= 1; delta++) {
      const expected = this.generateTOTP(secret, counter + delta)
      if (expected === token.padStart(6, "0")) return true
    }
    return false
  }

  private generateTOTP(secret: string, counter: number): string {
    const chars   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    let bits      = ""

    for (const char of secret.toUpperCase()) {
      const val = chars.indexOf(char)
      if (val < 0) continue
      bits += val.toString(2).padStart(5, "0")
    }

    const bytes = Buffer.alloc(Math.floor(bits.length / 8))
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2)
    }

    const counterBuf = Buffer.alloc(8)
    counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
    counterBuf.writeUInt32BE(counter >>> 0, 4)

    try {
      const hmac   = crypto.createHmac("sha1", bytes).update(counterBuf).digest()
      const offset = hmac[hmac.length - 1] & 0xf
      const code   = ((hmac[offset] & 0x7f) << 24 |
                     (hmac[offset + 1] & 0xff) << 16 |
                     (hmac[offset + 2] & 0xff) << 8  |
                     (hmac[offset + 3] & 0xff)) % 1000000
      return code.toString().padStart(6, "0")
    } catch {
      return "000000"
    }
  }

  // ── SESSIONS ──────────────────────────────────────────────────

  async getSessions(userId: string) {
    const { data } = await supabaseAdmin
      .from("user_sessions")
      .select("id, ip_address, user_agent, location, last_active_at, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("last_active_at", { ascending: false })
    return data || []
  }

  async revokeSession(sessionId: string, userId: string) {
    await supabaseAdmin.from("user_sessions")
      .update({ is_active: false })
      .eq("id", sessionId)
      .eq("user_id", userId)
    return { revoked: true }
  }

  async revokeAllSessions(userId: string) {
    await supabaseAdmin.from("user_sessions")
      .update({ is_active: false })
      .eq("user_id", userId)
    return { revokedAll: true }
  }

  // ── AUDIT LOGS ────────────────────────────────────────────────

  async log(organizationId: string | null, userId: string | null, action: string, opts: {
    resource?:  string
    resourceId?:string
    details?:   any
    ip?:        string
    userAgent?: string
  } = {}) {
    await supabaseAdmin.from("audit_logs").insert({
      organization_id: organizationId,
      user_id:         userId,
      action,
      resource:        opts.resource   || null,
      resource_id:     opts.resourceId || null,
      details:         opts.details    || {},
      ip_address:      opts.ip         || null,
      user_agent:      opts.userAgent  || null,
    })
  }

  async getAuditLogs(organizationId: string, limit = 50) {
    const { data } = await supabaseAdmin
      .from("audit_logs")
      .select("*, user:users!audit_logs_user_id_fkey(id, name, email)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit)
    return data || []
  }
}

export const securityService = new SecurityService()
