import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { bojVerifications, users } from '@/db/schema'
import { logEvent } from '@/lib/log'
import { invalidateUser } from '@/lib/solvedac/cache'
import { fetchUser } from '@/lib/solvedac/client'

const DEV_MOCK = process.env.SOLVEDAC_DEV_MOCK === '1'

export async function POST() {
  const startedAt = Date.now()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [pending] = await db
    .select()
    .from(bojVerifications)
    .where(
      and(
        eq(bojVerifications.userId, session.user.id),
        isNull(bojVerifications.consumedAt),
        gt(bojVerifications.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(bojVerifications.createdAt))
    .limit(1)

  if (!pending) {
    logEvent('verify_fail', {
      userId: session.user.id,
      reason: 'no_active_code',
      elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: 'no_active_code' }, { status: 400 })
  }

  // Dev mock mode can't reach solved.ac to read the bio, so skip the
  // check and let the post-verify flow stay testable locally.
  if (!DEV_MOCK) {
    const fresh = await fetchUser(pending.handle)
    if (!fresh) {
      logEvent('verify_fail', {
        userId: session.user.id,
        handle: pending.handle,
        reason: 'handle_not_found',
        elapsedMs: Date.now() - startedAt,
      })
      return NextResponse.json({ error: 'handle_not_found' }, { status: 404 })
    }

    if (!fresh.bio.includes(pending.token)) {
      logEvent('verify_fail', {
        userId: session.user.id,
        handle: pending.handle,
        reason: 'code_not_in_bio',
        elapsedMs: Date.now() - startedAt,
      })
      return NextResponse.json(
        { verified: false, error: 'code_not_in_bio' },
        { status: 200 },
      )
    }
  }

  const now = new Date()
  await db
    .update(bojVerifications)
    .set({ consumedAt: now })
    .where(eq(bojVerifications.id, pending.id))
  await db
    .update(users)
    .set({ bojHandleVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, session.user.id))

  await invalidateUser(pending.handle)

  logEvent('verify_pass', {
    userId: session.user.id,
    handle: pending.handle,
    elapsedMs: Date.now() - startedAt,
  })

  return NextResponse.json({ verified: true, verifiedAt: now })
}
