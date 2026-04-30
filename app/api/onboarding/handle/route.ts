import { and, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getUserCached } from '@/lib/solvedac/cache'
import { importSolvedHandle } from '@/lib/solvedac/import'

const INITIAL_SYNC_PAGES = 2

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const raw = (body as { handle?: unknown }).handle
  if (typeof raw !== 'string' || !raw.trim()) {
    return NextResponse.json({ error: 'handle_required' }, { status: 400 })
  }

  const handle = raw.toLowerCase().trim()

  const existsOnSolvedAc = await getUserCached(handle)
  if (!existsOnSolvedAc) {
    return NextResponse.json({ error: 'handle_not_found' }, { status: 404 })
  }

  const [conflict] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.bojHandle, handle), ne(users.id, session.user.id)))
    .limit(1)

  if (conflict) {
    return NextResponse.json({ error: 'handle_taken' }, { status: 409 })
  }

  const now = new Date()
  await db
    .update(users)
    .set({
      bojHandle: handle,
      bojHandleVerifiedAt: null,
      onboardedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, session.user.id))

  // Best-effort initial sync so /me has data on first visit. Failures
  // here shouldn't block onboarding — user can retry via /api/solvedac/sync.
  let initialSync: { nextPage: number | null; totalCount: number } | null = null
  try {
    const result = await importSolvedHandle(session.user.id, handle, {
      maxPages: INITIAL_SYNC_PAGES,
    })
    initialSync = { nextPage: result.nextPage, totalCount: result.totalCount }
  } catch {
    // swallow — handle save already succeeded
  }

  return NextResponse.json({ handle, onboardedAt: now, initialSync })
}
