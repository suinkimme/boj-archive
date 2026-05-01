import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  await db
    .update(users)
    .set({ onboardedAt: now, updatedAt: now })
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ onboardedAt: now })
}
