import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { problems, userSolvedProblems, users } from '@/db/schema'

// /me/problems 페이지 전용 — 사용자가 풀거나 시도한 문제 전체 목록을
// dense tile 그리드로 보여주는 화면을 위한 응답 형태.
// /api/me는 활동 요약용이라 최근 5건만 반환하지만, 여기는 전체를 반환한다.

export type MyProblem = {
  problemId: number
  titleKo: string
  level: number
}

export type MyProblemsResponse = {
  solved: MyProblem[]
  failed: MyProblem[]
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [me] = await db
    .select({
      bojHandleVerifiedAt: users.bojHandleVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  // /api/me와 같은 정책 — 본인 확인 전에는 풀이 데이터 노출하지 않음.
  if (!me?.bojHandleVerifiedAt) {
    return NextResponse.json({ solved: [], failed: [] } satisfies MyProblemsResponse)
  }

  const solvedRows = await db
    .select({
      problemId: userSolvedProblems.problemId,
      titleKo: problems.titleKo,
      level: problems.level,
    })
    .from(userSolvedProblems)
    .innerJoin(problems, eq(problems.problemId, userSolvedProblems.problemId))
    .where(eq(userSolvedProblems.userId, session.user.id))
    .orderBy(asc(userSolvedProblems.problemId))

  // 실패한 문제는 우리 in-browser judge가 제출 기록을 DB에 남기기 시작하면
  // 같은 형태로 채운다 (예: user_submissions where verdict != 'ok'). 그
  // 전까지는 빈 배열을 반환해 UI가 "아직 실패한 문제가 없어요" 빈 상태를
  // 자연스럽게 노출하도록 둔다.
  return NextResponse.json({
    solved: solvedRows,
    failed: [],
  } satisfies MyProblemsResponse)
}
