import { auth } from '@/auth'

export default auth(() => {})

export const config = {
  // Node.js runtime is required because the auth() jwt callback queries
  // the database via `postgres-js` (TCP). The default Edge runtime can't
  // load Node networking APIs.
  runtime: 'nodejs',
  matcher: [
    '/((?!api|_next/static|_next/image|favicon|icon|og-image|robots|sitemap).*)',
  ],
}
