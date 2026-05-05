import { and, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { problems, submissions, userSolvedProblems, users } from '@/db/schema'
import { getUserCached } from '@/lib/solvedac/cache'

const RECENT_SOLVED_LIMIT = 5

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [me] = await db
    .select({
      id: users.id,
      bojHandle: users.bojHandle,
      bojHandleVerifiedAt: users.bojHandleVerifiedAt,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!me) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  }

  const isVerified = !!me.bojHandleVerifiedAt
  const userId = session.user.id

  // 최근 활동 = "사용자가 마지막으로 손댄 문제 N개". 풀이 성공 row
  // (user_solved_problems) 와 모든 제출 row (submissions) 를 합쳐서
  // 문제별 가장 최근 timestamp 로 줄세운다. 실패만 한 문제도 같이 노출된다.
  type RecentActivityRow = {
    problem_id: number
    title_ko: string
    level: number
    accepted_user_count: number | null
    average_tries: number | null
  }
  const recentActivityResult = await db.execute<RecentActivityRow>(sql`
    WITH activity AS (
      SELECT problem_id, COALESCE(solved_at, imported_at) AS ts
      FROM ${userSolvedProblems}
      WHERE user_id = ${userId}
      UNION ALL
      SELECT problem_id, submitted_at AS ts
      FROM ${submissions}
      WHERE user_id = ${userId}
    ),
    latest AS (
      SELECT problem_id, MAX(ts) AS last_at
      FROM activity
      GROUP BY problem_id
    )
    SELECT
      p.problem_id,
      p.title_ko,
      p.level,
      p.accepted_user_count,
      p.average_tries
    FROM ${problems} p
    INNER JOIN latest ON latest.problem_id = p.problem_id
    ORDER BY latest.last_at DESC
    LIMIT ${RECENT_SOLVED_LIMIT}
  `)
  const recentRows: RecentActivityRow[] = Array.from(recentActivityResult)

  // 본인 확인 여부와 무관하게 항상 가져온다 — 비연동/미인증 사용자도
  // in-browser judge로 푼 문제(source='local')를 자기 활동으로 본다.
  // solved.ac 사용자 정보만 인증된 핸들이 있을 때 추가로 조회.
  const [importedRow, localRow, solvedAc] = await Promise.all([
    // solvedac 임포트 진행률 게이지용 — local 풀이로 진행률이 부풀려지지
    // 않도록 source='solvedac'만 센다.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSolvedProblems)
      .where(
        and(
          eq(userSolvedProblems.userId, session.user.id),
          eq(userSolvedProblems.source, 'solvedac'),
        ),
      ),
    // 비연동/미인증 사용자에게 보여줄 "이 사이트에서 푼 문제 수".
    // submissions 에 AC verdict 가 한 건이라도 있는 distinct problemId 개수.
    // userSolvedProblems(source='local') 대신 submissions 를 직접 세서
    // 두 테이블 동기화 누락 영향을 받지 않게 한다.
    db
      .select({
        count: sql<number>`count(distinct ${submissions.problemId})::int`,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, session.user.id),
          eq(submissions.verdict, 'AC'),
        ),
      ),
    me.bojHandle && isVerified
      ? getUserCached(me.bojHandle)
      : Promise.resolve(null),
  ])

  const recentSolved = recentRows.map((r) => ({
    problemId: r.problem_id,
    titleKo: r.title_ko,
    level: r.level,
    acceptedUserCount: r.accepted_user_count ?? 0,
    averageTries: r.average_tries ?? 0,
  }))

  const importedCount = importedRow[0]?.count ?? 0
  const localSolvedCount = localRow[0]?.count ?? 0

  return NextResponse.json({
    user: {
      bojHandle: me.bojHandle,
      bojHandleVerifiedAt: me.bojHandleVerifiedAt,
      onboardedAt: me.onboardedAt,
    },
    solvedAc,
    recentSolved,
    importedCount,
    localSolvedCount,
  })
}
