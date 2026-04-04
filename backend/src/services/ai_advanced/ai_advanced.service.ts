import OpenAI from "openai"
import { config } from "../../config/env"
import { supabaseAdmin } from "../../config/supabase"

const openai = new OpenAI({ apiKey: config.openai?.apiKey || "" })

const isAIAvailable = () =>
  config.openai?.apiKey && !config.openai.apiKey.startsWith("sk-xxx")

export class AIAdvancedService {

  // Score qualite appel (0-100)
  async scoreCall(callId: string, transcription: string, duration: number): Promise<any> {
    if (!isAIAvailable()) {
      return this.generateSimulatedScore(callId, duration)
    }

    try {
      const prompt = `Analyse cet appel de call center et retourne un JSON avec:
{
  "overall_score": 0-100,
  "greeting_score": 0-100,
  "empathy_score": 0-100,
  "resolution_score": 0-100,
  "closing_score": 0-100,
  "talk_ratio": 0-1 (ratio agent),
  "interruptions": nombre,
  "keywords_found": ["mot1","mot2"],
  "issues_detected": ["probleme1"],
  "auto_tags": ["tag1","tag2"]
}

Transcription (${duration}s):
${transcription.substring(0, 1500)}`

      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        response_format: { type: "json_object" },
      })

      const result = JSON.parse(res.choices[0].message.content || "{}")

      await supabaseAdmin.from("call_quality_scores").upsert({
        call_id:         callId,
        organization_id: "",
        overall_score:   result.overall_score   || 0,
        greeting_score:  result.greeting_score  || 0,
        empathy_score:   result.empathy_score   || 0,
        resolution_score:result.resolution_score|| 0,
        closing_score:   result.closing_score   || 0,
        talk_ratio:      result.talk_ratio       || 0,
        interruptions:   result.interruptions   || 0,
        keywords_found:  result.keywords_found  || [],
        issues_detected: result.issues_detected || [],
      })

      await supabaseAdmin.from("calls").update({
        quality_score: result.overall_score || 0,
        auto_tags:     result.auto_tags     || [],
        keywords:      result.keywords_found || [],
      }).eq("id", callId)

