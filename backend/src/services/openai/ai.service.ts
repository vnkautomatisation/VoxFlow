import OpenAI from "openai"
import { config } from "../../config/env"
import * as fs from "fs"

const openai = new OpenAI({ apiKey: config.openai.apiKey })

export class AIService {

  // Transcription audio avec Whisper
  async transcribeCall(audioFilePath: string, language: string = "fr"): Promise<string> {
    if (!config.openai.apiKey || config.openai.apiKey.startsWith("sk-xxx")) {
      return "[Transcription simulee] Bonjour, je vous appelle concernant ma facture du mois dernier..."
    }

    try {
      const file = fs.createReadStream(audioFilePath)
      const transcription = await openai.audio.transcriptions.create({
        file,
        model:    "whisper-1",
        language,
        response_format: "text",
      })
      return transcription as unknown as string
    } catch (err: any) {
      console.error("Erreur Whisper:", err.message)
      return "[Transcription indisponible]"
    }
  }

  // Transcription depuis URL (enregistrement Twilio)
  async transcribeFromUrl(recordingUrl: string): Promise<string> {
    if (!config.openai.apiKey || config.openai.apiKey.startsWith("sk-xxx")) {
      return "[Transcription simulee] Client satisfait, probleme resolu en 3 minutes."
    }

    try {
      const response = await fetch(recordingUrl)
      const buffer   = await response.arrayBuffer()
      const tmpPath  = "/tmp/call_" + Date.now() + ".mp3"
      fs.writeFileSync(tmpPath, Buffer.from(buffer))
      const result = await this.transcribeCall(tmpPath)
      fs.unlinkSync(tmpPath)
      return result
    } catch (err: any) {
      return "[Transcription echouee: " + err.message + "]"
    }
  }

  // Resume automatique post-appel avec GPT
  async summarizeCall(transcription: string, duration: number): Promise<{
    summary:   string
    sentiment: string
    topics:    string[]
    resolved:  boolean
    followUp:  string
  }> {
    if (!config.openai.apiKey || config.openai.apiKey.startsWith("sk-xxx")) {
      return {
        summary:   "Appel de " + Math.round(duration / 60) + " minutes. Client a contacte le support.",
        sentiment: "NEUTRE",
        topics:    ["Support", "Information"],
        resolved:  true,
        followUp:  "Aucun suivi requis",
      }
    }

    try {
      const prompt = `Analyse cet appel de call center (duree: ${duration}s) et reponds en JSON strict:
{
  "summary": "Resume en 2-3 phrases",
  "sentiment": "POSITIF|NEUTRE|NEGATIF",
  "topics": ["sujet1", "sujet2"],
  "resolved": true|false,
  "followUp": "Action de suivi recommandee ou Aucun"
}

Transcription:
${transcription.substring(0, 2000)}`

      const completion = await openai.chat.completions.create({
        model:      config.openai.model || "gpt-4o-mini",
        messages:   [{ role: "user", content: prompt }],
        max_tokens: 300,
        response_format: { type: "json_object" },
      })

      const result = JSON.parse(completion.choices[0].message.content || "{}")
      return {
        summary:   result.summary   || "Resume non disponible",
        sentiment: result.sentiment || "NEUTRE",
        topics:    result.topics    || [],
        resolved:  result.resolved  ?? false,
        followUp:  result.followUp  || "Aucun",
      }
    } catch (err: any) {
      console.error("Erreur GPT:", err.message)
      return {
        summary:   "Resume automatique indisponible",
        sentiment: "NEUTRE",
        topics:    [],
        resolved:  false,
        followUp:  "Verifier manuellement",
      }
    }
  }

  // Analyse sentiment temps reel (texte court)
  async analyzeSentiment(text: string): Promise<"POSITIF" | "NEUTRE" | "NEGATIF"> {
    if (!config.openai.apiKey || config.openai.apiKey.startsWith("sk-xxx")) {
      return "NEUTRE"
    }
    try {
      const completion = await openai.chat.completions.create({
        model:    "gpt-4o-mini",
        messages: [{ role: "user", content: "Sentiment de ce texte (POSITIF/NEUTRE/NEGATIF seulement): " + text }],
        max_tokens: 10,
      })
      const result = completion.choices[0].message.content?.trim().toUpperCase() || "NEUTRE"
      if (["POSITIF", "NEUTRE", "NEGATIF"].includes(result)) return result as any
      return "NEUTRE"
    } catch {
      return "NEUTRE"
    }
  }
}

export const aiService = new AIService()
