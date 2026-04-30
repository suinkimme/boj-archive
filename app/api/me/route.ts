import { desc, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { problems, userSolvedProblems, users } from '@/db/schema'
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

  // Don't load any solved.ac data (or DB-derived solve history) until
  // the user has verified ownership of the handle.
  const isVerified = !!me.bojHandleVerifiedAt
  const [solvedAc, recentRows, importedRow] =
    me.bojHandle && isVerified
      ? await Promise.all([
          getUserCached(me.bojHandle),
          db
            .select({
              problemId: userSolvedProblems.problemId,
              titleKo: problems.titleKo,
              level: problems.level,
              acceptedUserCount: problems.acceptedUserCount,
              averageTries: problems.averageTries,
            })
            .from(userSolvedProblems)
            .innerJoin(problems, eq(problems.problemId, userSolvedProblems.problemId))
            .where(eq(userSolvedProblems.userId, session.user.id))
            .orderBy(desc(userSolvedProblems.problemId))
            .limit(RECENT_SOLVED_LIMIT),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(userSolvedProblems)
            .where(eq(userSolvedProblems.userId, session.user.id)),
        ])
      : [null, [], [{ count: 0 }]]

  const recentSolved = recentRows.map((r) => ({
    problemId: r.problemId,
    titleKo: r.titleKo,
    level: r.level,
    acceptedUserCount: r.acceptedUserCount ?? 0,
    averageTries: r.averageTries ?? 0,
  }))

  const importedCount = importedRow[0]?.count ?? 0

  return NextResponse.json({
    user: {
      bojHandle: me.bojHandle,
      bojHandleVerifiedAt: me.bojHandleVerifiedAt,
      onboardedAt: me.onboardedAt,
    },
    solvedAc,
    recentSolved,
    importedCount,
  })
}
