import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getUserCached, invalidateUser } from '@/lib/solvedac/cache'

// 사용자가 /me에서 "업데이트"를 누르면 스냅샷을 강제로 무효화하고
// 새로 fetch한다. 이후 /me 페이지의 폴링 효과가 신선한 solvedCount와
// importedCount 차이를 감지해 sync를 이어 받음.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [me] = await db
    .select({
      bojHandle: users.bojHandle,
      bojHandleVerifiedAt: users.bojHandleVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!me?.bojHandle) {
    return NextResponse.json({ error: 'no_handle' }, { status: 400 })
  }
  if (!me.bojHandleVerifiedAt) {
    return NextResponse.json({ error: 'not_verified' }, { status: 403 })
  }

  await invalidateUser(me.bojHandle)
  const fresh = await getUserCached(me.bojHandle)
  return NextResponse.json({ solvedAc: fresh })
}
