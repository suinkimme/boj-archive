import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getUserCached, invalidateUser } from '@/lib/solvedac/cache'

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

  if (!me?.bojHandle) {
    return NextResponse.json({ error: 'no_handle' }, { status: 400 })
  }

  await invalidateUser(me.bojHandle)
  const fresh = await getUserCached(me.bojHandle)
  if (!fresh) {
    return NextResponse.json({ error: 'handle_not_found' }, { status: 404 })
  }

  return NextResponse.json({ solvedAc: fresh })
}
