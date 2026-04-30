import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { importSolvedHandle } from '@/lib/solvedac/import'

const MAX_PAGES_PER_REQUEST = 4

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
    .select({ bojHandle: users.bojHandle })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!me?.bojHandle) {
    return NextResponse.json({ error: 'no_handle' }, { status: 400 })
  }

  const result = await importSolvedHandle(session.user.id, me.bojHandle, {
    fromPage,
    maxPages: MAX_PAGES_PER_REQUEST,
  })

  return NextResponse.json(result)
}
