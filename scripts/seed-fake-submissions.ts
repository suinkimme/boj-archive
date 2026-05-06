// 1000번 문제(A+B)에 가짜 제출 이력을 다량 채워 SubmissionHistory UI 의 keyset
// 페이지네이션 + "더 보기" 동작을 검증할 수 있게 한다.
//
// - 재실행 시 이전 시드 유저가 있으면 그대로 재사용 (id 충돌 방지). 매 실행에
//   새 submissions 가 누적되므로, 깨끗한 재시드는 cleanup-fake-submissions.ts 사용.
// - verdict / language / 시각 분포는 AC 위주의 현실적인 비율로 랜덤 샘플.
//
// 실행:
//   npx tsx scripts/seed-fake-submissions.ts
//   npx tsx scripts/seed-fake-submissions.ts 10000      # 10000건 강제

import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../db/schema'
import {
  problems,
  submissions,
  type SubmissionLanguage,
  type SubmissionVerdict,
  userSolvedProblems,
  users,
} from '../db/schema'

config({ path: '.env.local' })

const PROBLEM_ID = 1000
const DEFAULT_SUBMISSION_COUNT = 5_000
const BATCH_SIZE = 500

// 50명. 다양한 톤의 한글 닉네임으로 시각적 대비.
const FAKE_NAMES = [
  '코드몽', '디버거', '알고홀릭', '세그트리', 'NlogN',
  '재귀의신', '구글러지망생', '말랑말랑', '백트래커', '스택오버',
  '브루트포서', '그리디캣', 'DP장인', '비트마스커', '플로이드',
  '크루스칼', '에라토스테네스', '카탈란', '피보나치', '오일러',
  '이분탐색러', '투포인터', '큐비주의', '슬라이딩', '트라이마스터',
  '해시고수', 'B+트리', '레드블랙', '런타임에러', '시간초과',
  '메모리초과', '컴파일러', 'O(1)지망', 'O(N)감수', 'O(NlogN)러버',
  '파이써니스타', 'C충', '람다람', '제네릭', '템플릿',
  '익명1번', '익명2번', '닉네임짓기어려워', '알고생활', '코테준비생',
  '신입개발자', '주니어', '시니어', '풀스택', '백엔드만',
] as const

// 가중치 기반 랜덤. AC 위주의 현실적인 비율.
const VERDICT_WEIGHTS: Array<[SubmissionVerdict, number]> = [
  ['AC', 60],
  ['WA', 25],
  ['RE', 10],
  ['TLE', 5],
]

const LANGUAGE_WEIGHTS: Array<[SubmissionLanguage, number]> = [
  ['python', 40],
  ['cpp', 35],
  ['c', 25],
]

function pickWeighted<T>(weights: Array<[T, number]>): T {
  const total = weights.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [v, w] of weights) {
    r -= w
    if (r <= 0) return v
  }
  return weights[weights.length - 1][0]
}

function pickName(): string {
  return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]
}

// 최근 6개월 분포. 최근일수록 약간 더 빈번하게 나오도록 제곱근으로 편향.
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000
function pickAgeMs(): number {
  return Math.floor(Math.random() ** 2 * SIX_MONTHS_MS)
}

async function main() {
  if (!process.env.POSTGRES_URL_NON_POOLING) {
    console.error('POSTGRES_URL_NON_POOLING is not set. Aborting.')
    process.exit(1)
  }

  const targetCount =
    Number.parseInt(process.argv[2] ?? '', 10) || DEFAULT_SUBMISSION_COUNT

  const client = postgres(process.env.POSTGRES_URL_NON_POOLING)
  const db = drizzle(client, { schema })

  try {
    const problemRow = await db
      .select({ id: problems.problemId })
      .from(problems)
      .where(eq(problems.problemId, PROBLEM_ID))
      .limit(1)

    if (problemRow.length === 0) {
      console.error(
        `problem ${PROBLEM_ID} not found in problems table. import 먼저 실행하세요.`,
      )
      process.exit(1)
    }

    // 1. 가짜 유저 upsert. 결정론적 id로 재실행 시 기존 유저 재사용.
    const userRows = FAKE_NAMES.map((name, i) => ({
      id: `seed-fake-user-${i}`,
      email: `seed-fake${i}@local.invalid`,
      name,
      login: `seed_fake_${i}`,
    }))

    await db.insert(users).values(userRows).onConflictDoNothing()

    // 이름 → userId 매핑. 결정론적 id를 직접 계산.
    const userIdByName = new Map<string, string>(
      FAKE_NAMES.map((name, i) => [name, `seed-fake-user-${i}`]),
    )

    // 2. 제출 row 들을 랜덤 생성 → BATCH_SIZE 단위로 insert.
    const now = Date.now()
    const acFirstAtByUserId = new Map<string, Date>()
    let inserted = 0

    for (let offset = 0; offset < targetCount; offset += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, targetCount - offset)
      const batch = Array.from({ length: batchSize }, () => {
        const name = pickName()
        const userId = userIdByName.get(name)!
        const verdict = pickWeighted(VERDICT_WEIGHTS)
        const language = pickWeighted(LANGUAGE_WEIGHTS)
        const submittedAt = new Date(now - pickAgeMs())

        if (verdict === 'AC') {
          const prev = acFirstAtByUserId.get(userId)
          if (!prev || submittedAt < prev) acFirstAtByUserId.set(userId, submittedAt)
        }

        return { userId, problemId: PROBLEM_ID, language, verdict, submittedAt }
      })

      await db.insert(submissions).values(batch)
      inserted += batch.length
      if (inserted % 1000 === 0 || inserted === targetCount) {
        console.log(`  inserted ${inserted} / ${targetCount}`)
      }
    }

    // 3. AC 받은 가짜 유저는 user_solved_problems 에도 표시 (done 일치를 위해).
    if (acFirstAtByUserId.size > 0) {
      await db
        .insert(userSolvedProblems)
        .values(
          Array.from(acFirstAtByUserId.entries()).map(([userId, solvedAt]) => ({
            userId,
            problemId: PROBLEM_ID,
            source: 'local' as const,
            solvedAt,
            importedAt: new Date(now),
          })),
        )
        .onConflictDoNothing()
    }

    console.log(
      `seeded: ${inserted} submissions for problem ${PROBLEM_ID} across ${userIdByName.size} fake users (${acFirstAtByUserId.size} marked solved).`,
    )
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
