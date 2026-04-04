import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { aiService } from "../../services/openai/ai.service"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)

// POST /api/v1/ai/transcribe/:callId — Transcription d un appel
router.post("/transcribe/:callId", async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId

    const { data: call } = await supabaseAdmin
      .from("calls").select("*").eq("id", callId).single()

    if (!call) return sendError(res, "Appel non trouve", 404)

    let transcription = "[Aucun enregistrement disponible]"
    if (call.recording_url) {
      transcription = await aiService.transcribeFromUrl(call.recording_url)
    } else {
      transcription = "[Transcription simulee pour cet appel]"
    }

    // Resume automatique
    const analysis = await aiService.summarizeCall(transcription, call.duration || 0)

    // Sauvegarder
    await supabaseAdmin.from("calls").update({
      transcription,
      ai_summary:   analysis.summary,
      ai_processed: true,
    }).eq("id", callId)

    try {
      await supabaseAdmin.from("ai_summaries").upsert({
        call_id:      callId,
        transcription,
        summary:      analysis.summary,
        sentiment:    analysis.sentiment,
        topics:       analysis.topics,
        resolved:     analysis.resolved,
        follow_up:    analysis.followUp,
      })
    } catch { /* Table peut ne pas exister encore */ }

    sendSuccess(res, { transcription, analysis })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// POST /api/v1/ai/summarize — Resume depuis texte
router.post("/summarize", async (req: AuthRequest, res: Response) => {
  try {
    const { transcription, duration } = req.body
    if (!transcription) return sendError(res, "Transcription requise", 400)
    const analysis = await aiService.summarizeCall(transcription, duration || 0)
    sendSuccess(res, analysis)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// GET /api/v1/ai/summaries — Liste des resumes IA
router.get("/summaries", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendSuccess(res, [])

    const { data } = await supabaseAdmin
      .from("calls")
      .select("id, from_number, to_number, duration, started_at, ai_summary, transcription")
      .eq("organization_id", orgId)
      .not("ai_summary", "is", null)
      .order("started_at", { ascending: false })
      .limit(20)

    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