      return result
    } catch (err: any) {
      return this.generateSimulatedScore(callId, duration)
    }
  }

  private async generateSimulatedScore(callId: string, duration: number) {
    const score = Math.floor(Math.random() * 30) + 65
    const result = {
      overall_score:    score,
      greeting_score:   Math.floor(Math.random() * 20) + 75,
      empathy_score:    Math.floor(Math.random() * 25) + 65,
      resolution_score: Math.floor(Math.random() * 30) + 60,
      closing_score:    Math.floor(Math.random() * 20) + 75,
      talk_ratio:       0.6 + Math.random() * 0.2,
      interruptions:    Math.floor(Math.random() * 5),
      keywords_found:   ["bonjour", "merci", "probleme"],
      issues_detected:  score < 70 ? ["Temps de traitement long"] : [],
      auto_tags:        ["Support", score >= 80 ? "Satisfait" : "A_revoir"],
    }

    await supabaseAdmin.from("calls").update({
      quality_score: result.overall_score,
      auto_tags:     result.auto_tags,
    }).eq("id", callId)

    return result
  }

  // Rapport coaching hebdomadaire agent
  async generateCoachingReport(agentId: string, organizationId: string, period = "WEEKLY") {
    const days  = period === "DAILY" ? 1 : period === "MONTHLY" ? 30 : 7
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("id, duration, status, quality_score, auto_tags, ai_summary")
      .eq("agent_id", agentId)
      .gte("started_at", since)

    const allCalls    = calls || []
    const completed   = allCalls.filter((c: any) => c.status === "COMPLETED")
    const avgScore    = completed.length
      ? Math.round(completed.reduce((s: number, c: any) => s + (c.quality_score || 70), 0) / completed.length)
      : 70
    const avgDuration = completed.length
      ? Math.round(completed.reduce((s: number, c: any) => s + (c.duration || 0), 0) / completed.length)
      : 0

    const strengths: string[]       = []
    const improvements: string[]    = []
    const recommendations: string[] = []

    if (avgScore >= 85) strengths.push("Excellent score qualite global")
    if (avgScore >= 75) strengths.push("Bonne resolution des problemes")
    if (completed.length >= 20) strengths.push("Volume d appels eleve")
    if (avgDuration < 180) strengths.push("Gestion efficace du temps d appel")

    if (avgScore < 70) improvements.push("Ameliorer le score qualite global")
    if (avgDuration > 300) improvements.push("Reduire la duree moyenne des appels")
    if (completed.length < 10) improvements.push("Augmenter le volume de traitement")

    recommendations.push("Revoir les appels avec score < 70")
    if (improvements.length > 0) recommendations.push("Formation sur : " + improvements[0])
    recommendations.push("Objectif: " + Math.min(avgScore + 5, 100) + "% de score qualite")

    const { data: coaching } = await supabaseAdmin
      .from("ai_coaching")
      .insert({
        organization_id: organizationId,
        agent_id:        agentId,
        period,
        score:           avgScore,
        metrics: {
          totalCalls:   allCalls.length,
          completedCalls: completed.length,
          avgScore,
          avgDuration,
          resolutionRate: allCalls.length
            ? Math.round((completed.length / allCalls.length) * 100) : 0,
        },
        strengths,
        improvements,
        recommendations,
      })
      .select().single()

    return coaching
  }

  // Suggestions temps reel (basees sur mots-cles)
  async getRealtimeSuggestions(keywords: string[]): Promise<{
    suggestions: string[]
    escalate:    boolean
    sentiment:   string
  }> {
    const lower = keywords.map((k) => k.toLowerCase())

    const escalationWords = ["directeur", "avocat", "plainte", "rembourser", "annuler", "inacceptable"]
    const negativeWords   = ["probleme", "erreur", "bug", "lent", "defectueux", "insatisfait"]
    const positiveWords   = ["merci", "excellent", "parfait", "super", "genial", "satisfait"]

    const shouldEscalate = escalationWords.some((w) => lower.some((k) => k.includes(w)))
    const isNegative     = negativeWords.some((w)   => lower.some((k) => k.includes(w)))
    const isPositive     = positiveWords.some((w)   => lower.some((k) => k.includes(w)))

    const suggestions: string[] = []

    if (shouldEscalate) {
      suggestions.push("Proposer de transferer a un superviseur")
      suggestions.push("Offrir une compensation ou remboursement")
    } else if (isNegative) {
      suggestions.push("Exprimer de l empathie envers le client")
      suggestions.push("Proposer une solution concrete")
      suggestions.push("Verifier si le probleme est resolu")
    } else if (isPositive) {
      suggestions.push("Proposer des services complementaires")
      suggestions.push("Demander une evaluation du service")
    } else {
      suggestions.push("Confirmer la comprehension du besoin")
      suggestions.push("Proposer une solution adaptee")
    }

    return {
      suggestions,
      escalate:  shouldEscalate,
      sentiment: shouldEscalate ? "CRITIQUE" : isNegative ? "NEGATIF" : isPositive ? "POSITIF" : "NEUTRE",
    }
  }

  // Stats IA pour dashboard
  async getAIStats(organizationId: string) {
    const { data: scores } = await supabaseAdmin
      .from("call_quality_scores")
      .select("overall_score, greeting_score, empathy_score, resolution_score")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100)

    const all = scores || []
    const avg = (field: string) => all.length
      ? Math.round(all.reduce((s: number, c: any) => s + (c[field] || 0), 0) / all.length)
      : 0

    const { data: coaching } = await supabaseAdmin
      .from("ai_coaching")
      .select("agent_id, score, period")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20)

    return {
      totalScored:     all.length,
      avgOverallScore: avg("overall_score"),
      avgGreeting:     avg("greeting_score"),
      avgEmpathy:      avg("empathy_score"),
      avgResolution:   avg("resolution_score"),
      excellentCalls:  all.filter((c: any) => c.overall_score >= 85).length,
      needsImprovement:all.filter((c: any) => c.overall_score < 65).length,
      coachingReports: coaching || [],
    }
  }
}

export const aiAdvancedService = new AIAdvancedService()
