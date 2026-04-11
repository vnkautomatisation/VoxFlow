import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/owner/twilio-config — subaccount par org (migration 031)
//
//  Endpoints :
//   GET  /                → liste de toutes les configs (via v_org_twilio_safe)
//   GET  /:orgId          → config d'une org specifique (safe)
//   POST /:orgId          → configure/met a jour les credentials d'une org
//
//  Auth : OWNER / OWNER_STAFF uniquement. Les secrets sont chiffres
//  cote DB via pgcrypto + app.settings.twilio_enc_key.
//
//  ATTENTION : la clef app.settings.twilio_enc_key doit etre configuree
//  dans Supabase Dashboard > Database > Settings > Custom Config.
// ══════════════════════════════════════════════════════════════

const router = Router()

// ── GET / — liste de toutes les configs (safe) ───────────────
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("v_org_twilio_safe")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw error
    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── GET /:orgId ──────────────────────────────────────────────
router.get("/:orgId", async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("v_org_twilio_safe")
      .select("*")
      .eq("organization_id", req.params.orgId)
      .maybeSingle()
    if (error) throw error
    sendSuccess(res, data || null)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /:orgId — configurer les credentials ────────────────
// Body :
//  - account_sid         (requis)
//  - auth_token          (requis, sera chiffre)
//  - twiml_app_sid       (optionnel)
//  - api_key_sid         (optionnel)
//  - api_secret          (optionnel, sera chiffre)
//  - friendly_name       (optionnel)
//  - voice_webhook_url   (optionnel)
//  - sms_webhook_url     (optionnel)
//  - status_callback_url (optionnel)
//  - default_caller_id   (optionnel)
//  - recording_enabled   (optionnel bool)
//  - recording_consent   (optionnel bool)
//  - max_concurrent_calls (optionnel int)
router.post("/:orgId", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.params.orgId
    const {
      account_sid, auth_token, twiml_app_sid,
      api_key_sid, api_secret, friendly_name,
      voice_webhook_url, sms_webhook_url, status_callback_url,
      default_caller_id, recording_enabled, recording_consent,
      max_concurrent_calls,
    } = req.body as Record<string, unknown>

    if (!account_sid) return sendError(res, "account_sid requis", 400)
    if (!auth_token)  return sendError(res, "auth_token requis",  400)

    // Chiffrer auth_token + api_secret via RPC pgcrypto
    const { data: authEnc, error: authEncErr } = await supabaseAdmin
      .rpc("encrypt_twilio_secret", { plain: String(auth_token) })
    if (authEncErr) {
      return sendError(res,
        `Chiffrement echoue : ${authEncErr.message}. Verifie app.settings.twilio_enc_key dans Supabase.`,
        500
      )
    }

    let secretEnc: any = null
    if (api_secret) {
      const { data: sEnc, error: sErr } = await supabaseAdmin
        .rpc("encrypt_twilio_secret", { plain: String(api_secret) })
      if (sErr) return sendError(res, `Chiffrement api_secret: ${sErr.message}`, 500)
      secretEnc = sEnc
    }

    // Upsert : 1 row par org (UNIQUE constraint sur organization_id)
    const { data, error } = await supabaseAdmin
      .from("org_twilio_config")
      .upsert({
        organization_id:      orgId,
        account_sid:          String(account_sid),
        auth_token_enc:       authEnc,
        twiml_app_sid:        twiml_app_sid        || null,
        api_key_sid:          api_key_sid          || null,
        api_secret_enc:       secretEnc,
        friendly_name:        friendly_name        || null,
        voice_webhook_url:    voice_webhook_url    || null,
        sms_webhook_url:      sms_webhook_url      || null,
        status_callback_url:  status_callback_url  || null,
        default_caller_id:    default_caller_id    || null,
        recording_enabled:    recording_enabled    === true,
        recording_consent:    recording_consent    === true,
        max_concurrent_calls: Number(max_concurrent_calls) || 10,
        status:               "ACTIVE",
        provisioned_at:       new Date().toISOString(),
      }, { onConflict: "organization_id" })
      .select("id, organization_id, account_sid, friendly_name, status").single()
    if (error) throw error

    sendSuccess(res, data, 201)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
