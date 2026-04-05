"use client"
import { useEffect, useState } from "react"
import AuthGuard from "@/components/auth/AuthGuard"
import DialerFAB from "@/components/shared/DialerFAB"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return (
    <AuthGuard>
      {children}
      {mounted && <DialerFAB />}
    </AuthGuard>
  )
}