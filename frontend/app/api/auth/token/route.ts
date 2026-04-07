import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// GET /api/auth/token — Electron poll cette route pour obtenir le token actuel
// Retourne le token depuis le cookie de session
export async function GET(request: NextRequest) {
  const token = request.cookies.get('vf_access_token')?.value
  const role  = request.cookies.get('vf_role')?.value

  if (!token) {
    return NextResponse.json({ authenticated: false })
  }

  // Decoder le JWT pour verifier expiration
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')
    const payload = JSON.parse(Buffer.from(b64 + '='.repeat((4-b64.length%4)%4), 'base64').toString())
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return NextResponse.json({ authenticated: false, reason: 'expired' })
    }
    return NextResponse.json({
      authenticated: true,
      token,
      role: role || payload.role,
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    })
  } catch {
    return NextResponse.json({ authenticated: false, reason: 'invalid' })
  }
}