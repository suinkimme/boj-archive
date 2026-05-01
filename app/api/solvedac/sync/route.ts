import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { importSolvedHandle } from '@/lib/solvedac/import'

// 1 page per request keeps progress updates frequent on the client —
// even small accounts (~79 problems) get at least one mid-import tick
// instead of jumping from 0% to 100%.
const MAX_PAGES_PER_REQUEST = 1

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { fromPage?: number } = {}
  try {
    if (req.headers.get('content-length')) {
      body = (await req.json()) as { fromPage?: number }
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const fromPage =
    typeof body.fromPage === 'number' && body.fromPage > 0 ? body.fromPage : 1

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

  const result = await importSolvedHandle(session.user.id, me.bojHandle, {
    fromPage,
    maxPages: MAX_PAGES_PER_REQUEST,
  })

  return NextResponse.json(result)
}
