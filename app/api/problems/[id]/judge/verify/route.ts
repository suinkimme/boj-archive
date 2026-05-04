// Hidden testcases의 actual outputs를 받아 DB의 expectedStdout과 비교 후
// verdict 배열만 반환한다. expectedStdout 자체는 응답에 절대 포함하지 않는다.
//
// 요청: POST { outputs: string[] }
// 응답: { verdicts: ('AC' | 'WA')[] }
//
// 비교 규칙은 lib/judge/normalize.ts (워커와 동일 사양)을 사용.

import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { testcases } from '@/db/schema'
import { normalizeOutput } from '@/lib/judge/normalize'

interface VerifyBody {
  outputs?: unknown
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId)) {
    return NextResponse.json({ error: 'bad_problem_id' }, { status: 400 })
  }

  let body: VerifyBody
  try {
    body = (await request.json()) as VerifyBody
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const outputs = body.outputs
  if (
    !Array.isArray(outputs) ||
    outputs.some((o) => typeof o !== 'string')
  ) {
    return NextResponse.json({ error: 'bad_outputs' }, { status: 400 })
  }

  const rows = await db
    .select({ expectedStdout: testcases.expectedStdout })
    .from(testcases)
    .where(
      and(
        eq(testcases.problemId, problemId),
        eq(testcases.source, 'testcase_ac'),
      ),
    )
    .orderBy(asc(testcases.caseIndex))

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
