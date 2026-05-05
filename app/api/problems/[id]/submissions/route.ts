// 채점 결과를 저장하고 (POST) 문제별 모든 사용자 제출 이력을 조회한다 (GET).
//
// POST: 인증 필수. 본인 채점 결과 1건을 submissions에 기록하고, AC면
//   user_solved_problems(source='local')에도 upsert해서 done 플래그가
//   문제 리스트/디테일에 즉시 반영되도록 한다.
//
// GET: 비로그인도 허용. problem_id 기준 최신순 keyset 페이지네이션.
//   ?cursor=<submittedAtMs>_<id> 로 그 이후 row 만 잘라온다. cursor 미지정 = 맨 앞.
//   응답의 nextCursor 가 null 이면 더 이상 row 없음. 깊은 페이지에서도 OFFSET
//   누적 비용이 없고, totalCount/totalPages 계산을 안 해 count(*) 풀스캔도 없다.
//   닉네임은 bojHandle 우선 → name → login 순 fallback. 코드는 저장하지 않는다.

import { and, desc, eq, lt, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { db } from '@/db'
import {
  type SubmissionLanguage,
  type SubmissionVerdict,
  problems,
  submissions,
  userSolvedProblems,
  users,
} from '@/db/schema'

const LANGUAGES: ReadonlySet<SubmissionLanguage> = new Set([
  'python',
  'c',
  'cpp',
])
const VERDICTS: ReadonlySet<SubmissionVerdict> = new Set([
  'AC',
  'WA',
  'RE',
  'TLE',
])

// 더 보기 클릭 시 1회 추가 로딩 분량. 첫 로딩은 클라이언트가 ?limit= 으로 더
// 큰 값(60)을 요청해 첫 인상을 채운다.
const HISTORY_PAGE_SIZE = 30
const HISTORY_PAGE_SIZE_MAX = 100

interface PostBody {
  language?: unknown
  verdict?: unknown
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

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const language = body.language
  const verdict = body.verdict
  if (
    typeof language !== 'string' ||
    !LANGUAGES.has(language as SubmissionLanguage)
  ) {
    return NextResponse.json({ error: 'bad_language' }, { status: 400 })
  }
  if (
    typeof verdict !== 'string' ||
    !VERDICTS.has(verdict as SubmissionVerdict)
  ) {
    return NextResponse.json({ error: 'bad_verdict' }, { status: 400 })
  }

  // problems FK가 있으므로 lazy import로 채워진 row가 없으면 insert가 실패한다.
  // 그 경우 임포트 누락이 원인이므로 사용자에게 명확히 404로 알린다.
  const exists = await db
    .select({ problemId: problems.problemId })
    .from(problems)
    .where(eq(problems.problemId, problemId))
    .limit(1)
  if (exists.length === 0) {
    return NextResponse.json({ error: 'problem_not_found' }, { status: 404 })
  }

  const userId = session.user.id
  const now = new Date()

  await db.insert(submissions).values({
    userId,
    problemId,
    language: language as SubmissionLanguage,
    verdict: verdict as SubmissionVerdict,
    submittedAt: now,
  })

  // AC 시에만 done 표시. 이미 solvedac로 import된 row가 있으면 그대로 둔다.
  if (verdict === 'AC') {
    await db
      .insert(userSolvedProblems)
      .values({
        userId,
        problemId,
        source: 'local',
        solvedAt: now,
        importedAt: now,
      })
      .onConflictDoNothing()
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// 커서는 동률(같은 submitted_at) 발생 시 id 로 깨는 (ts, id) 페어. URL에 안전한
// 단순 문자열로 인코딩. 잘못된 형식이면 cursor 무시 = 맨 앞부터.
function parseCursor(
  raw: string | null,
): { submittedAt: Date; id: number } | null {
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const problemId = Number.parseInt(id, 10)
  if (!Number.isFinite(problemId)) {
    return NextResponse.json({ error: 'bad_problem_id' }, { status: 400 })
  }

  const url = new URL(request.url)
  const cursor = parseCursor(url.searchParams.get('cursor'))
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, HISTORY_PAGE_SIZE_MAX)
      : HISTORY_PAGE_SIZE

  // (submitted_at, id) DESC 순서에서 cursor 보다 "엄격히 뒤에 있는" row 만:
  //   submitted_at < cursor.ts 이거나
  //   submitted_at = cursor.ts && id < cursor.id
  // (problem_id, submitted_at) 인덱스를 백워드 스캔하므로 깊은 페이지에서도 일정.
  const cursorPredicate = cursor
    ? or(
        lt(submissions.submittedAt, cursor.submittedAt),
        and(
          eq(submissions.submittedAt, cursor.submittedAt),
          lt(submissions.id, cursor.id),
        ),
      )
    : undefined

  // limit + 1 만큼 가져와 마지막 1건은 "다음 페이지가 있는지" 시그널로만 쓴다.
  const rows = await db
    .select({
      id: submissions.id,
      language: submissions.language,
      verdict: submissions.verdict,
      submittedAt: submissions.submittedAt,
      bojHandle: users.bojHandle,
      name: users.name,
      login: users.login,
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.userId))
    .where(
      and(eq(submissions.problemId, problemId), cursorPredicate),
    )
    .orderBy(desc(submissions.submittedAt), desc(submissions.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    id: r.id,
    language: r.language,
    verdict: r.verdict,
    submittedAt: r.submittedAt,
    handle: r.bojHandle ?? r.name ?? r.login ?? '익명',
  }))

  const last = items[items.length - 1]
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.submittedAt), last.id) : null

  return NextResponse.json({ items, nextCursor })
}
