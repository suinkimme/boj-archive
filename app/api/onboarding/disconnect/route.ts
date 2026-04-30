import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { invalidateUser } from '@/lib/solvedac/cache'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [me] = await db
    .select({ bojHandle: users.bojHandle })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  await db
    .update(users)
    .set({
      bojHandle: null,
      bojHandleVerifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id))

  if (me?.bojHandle) {
    await invalidateUser(me.bojHandle)
  }

  return NextResponse.json({ ok: true })
}
