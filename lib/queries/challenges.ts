import { and, arrayOverlaps, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import { challengeContributors, challengeSubmissions, challengeTestcases, challenges } from '@/db/schema'
import { parseStatuses, parseTags, parsePage, parseOrder } from '@/lib/queries/params'

export const PAGE_SIZE = 12

export interface ListedChallenge {
  slug: string
  title: string
  tags: string[]
  completedCount: number
  rate: number
  done: boolean
  tried: boolean
}

export interface ChallengesListResult {
  visible: ListedChallenge[]
  totalCount: number
  totalPages: number
  tagCounts: Record<string, number>
}

export interface ChallengeDetail {
  id: number
  slug: string
  title: string
  description: string
  samples: { input: string; output: string }[]
  tags: string[]
  timeLimit: string | null
  memoryLimit: string | null
  hiddenCount: number
  contributors: string[]
  done: boolean
}

export interface ListParams {
  q?: string
  order?: string
  tags?: string
  status?: string
  page?: string
}


export async function fetchChallengesForList(
  params: ListParams,
  userId: string | null,
): Promise<ChallengesListResult> {
  const query = (params.q ?? '').trim()
  const tagFilter = parseTags(params.tags)
  const statuses = parseStatuses(params.status)
  const order = parseOrder(params.order)
  const page = parsePage(params.page)

  const conditions = []
  if (query) conditions.push(ilike(challenges.title, `%${query}%`))
  if (tagFilter.length > 0) conditions.push(arrayOverlaps(challenges.tags, tagFilter))

  if (userId && statuses.length > 0) {
    const statusConditions = statuses.map((s) => {
      if (s === 'solved') {
        return sql`exists (
          select 1 from ${challengeSubmissions} ac
          where ac.user_id = ${userId}
          and ac.challenge_id = challenges.id
          and ac.verdict = 'AC'
        )`
      }
      if (s === 'tried') {
        return sql`exists (
          select 1 from ${challengeSubmissions} cs
          where cs.user_id = ${userId}
          and cs.challenge_id = challenges.id
        )`
      }
      // unsolved
      return sql`not exists (
        select 1 from ${challengeSubmissions} cs
        where cs.user_id = ${userId}
        and cs.challenge_id = challenges.id
      )`
    })
    conditions.push(or(...statusConditions)!)
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, countRows, tagCountRows] = await Promise.all([
    db
      .select({
        slug: challenges.slug,
        title: challenges.title,
        tags: challenges.tags,
        completedCount: sql<number>`(
          select count(distinct cs.user_id)::int
          from ${challengeSubmissions} cs
          where cs.challenge_id = challenges.id and cs.verdict = 'AC'
        )`,
        totalCount: sql<number>`(
          select count(distinct cs.user_id)::int
          from ${challengeSubmissions} cs
          where cs.challenge_id = challenges.id
        )`,
        done: userId
          ? sql<number>`(case when exists (
              select 1 from ${challengeSubmissions} ac
              where ac.user_id = ${userId}
              and ac.challenge_id = challenges.id
              and ac.verdict = 'AC'
            ) then 1 else 0 end)`
          : sql<number>`0`,
        tried: userId
          ? sql<number>`(case when exists (
              select 1 from ${challengeSubmissions} cs
              where cs.user_id = ${userId}
              and cs.challenge_id = challenges.id
            ) then 1 else 0 end)`
          : sql<number>`0`,
      })
      .from(challenges)
      .where(where)
      .orderBy(
        order === 'recent'
          ? desc(challenges.id)
          : order === 'solved'
            ? sql`(select count(distinct cs.user_id) from ${challengeSubmissions} cs where cs.challenge_id = challenges.id and cs.verdict = 'AC') desc`
            : order === 'rate'
              ? sql`case when (select count(distinct cs.user_id) from ${challengeSubmissions} cs where cs.challenge_id = challenges.id) = 0 then 0 else (select count(distinct cs.user_id) from ${challengeSubmissions} cs where cs.challenge_id = challenges.id and cs.verdict = 'AC')::float / (select count(distinct cs.user_id) from ${challengeSubmissions} cs where cs.challenge_id = challenges.id) end desc`
              : asc(challenges.id),
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(challenges)
      .where(where),

    db.execute<{ tag: string; count: number }>(sql`
      SELECT unnest(tags) AS tag, count(*)::int AS count
      FROM ${challenges}
      GROUP BY tag
    `),
  ])

  const totalCount = countRows[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const tagCounts: Record<string, number> = {}
  for (const row of tagCountRows) {
    tagCounts[row.tag] = row.count
  }

  const visible: ListedChallenge[] = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    tags: r.tags ?? [],
    completedCount: r.completedCount,
    rate: r.totalCount > 0 ? (r.completedCount / r.totalCount) * 100 : 0,
    done: r.done === 1,
    tried: r.tried === 1,
  }))

  return { visible, totalCount, totalPages, tagCounts }
}

export async function fetchChallengeBySlug(
  slug: string,
  userId: string | null,
): Promise<ChallengeDetail | null> {
  const rows = await db
    .select({
      id: challenges.id,
      slug: challenges.slug,
      title: challenges.title,
      description: challenges.description,
      inputFormat: challenges.inputFormat,
      outputFormat: challenges.outputFormat,
      samples: challenges.samples,
      tags: challenges.tags,
      timeLimit: challenges.timeLimit,
      memoryLimit: challenges.memoryLimit,
      hiddenCount: sql<number>`(
        select count(*)::int from ${challengeTestcases} ct
        where ct.challenge_id = challenges.id
      )`,
      done: userId
        ? sql<number>`(case when exists (
            select 1 from ${challengeSubmissions} ac
            where ac.user_id = ${userId}
            and ac.challenge_id = challenges.id
            and ac.verdict = 'AC'
          ) then 1 else 0 end)`
        : sql<number>`0`,
    })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const contributorRows = await db
    .select({ githubLogin: challengeContributors.githubLogin })
    .from(challengeContributors)
    .where(eq(challengeContributors.challengeId, row.id))
    .orderBy(asc(challengeContributors.contributedAt))

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    samples: (row.samples ?? []) as { input: string; output: string }[],
    tags: row.tags ?? [],
    timeLimit: row.timeLimit,
    memoryLimit: row.memoryLimit,
    hiddenCount: row.hiddenCount,
    contributors: contributorRows.map((r) => r.githubLogin),
    done: row.done === 1,
  }
}
