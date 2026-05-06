import { and, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { challengeSubmissions, challenges, users } from '@/db/schema'

const RECENT_SOLVED_LIMIT = 5

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [me] = await db
    .select({
      id: users.id,
      onboardedAt: users.onboardedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!me) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  }

  const userId = session.user.id

  type RecentActivityRow = {
    challenge_id: number
    slug: string
    title: string
    tags: string[]
  }
  const recentActivityResult = await db.execute<RecentActivityRow>(sql`
    WITH latest AS (
      SELECT challenge_id, MAX(submitted_at) AS last_at
      FROM ${challengeSubmissions}
      WHERE user_id = ${userId}
      GROUP BY challenge_id
    )
    SELECT
      c.id AS challenge_id,
      c.slug,
      c.title,
      c.tags
    FROM ${challenges} c
    INNER JOIN latest ON latest.challenge_id = c.id
    ORDER BY latest.last_at DESC
    LIMIT ${RECENT_SOLVED_LIMIT}
  `)
  const recentRows: RecentActivityRow[] = Array.from(recentActivityResult)

  const [localRow] = await db
    .select({
      count: sql<number>`count(distinct ${challengeSubmissions.challengeId})::int`,
    })
    .from(challengeSubmissions)
    .where(
      and(
        eq(challengeSubmissions.userId, session.user.id),
        eq(challengeSubmissions.verdict, 'AC'),
      ),
    )

  const recentSolved = recentRows.map((r) => ({
    challengeId: r.challenge_id,
    slug: r.slug,
    title: r.title,
    tags: r.tags ?? [],
  }))

  return NextResponse.json({
    user: {
      onboardedAt: me.onboardedAt,
    },
    recentSolved,
    localSolvedCount: localRow?.count ?? 0,
  })
}
