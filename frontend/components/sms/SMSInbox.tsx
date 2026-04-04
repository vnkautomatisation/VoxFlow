"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { smsApi } from "@/lib/aiApi"

interface SMS {
  id:          string
  from_number: string
  to_number:   string
  body:        string
  direction:   string
  status:      string
  created_at:  string
}

interface Props {
  messages: SMS[]
  onRefresh: () => void
}

export default function SMSInbox({ messages, onRefresh }: Props) {
  const { accessToken } = useAuthStore()
  const [to,      setTo]      = useState("")
  const [body,    setBody]    = useState("")
  const [loading, setLoading] = useState(false)
  const [thread,  setThread]  = useState<SMS[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to.trim() || !body.trim()) return
    setLoading(true)
    try {
      await smsApi.sendSMS(accessToken!, to, body)
      setBody("")
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const loadThread = async (phone: string) => {
    setSelected(phone)
    try {
      const res = await smsApi.getThread(accessToken!, phone)
      if (res.success) setThread(res.data || [])
    } catch (err) { console.error(err) }
  }

  // Deduplications des conversations par numero
  const conversations = messages.reduce((acc: Record<string, SMS>, msg) => {
    const key = msg.direction === "INBOUND" ? msg.from_number : msg.to_number
    if (!acc[key] || new Date(msg.created_at) > new Date(acc[key].created_at)) {
      acc[key] = msg
    }
    return acc
  }, {})

  return (
    <div className="grid grid-cols-3 gap-4 h-96">

      {/* Liste conversations */}
      <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-800">
          <p className="text-white text-sm font-medium">Conversations SMS</p>
        </div>
        <div className="overflow-y-auto h-full">
          {Object.entries(conversations).length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-8">Aucun SMS</p>
          ) : Object.entries(conversations).map(([phone, msg]) => (
            <div
              key={phone}
              onClick={() => loadThread(phone)}
              className={"px-3 py-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors " + (selected === phone ? "bg-gray-800" : "")}
            >
              <p className="text-white text-sm font-mono">{phone}</p>
              <p className="text-gray-500 text-xs truncate mt-0.5">{msg.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Thread + envoi */}
      <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-800">
          <p className="text-white text-sm font-medium">{selected || "Selectionnez une conversation"}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selected ? thread.map((msg) => (
            <div key={msg.id} className={"flex " + (msg.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
              <div className={"max-w-xs px-3 py-2 rounded-xl text-sm " + (
                msg.direction === "OUTBOUND"
                  ? "bg-teal-700 text-white"
                  : "bg-gray-800 text-gray-200"
              )}>
                <p>{msg.body}</p>
                <p className="text-xs opacity-60 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          )) : (
            <p className="text-gray-500 text-sm text-center py-8">Choisissez une conversation</p>
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-gray-800 p-3 flex gap-2">
          {!selected && (
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+1514..."
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
            />
          )}
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Votre message..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Envoyer
          </button>
        </form>
      </div>
    </div>
  )
}
