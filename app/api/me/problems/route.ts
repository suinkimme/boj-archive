import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { problems, submissions, userSolvedProblems } from '@/db/schema'

// /me/problems 페이지 전용 — 사용자가 풀거나 시도한 문제 전체 목록을
// dense tile 그리드로 보여주는 화면을 위한 응답 형태.
// /api/me는 활동 요약용이라 최근 5건만 반환하지만, 여기는 전체를 반환한다.
//
// 본인 확인 여부와 무관하게 응답한다 — 아이디 미연동/미인증 사용자도
// 이 사이트 in-browser judge로 풀거나 시도한 문제는 자기 기록으로 본다.
//
// "풀었다" 판정 규칙: 두 소스 중 하나라도 성공이면 풀었다고 본다.
//   1) solved.ac 임포트 — userSolvedProblems 에 row 존재
//   2) 이 사이트에서 직접 채점 — submissions 에 verdict='AC' row 존재
// 마지막 제출이 WA여도 과거에 AC가 한 번이라도 있었으면 solved 로 분류된다.
//
// failed = 시도한 적은 있는데(submissions row 존재) solved 가 아닌 문제.

export type MyProblem = {
  problemId: number
  titleKo: string
  level: number
}

export type MyProblemsResponse = {
  solved: MyProblem[]
  failed: MyProblem[]
}

type ProblemRow = {
  problem_id: number
  title_ko: string
  level: number
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const [solvedResult, failedResult] = await Promise.all([
    // solved = userSolvedProblems 의 problemId ∪ submissions(AC) 의 problemId.
    // 작은 두 집합을 union 한 뒤 problems 와 join 하므로 problems 풀스캔 없음.
    db.execute<ProblemRow>(sql`
      WITH solved_ids AS (
        SELECT problem_id FROM ${userSolvedProblems} WHERE user_id = ${userId}
        UNION
        SELECT DISTINCT problem_id FROM ${submissions}
        WHERE user_id = ${userId} AND verdict = 'AC'
      )
      SELECT p.problem_id, p.title_ko, p.level
      FROM ${problems} p
      INNER JOIN solved_ids ON solved_ids.problem_id = p.problem_id
      ORDER BY p.problem_id ASC
    `),
    // failed = 사용자가 시도한 문제 중 solved 가 아닌 것.
    // 즉 submissions row 는 있으면서 userSolvedProblems 에도 없고
    // submissions 에 AC verdict 도 없는 problemId 들.
    db.execute<ProblemRow>(sql`
      SELECT DISTINCT p.problem_id, p.title_ko, p.level
      FROM ${problems} p
      INNER JOIN ${submissions} s ON s.problem_id = p.problem_id
      WHERE s.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM ${userSolvedProblems} usp
        WHERE usp.user_id = ${userId} AND usp.problem_id = p.problem_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${submissions} ac
        WHERE ac.user_id = ${userId}
        AND ac.problem_id = p.problem_id
        AND ac.verdict = 'AC'
      )
      ORDER BY p.problem_id ASC
    `),
  ])

  const toRow = (r: ProblemRow): MyProblem => ({
    problemId: r.problem_id,
    titleKo: r.title_ko,
    level: r.level,
  })

  return NextResponse.json({
    solved: Array.from(solvedResult).map(toRow),
    failed: Array.from(failedResult).map(toRow),
  } satisfies MyProblemsResponse)
}
