import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Middleware désactivé — auth gérée côté client par AuthGuard
// Raison : Zustand persist (localStorage) se réhydrate côté client
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = { matcher: [] }