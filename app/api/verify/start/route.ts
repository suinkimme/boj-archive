import { randomBytes } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { bojVerifications, users } from '@/db/schema'

const TTL_MS = 30 * 60 * 1000

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

  const token = `njv-${randomBytes(6).toString('hex')}`
  const expiresAt = new Date(Date.now() + TTL_MS)

  await db.insert(bojVerifications).values({
    userId: session.user.id,
    handle: me.bojHandle,
    token,
    expiresAt,
  })

  return NextResponse.json({ token, expiresAt })
}
