import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getUserCached } from '@/lib/solvedac/cache'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [me] = await db
    .select({
      id: users.id,
      bojHandle: users.bojHandle,
      bojHandleVerifiedAt: users.bojHandleVerifiedAt,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!me) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  }

  const solvedAc = me.bojHandle ? await getUserCached(me.bojHandle) : null

  return NextResponse.json({
    user: {
      bojHandle: me.bojHandle,
      bojHandleVerifiedAt: me.bojHandleVerifiedAt,
      onboardedAt: me.onboardedAt,
    },
    solvedAc,
  })
}
