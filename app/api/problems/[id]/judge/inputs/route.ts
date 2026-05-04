// Hidden testcases (source='testcase_ac')의 stdin을 AES-GCM으로 암호화해 반환.
// expectedStdout은 절대 응답에 포함하지 않는다 — 서버 측 verify 라우트에서만 사용.
// 인증 필수. 비로그인 시 401.
//
// 응답 형태: { data: { ciphertext, iv } } 또는 testcases가 없으면 { data: null }.
// 평문 inputs 배열 = JSON.parse(decrypt(data)) — caseIndex 오름차순.

import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { testcases } from '@/db/schema'
import { encryptString } from '@/lib/judge/cipher'

export async function GET(
  _request: Request,
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

  const rows = await db
    .select({ stdin: testcases.stdin })
    .from(testcases)
    .where(
      and(
        eq(testcases.problemId, problemId),
        eq(testcases.source, 'testcase_ac'),
      ),
    )
    .orderBy(asc(testcases.caseIndex))

  if (rows.length === 0) {
    return NextResponse.json({ data: null })
  }

  const payload = await encryptString(JSON.stringify(rows.map((r) => r.stdin)))
  return NextResponse.json({ data: payload })
}
