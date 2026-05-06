import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { challengeSubmissions, challenges } from '@/db/schema'

export type MyProblem = {
  challengeId: number
  slug: string
  title: string
}

export type MyProblemsResponse = {
  solved: MyProblem[]
  failed: MyProblem[]
}

type ChallengeRow = {
  challenge_id: number
  slug: string
  title: string
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const [solvedResult, failedResult] = await Promise.all([
    db.execute<ChallengeRow>(sql`
      WITH solved_ids AS (
        SELECT DISTINCT challenge_id FROM ${challengeSubmissions}
        WHERE user_id = ${userId} AND verdict = 'AC'
      )
      SELECT c.id AS challenge_id, c.slug, c.title
      FROM ${challenges} c
      INNER JOIN solved_ids ON solved_ids.challenge_id = c.id
      ORDER BY c.id ASC
    `),
    db.execute<ChallengeRow>(sql`
      SELECT DISTINCT c.id AS challenge_id, c.slug, c.title
      FROM ${challenges} c
      INNER JOIN ${challengeSubmissions} cs ON cs.challenge_id = c.id
      WHERE cs.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM ${challengeSubmissions} ac
        WHERE ac.user_id = ${userId}
        AND ac.challenge_id = c.id
        AND ac.verdict = 'AC'
      )
      ORDER BY c.id ASC
    `),
  ])

  const toRow = (r: ChallengeRow): MyProblem => ({
    challengeId: r.challenge_id,
    slug: r.slug,
    title: r.title,
  })

  return NextResponse.json({
    solved: Array.from(solvedResult).map(toRow),
    failed: Array.from(failedResult).map(toRow),
  } satisfies MyProblemsResponse)
}
