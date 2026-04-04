"use client"

import { useEffect, useState } from "react"
import FloatingPhone from "@/components/softphone/FloatingPhone"

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const [token,   setToken]   = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw    = localStorage.getItem("voxflow-auth")
      if (!raw) return
      const parsed = JSON.parse(raw)
      const state  = parsed.state || parsed
      if (state.accessToken && state.isAuth) setToken(state.accessToken)
    } catch {}
  }, [])

  return (
    <>
      {children}
      {mounted && token && <FloatingPhone accessToken={token} />}
    </>
  )
}
