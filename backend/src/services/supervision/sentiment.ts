/**
 * Sentiment Analysis — analyse du ton en temps reel
 *
 * Utilise OpenAI pour analyser le sentiment d'une transcription
 * partielle ou complete d'un appel en cours.
 *
 * Peut etre appele :
 *  - En temps reel via Twilio Media Streams (si configure)
 *  - Apres transcription complete (POST /ai/transcribe/:callId)
 *  - Manuellement par le superviseur
 */

import { supabaseAdmin } from "../../config/supabase"

const OPENAI_KEY = process.env.OPENAI_API_KEY || ""

export async function analyzeSentiment(text: string): Promise<{
  sentiment: "positive" | "neutral" | "negative"
  score: number
  keywords: string[]
}> {
  if (!OPENAI_KEY || !text.trim()) {
    return { sentiment: "neutral", score: 0.5, keywords: [] }
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Analyse le sentiment de cette transcription d'appel telephonique. Reponds en JSON: {sentiment: 'positive'|'neutral'|'negative', score: 0-1, keywords: ['mot1','mot2']}",
          },
          { role: "user", content: text.slice(0, 2000) },
        ],
        temperature: 0,
        max_tokens: 100,
      }),
    })
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ""
    const parsed = JSON.parse(content)
    return {
      sentiment: parsed.sentiment || "neutral",
      score:     Number(parsed.score) || 0.5,
      keywords:  Array.isArray(parsed.keywords) ? parsed.keywords : [],
    }
  } catch {
    return { sentiment: "neutral", score: 0.5, keywords: [] }
  }
}

export async function analyzeCallSentiment(callId: string): Promise<any> {
  const { data: call } = await supabaseAdmin
    .from("calls")
    .select("transcription")
    .eq("id", callId)
    .single()

  if (!call?.transcription) return { sentiment: "neutral", score: 0.5, keywords: [] }

  const result = await analyzeSentiment(call.transcription)

  // Persister dans la DB
  await supabaseAdmin
    .from("calls")
    .update({ sentiment: result.sentiment, sentiment_score: result.score })
    .eq("id", callId)

  return result
}
