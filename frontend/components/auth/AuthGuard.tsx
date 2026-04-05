"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router            = useRouter()
  const { isAuth }        = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!isAuth) { router.replace("/login"); return }
      setReady(true)
    }, 100)
    return () => clearTimeout(t)
  }, [isAuth, router])

  if (!ready) return (
    <div style={{ width:"100vw", height:"100vh", background:"#111118",
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"36px", height:"36px", borderRadius:"50%",
        border:"3px solid #2e2e44", borderTopColor:"#7b61ff",
        animation:"spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return <>{children}</>
}