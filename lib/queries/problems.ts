import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm'

import { db } from '@/db'
import { problems, userSolvedProblems } from '@/db/schema'
import {
  ALL_LEVELS,
  ALL_ORDERS,
  ALL_STATUSES,
  DEFAULT_ORDER,
  type Level,
  type Order,
  type Status,
} from '@/components/challenges/types'

export const PAGE_SIZE = 12

export interface ListedProblem {
  id: number
  title: string
  level: Level
  tags: string[]
  completedCount: number
  rate: number
  done: boolean
  tried: boolean
}

export interface ProblemsListResult {
  visible: ListedProblem[]
  totalCount: number
  totalPages: number
  totalByLevel: Record<Level, number>
  page: number
}

export interface ListParams {
  q?: string
  order?: string
  levels?: string
  status?: string
  tags?: string
  page?: string
}

export function parseLevels(raw: string | undefined): Level[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => Number.parseInt(s, 10))
    .filter((n): n is Level => ALL_LEVELS.includes(n as Level))
}

export function parseStatuses(raw: string | undefined): Status[] {
  if (!raw) return []
  return raw.split(',').filter((s): s is Status => ALL_STATUSES.includes(s as Status))
}

export function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').filter(Boolean)
}

export function parseOrder(raw: string | undefined): Order {
  return ALL_ORDERS.includes(raw as Order) ? (raw as Order) : DEFAULT_ORDER
}

export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export async function fetchProblemsForList(
  params: ListParams,
  userId: string | null,
): Promise<ProblemsListResult> {
  const order = parseOrder(params.order)
  const levels = parseLevels(params.levels)
  const statuses = parseStatuses(params.status)
  const tagFilter = parseTags(params.tags)
  const query = (params.q ?? '').trim()
  const page = parsePage(params.page)

  const conditions = []
  if (query) {
    // 제목 부분일치 + 숫자 입력이면 problem_id 정확 일치도 포함 (OR).
    const titleMatch = ilike(problems.titleKo, `%${query}%`)
    if (/^\d+$/.test(query)) {
      const id = Number.parseInt(query, 10)
      if (Number.isFinite(id)) {
        conditions.push(or(titleMatch, eq(problems.problemId, id))!)
      } else {
        conditions.push(titleMatch)
      }
    } else {
      conditions.push(titleMatch)
    }
  }
  if (levels.length > 0) conditions.push(inArray(problems.level, levels))
  if (tagFilter.length > 0) conditions.push(arrayOverlaps(problems.tags, tagFilter))

  // Status filter only meaningful for authed users; 'tried' has no schema
  // backing yet (we only track solved), so it falls through.
  if (userId && statuses.length > 0) {
    const wantsSolved = statuses.includes('solved')
    const wantsUnsolved = statuses.includes('unsolved')
    if (wantsSolved && !wantsUnsolved) {
      conditions.push(
        sql`exists (select 1 from ${userSolvedProblems} usp where usp.user_id = ${userId} and usp.problem_id = problems.problem_id)`,
      )
    } else if (wantsUnsolved && !wantsSolved) {
      conditions.push(
        sql`not exists (select 1 from ${userSolvedProblems} usp where usp.user_id = ${userId} and usp.problem_id = problems.problem_id)`,
      )
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const orderBy =
    order === 'solved'
      ? [desc(sql`coalesce(${problems.acceptedUserCount}, 0)`), desc(problems.problemId)]
      : order === 'rate'
        ? [asc(sql`coalesce(${problems.averageTries}, 9999)`), desc(problems.problemId)]
        : [desc(problems.problemId)]

  const [countRows, rows, levelRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(problems)
      .where(whereClause),
    db
      .select({
        problemId: problems.problemId,
        titleKo: problems.titleKo,
        level: problems.level,
        tags: problems.tags,
        acceptedUserCount: problems.acceptedUserCount,
        averageTries: problems.averageTries,
        // exists가 'f'/'t' 문자열로 떨어지는 driver 동작에 의존하지 않도록
        // 명시적으로 0/1 정수로 캐스팅. r.done === 1 비교로 확정 변환.
        // problems.problem_id는 drizzle 인터폴레이션이 prefix를 빠뜨려
        // subquery 안에서 모호해지는 문제가 있어 raw로 표 접두 명시.
        done: userId
          ? sql<number>`(case when exists (select 1 from ${userSolvedProblems} usp where usp.user_id = ${userId} and usp.problem_id = problems.problem_id) then 1 else 0 end)`
          : sql<number>`0`,
      })
      .from(problems)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        level: problems.level,
        value: sql<number>`count(*)::int`,
      })
      .from(problems)
      .groupBy(problems.level),
  ])

  const totalCount = countRows[0]?.value ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const totalByLevel = ALL_LEVELS.reduce(
    (acc, lv) => ({ ...acc, [lv]: 0 }),
    {} as Record<Level, number>,
  )
  for (const r of levelRows) {
    if (ALL_LEVELS.includes(r.level as Level)) {
      totalByLevel[r.level as Level] = r.value
    }
  }

  const visible: ListedProblem[] = rows.map((r) => ({
    id: r.problemId,
    title: r.titleKo,
    level: r.level as Level,
    tags: r.tags ?? [],
    completedCount: r.acceptedUserCount ?? 0,
    rate: deriveRate(r.averageTries),
    done: Number(r.done) === 1,
    // 실제 시도 추적 데이터 경로 도입 전까지 항상 false. 채점 시도
    // 기록이 들어오면 user_solved_problems와 같은 EXISTS 패턴으로 채움.
    tried: false,
  }))

  return { visible, totalCount, totalPages, totalByLevel, page }
}

function deriveRate(averageTries: number | null): number {
  if (averageTries == null || averageTries <= 0) return 0
  return Math.min(100, 100 / averageTries)
}
