import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { bojVerifications, users } from '@/db/schema'
import { invalidateUser } from '@/lib/solvedac/cache'
import { fetchUser } from '@/lib/solvedac/client'

export async function POST() {
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
    return NextResponse.json({ error: 'no_active_code' }, { status: 400 })
  }

  const fresh = await fetchUser(pending.handle)
  if (!fresh) {
    return NextResponse.json({ error: 'handle_not_found' }, { status: 404 })
  }

  if (!fresh.bio.includes(pending.token)) {
    return NextResponse.json(
      { verified: false, error: 'code_not_in_bio' },
      { status: 200 },
    )
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

  return NextResponse.json({ verified: true, verifiedAt: now })
}
