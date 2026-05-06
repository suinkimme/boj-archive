import { and, desc, eq, lt, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import { challengeSubmissions, challenges, type SubmissionVerdict, users } from '@/db/schema'
import type { Lang } from '@/components/problems/codeBoilerplate'

const HISTORY_PAGE_SIZE = 30
const HISTORY_PAGE_SIZE_MAX = 100

function parseCursor(raw: string | null): { submittedAt: Date; id: number } | null {
  if (!raw) return null
  const sep = raw.lastIndexOf('_')
  if (sep <= 0) return null
  const tsMs = Number(raw.slice(0, sep))
  const id = Number(raw.slice(sep + 1))
  if (!Number.isFinite(tsMs) || !Number.isFinite(id)) return null
  return { submittedAt: new Date(tsMs), id }
}

function encodeCursor(submittedAt: Date, id: number): string {
  return `${submittedAt.getTime()}_${id}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const challenge = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1)

  if (!challenge[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const cursor = parseCursor(url.searchParams.get('cursor'))
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, HISTORY_PAGE_SIZE_MAX)
      : HISTORY_PAGE_SIZE

  const cursorPredicate = cursor
    ? or(
        lt(challengeSubmissions.submittedAt, cursor.submittedAt),
        and(
          eq(challengeSubmissions.submittedAt, cursor.submittedAt),
          lt(challengeSubmissions.id, cursor.id),
        ),
      )
    : undefined

  const rows = await db
    .select({
      id: challengeSubmissions.id,
      language: challengeSubmissions.language,
      verdict: challengeSubmissions.verdict,
      submittedAt: challengeSubmissions.submittedAt,
      name: users.name,
      login: users.login,
    })
    .from(challengeSubmissions)
    .innerJoin(users, eq(users.id, challengeSubmissions.userId))
    .where(and(eq(challengeSubmissions.challengeId, challenge[0].id), cursorPredicate))
    .orderBy(desc(challengeSubmissions.submittedAt), desc(challengeSubmissions.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    id: r.id,
    language: r.language,
    verdict: r.verdict,
    submittedAt: r.submittedAt,
    handle: r.name ?? r.login ?? '익명',
  }))

  const last = items[items.length - 1]
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.submittedAt), last.id) : null

  return NextResponse.json({ items, nextCursor })
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

  let body: { language?: unknown; verdict?: unknown }
  try {
    body = (await request.json()) as { language?: unknown; verdict?: unknown }
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const { language, verdict } = body
  if (typeof language !== 'string' || typeof verdict !== 'string') {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 })
  }

  const challenge = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1)

  if (!challenge[0]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  await db.insert(challengeSubmissions).values({
    userId: session.user.id,
    challengeId: challenge[0].id,
    language: language as Lang,
    verdict: verdict as SubmissionVerdict,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
