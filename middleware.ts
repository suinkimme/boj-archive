import { NextResponse } from 'next/server'

import { auth } from '@/auth'

export default auth((req) => {
  const session = req.auth
  if (!session?.user) return NextResponse.next()

  const path = req.nextUrl.pathname
  if (path.startsWith('/onboarding')) return NextResponse.next()
  if (session.user.onboardedAt) return NextResponse.next()

  return NextResponse.redirect(new URL('/onboarding', req.url))
})

export const config = {
  // Node.js runtime is required because the auth() jwt callback queries
  // the database via `postgres-js` (TCP). The default Edge runtime can't
  // load Node networking APIs.
  runtime: 'nodejs',
  matcher: [
    '/((?!api|_next/static|_next/image|favicon|icon|og-image|robots|sitemap).*)',
  ],
}
