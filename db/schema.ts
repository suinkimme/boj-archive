import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'

export type SolvedSource = 'solvedac' | 'local'
export type TestcaseSource = 'testcase_ac' | 'sample' | 'community_report'
export type SubmissionLanguage = 'python' | 'c' | 'cpp'
export type SubmissionVerdict = 'AC' | 'WA' | 'RE' | 'TLE'

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  githubId: text('github_id').unique(),
  login: text('login'),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  bojHandle: text('boj_handle').unique(),
  bojHandleVerifiedAt: timestamp('boj_handle_verified_at', { mode: 'date' }),
  onboardedAt: timestamp('onboarded_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
)

export const bojVerifications = pgTable('boj_verifications', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  handle: text('handle').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  consumedAt: timestamp('consumed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const solvedAcSnapshots = pgTable('solved_ac_snapshots', {
  handle: text('handle').primaryKey(),
  tier: integer('tier').notNull(),
  solvedCount: integer('solved_count').notNull(),
  rating: integer('rating').notNull(),
  raw: jsonb('raw').notNull(),
  fetchedAt: timestamp('fetched_at', { mode: 'date' }).notNull().defaultNow(),
})

// Global problem catalog. Two ingestion paths upsert into this table:
//   1. solved.ac lazy import — fills metadata (title, level, counts) when a
//      user's solve history references a problem we haven't seen yet.
//   2. scripts/import-problems.ts — bulk-loads canonical body content
//      (description, samples, tags, limits) from problems/<id>/problem.json.
// Body columns are nullable because lazy-imported rows may exist before
// canonical content has been ingested.
export const problems = pgTable('problems', {
  problemId: integer('problem_id').primaryKey(),
  titleKo: text('title_ko').notNull(),
  level: integer('level').notNull(),
  acceptedUserCount: integer('accepted_user_count'),
  averageTries: real('average_tries'),
  raw: jsonb('raw'),
  fetchedAt: timestamp('fetched_at', { mode: 'date' }).notNull().defaultNow(),
  // Body content (from problem.json)
  description: text('description'),
  inputFormat: text('input_format'),
  outputFormat: text('output_format'),
  samples: jsonb('samples').$type<{ input: string; output: string }[]>(),
  hint: text('hint'),
  source: text('source'),
  tags: text('tags').array(),
  timeLimit: text('time_limit'),
  memoryLimit: text('memory_limit'),
  submissionCount: integer('submission_count'),
})

// Problems cleared under merger doctrine — expression merges with idea,
// no fictional characters or branded settings. Safe basis for original
// problem authorship in a commercial context.
export const standardProblems = pgTable('standard_problems', {
  problemId: integer('problem_id')
    .primaryKey()
    .references(() => problems.problemId, { onDelete: 'cascade' }),
  // Rewritten descriptions for problems whose original BOJ text is non-exempt.
  // null = use problems.description as-is (exempt cases).
  description: text('description'),
  inputFormat: text('input_format'),
  outputFormat: text('output_format'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

// Service-native problem catalog. Completely independent of BOJ's schema:
//   - id: our own sequential number (1, 2, 3, ...)
//   - no difficulty/level (BOJ tier removed)
//   - titles renamed away from BOJ-specific creative names
//   - boj_problem_id: internal only, used to join testcases table
export const challenges = pgTable('challenges', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  inputFormat: text('input_format').notNull(),
  outputFormat: text('output_format').notNull(),
  samples: jsonb('samples').$type<{ input: string; output: string }[]>(),
  tags: text('tags').array(),
  timeLimit: text('time_limit'),
  memoryLimit: text('memory_limit'),
  bojProblemId: integer('boj_problem_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

// Hidden test cases for challenges. Fully decoupled from BOJ's testcases table —
// no problem_id, no source field exposed. Seeded from testcases where source='testcase_ac'.
export const challengeTestcases = pgTable(
  'challenge_testcases',
  {
    id: serial('id').primaryKey(),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    caseIndex: integer('case_index').notNull(),
    stdin: text('stdin').notNull(),
    expectedStdout: text('expected_stdout').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('challenge_testcases_challenge_idx').on(t.challengeId),
  ],
)

// Cross-instance rate-limit log. One row per outbound solved.ac
// request; we count rows in a sliding 1s window to gate further calls.
// Old rows are cleaned up opportunistically on insert.
export const solvedAcRequestLog = pgTable(
  'solved_ac_request_log',
  {
    id: serial('id').primaryKey(),
    requestedAt: timestamp('requested_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('solved_ac_request_log_requested_at_idx').on(t.requestedAt)],
)

// Curated testcases used by the in-browser judge. Sources:
//   testcase_ac      — auto-generated from testcase-ac (generator + correct)
//   sample           — sample I/O from the original problem statement
//   community_report — accepted from a user submission via problem_reports
// problem_id intentionally has no FK: testcases may exist for problems
// before the lazy `problems` row is populated. source_report_id is reserved
// for the upcoming problem_reports table — FK will be added in a later
// migration once that table lands.
export const testcases = pgTable(
  'testcases',
  {
    id: serial('id').primaryKey(),
    problemId: integer('problem_id').notNull(),
    caseIndex: integer('case_index').notNull(),
    stdin: text('stdin').notNull(),
    expectedStdout: text('expected_stdout').notNull(),
    source: text('source').$type<TestcaseSource>().notNull(),
    sourceReportId: integer('source_report_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique('testcases_problem_source_case_uniq').on(
      t.problemId,
      t.source,
      t.caseIndex,
    ),
    index('testcases_problem_idx').on(t.problemId),
  ],
)

// Per-user solve history. source=solvedac for imports from the
// solved.ac API; source=local for problems solved on this judge.
export const userSolvedProblems = pgTable(
  'user_solved_problems',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    problemId: integer('problem_id')
      .notNull()
      .references(() => problems.problemId, { onDelete: 'cascade' }),
    source: text('source').$type<SolvedSource>().notNull(),
    solvedAt: timestamp('solved_at', { mode: 'date' }),
    importedAt: timestamp('imported_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.problemId] }),
    index('user_solved_problems_user_idx').on(t.userId),
  ],
)

// 이 사이트 채점기에서 발생한 제출 1건 = 1 row. AC/WA/RE/TLE 모두 기록한다.
// solved.ac에서 가져온 풀이 이력은 시도 정보(언어/시각)가 없어 여기 들어오지
// 않는다 — 그쪽은 user_solved_problems만 채운다.
//
// 활용처:
//   - 문제 디테일의 모든 사용자 히스토리 탭 (problemId 기준 최신순)
//   - 마이페이지의 내 제출 이력
//   - 문제 리스트의 tried 플래그/필터 (EXISTS by userId+problemId)
export const submissions = pgTable(
  'submissions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    problemId: integer('problem_id')
      .notNull()
      .references(() => problems.problemId, { onDelete: 'cascade' }),
    language: text('language').$type<SubmissionLanguage>().notNull(),
    verdict: text('verdict').$type<SubmissionVerdict>().notNull(),
    submittedAt: timestamp('submitted_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // 마이페이지 본인 제출 이력 + tried 플래그용 EXISTS 빠르게.
    index('submissions_user_problem_idx').on(t.userId, t.problemId),
    // 문제 디테일 히스토리 탭은 problemId로 최신순 페이지네이션한다.
    index('submissions_problem_submitted_at_idx').on(
      t.problemId,
      t.submittedAt,
    ),
  ],
)
