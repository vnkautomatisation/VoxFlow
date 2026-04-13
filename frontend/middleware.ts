import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ISOLATION STRICTE — chaque role = un seul portail
// OWNER_STAFF = staff VNK, même portail que OWNER (le filtrage des champs
// sensibles est géré dans les pages OWNER elles-mêmes)
const ACL: Record<string, RegExp> = {
  OWNER:       /^\/(owner)/,
  OWNER_STAFF: /^\/(owner)/,
  ADMIN:       /^\/(admin)/,
  SUPERVISOR:  /^\/(agent)/,
  AGENT:       /^\/(agent)/,
}

// Routes accessibles par tous les roles connectes
const SHARED = /^\/(profile|dialer|client)/

const DASHBOARD: Record<string, string> = {
  OWNER:       '/owner/dashboard',
  OWNER_STAFF: '/owner/dashboard',
  ADMIN:       '/admin/dashboard',
  SUPERVISOR:  '/agent/dashboard',
  AGENT:       '/agent/dashboard',
}

const PUBLIC = /^\/(login|register|forgot-password|reset-password|verify-email|onboarding|callback|commander|tarifs)/

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')
    const pad = b64 + '='.repeat((4 - b64.length % 4) % 4)
    return JSON.parse(Buffer.from(pad, 'base64').toString())
  } catch { return null }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Statiques et publics — pas de check
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/dialer') ||
    pathname.includes('.') ||
    PUBLIC.test(pathname)
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('vf_access_token')?.value

  // Non connecte
  if (!token) {
    // Landing page publique
    if (pathname === '/') return NextResponse.next()
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Decoder le JWT — source de verite
  const payload = decodeJwt(token)
  if (!payload) return NextResponse.redirect(new URL('/login', request.url))

  // Token expire
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = (payload.role || '').toUpperCase()
  const dashboard = DASHBOARD[role] || '/login'

  // Racine -> son dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL(dashboard, request.url))
  }

  // Role inconnu -> login
  if (!ACL[role]) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Routes partagees (profile, dialer, client) -> ok
  if (SHARED.test(pathname)) {
    return NextResponse.next()
  }

  // Portail non autorise pour ce role -> son propre dashboard
  if (!ACL[role].test(pathname)) {
    return NextResponse.redirect(new URL(dashboard, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}