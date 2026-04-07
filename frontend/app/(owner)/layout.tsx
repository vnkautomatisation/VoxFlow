import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')
    return JSON.parse(Buffer.from(b64 + '='.repeat((4-b64.length%4)%4), 'base64').toString())
  } catch { return null }
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('vf_access_token')?.value
  if (!token) redirect('/login')
  const payload = decodeJwt(token!)
  const role = payload?.role?.toUpperCase()
  if (role !== 'OWNER') {
    const dash: Record<string,string> = {
      ADMIN: '/admin/dashboard',
      AGENT: '/agent/dashboard',
      SUPERVISOR: '/agent/dashboard',
    }
    redirect(dash[role ?? ''] ?? '/login')
  }
  return <>{children}</>
}