import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { challengeTestcases, challenges } from '@/db/schema'
import { normalizeOutput } from '@/lib/judge/normalize'

interface VerifyBody {
  outputs?: unknown
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  let body: VerifyBody
  try {
    body = (await request.json()) as VerifyBody
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const outputs = body.outputs
  if (!Array.isArray(outputs) || outputs.some((o) => typeof o !== 'string')) {
    return NextResponse.json({ error: 'bad_outputs' }, { status: 400 })
  }

  const challenge = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1)

  if (!challenge[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const rows = await db
    .select({ expectedStdout: challengeTestcases.expectedStdout })
    .from(challengeTestcases)
    .where(eq(challengeTestcases.challengeId, challenge[0].id))
    .orderBy(asc(challengeTestcases.caseIndex))

  if (rows.length !== outputs.length) {
    return NextResponse.json(
      { error: 'length_mismatch', expected: rows.length, got: outputs.length },
      { status: 400 },
    )
  }

  const verdicts: ('AC' | 'WA')[] = rows.map((row, i) => {
    const actualNorm = normalizeOutput(outputs[i] as string)
    const expectedNorm = normalizeOutput(row.expectedStdout)
    return actualNorm === expectedNorm ? 'AC' : 'WA'
  })

  return NextResponse.json({ verdicts })
}
