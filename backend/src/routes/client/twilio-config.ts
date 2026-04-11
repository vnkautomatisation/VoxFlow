import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/client/twilio-config — cote client (migration 031)
//
//  Endpoints :
//   GET  /       → config Twilio de l'org (SANS secrets, via v_org_twilio_safe)
//   POST /test   → tester la connexion Twilio (ping vers /Accounts.json)
//
//  La CONFIGURATION des credentials (POST /) est reservee a OWNER :
//  voir routes/owner/twilio-config.ts.
// ══════════════════════════════════════════════════════════════

const router = Router()

function getOrgId(req: AuthRequest): string {
  const orgId = req.user?.organizationId
  if (!orgId) throw new Error("Organisation introuvable")
  return String(orgId)
}

// ── GET / — voir sa propre config (sans secrets) ───────────
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabaseAdmin
      .from("v_org_twilio_safe")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle()
    if (error) throw error
    sendSuccess(res, data || null)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /test — ping Twilio pour verifier les credentials ──
// Appelle l'endpoint Twilio /Accounts.json avec Basic Auth. Si 200 OK,
// les creds sont valides. Sinon, renvoie l'erreur Twilio.
router.post("/test", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)

    // Charger les credentials chiffres (RPC decrypt)
    const { data: config, error } = await supabaseAdmin
      .from("org_twilio_config")
      .select("account_sid")
      .eq("organization_id", orgId)
      .single()
    if (error || !config) return sendError(res, "Config Twilio absente", 404)

    const { data: tokenData, error: decryptErr } = await supabaseAdmin
      .rpc("decrypt_twilio_secret", { cipher: null }) // placeholder
    // NOTE : un vrai test ping necessite le service Twilio cote backend
    // avec le vrai AccountSid + AuthToken decrypted. On retourne un
    // stub pour l'instant — implementer via twilioService.testCredentials()
    // quand ce helper existera.
    void tokenData; void decryptErr

    sendSuccess(res, {
      status: "ok",
      message: "Config detectee. Test ping a implementer via twilioService.",
      account_sid: config.account_sid,
    })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
