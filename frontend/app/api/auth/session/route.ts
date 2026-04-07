import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_OPTS = {
  httpOnly: false,   // false = lisible par JS pour sync dialer
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 jours
}

// POST /api/auth/session — ecrire les cookies apres login
export async function POST(request: NextRequest) {
  try {
    const { token, role } = await request.json()
    if (!token || !role) {
      return NextResponse.json({ error: 'token and role required' }, { status: 400 })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set('vf_access_token', token, COOKIE_OPTS)
    res.cookies.set('vf_role', role.toUpperCase(), COOKIE_OPTS)
    return res
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
}

// DELETE /api/auth/session — effacer les cookies a la deconnexion
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('vf_access_token', '', { ...COOKIE_OPTS, maxAge: 0 })
  res.cookies.set('vf_role', '', { ...COOKIE_OPTS, maxAge: 0 })
  return res
}

// GET /api/auth/session — verifier la session courante
export async function GET(request: NextRequest) {
  const token = request.cookies.get('vf_access_token')?.value
  const role  = request.cookies.get('vf_role')?.value
  if (!token) return NextResponse.json({ authenticated: false })
  return NextResponse.json({ authenticated: true, role })
}