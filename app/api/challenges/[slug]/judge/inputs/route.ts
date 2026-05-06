import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { challengeTestcases, challenges } from '@/db/schema'
import { encryptString } from '@/lib/judge/cipher'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  const challenge = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1)

  if (!challenge[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const rows = await db
    .select({ stdin: challengeTestcases.stdin })
    .from(challengeTestcases)
    .where(eq(challengeTestcases.challengeId, challenge[0].id))
    .orderBy(asc(challengeTestcases.caseIndex))

  if (rows.length === 0) {
    return NextResponse.json({ data: null })
  }

  const payload = await encryptString(JSON.stringify(rows.map((r) => r.stdin)))
  return NextResponse.json({ data: payload })
}
