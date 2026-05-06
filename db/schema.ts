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
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'

export type SolvedSource = 'local'
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

export const problems = pgTable('problems', {
  problemId: integer('problem_id').primaryKey(),
  titleKo: text('title_ko').notNull(),
  level: integer('level').notNull(),
  acceptedUserCount: integer('accepted_user_count'),
  averageTries: real('average_tries'),
  raw: jsonb('raw'),
  fetchedAt: timestamp('fetched_at', { mode: 'date' }).notNull().defaultNow(),
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

export const standardProblems = pgTable('standard_problems', {
  problemId: integer('problem_id')
    .primaryKey()
    .references(() => problems.problemId, { onDelete: 'cascade' }),
  description: text('description'),
  inputFormat: text('input_format'),
  outputFormat: text('output_format'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const challenges = pgTable('challenges', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  inputFormat: text('input_format').notNull(),
  outputFormat: text('output_format').notNull(),
  samples: jsonb('samples').$type<{ input: string; output: string }[]>(),
  tags: text('tags').array(),
  timeLimit: text('time_limit'),
  memoryLimit: text('memory_limit'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

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

export const challengeSubmissions = pgTable(
  'challenge_submissions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    language: text('language').$type<SubmissionLanguage>().notNull(),
    verdict: text('verdict').$type<SubmissionVerdict>().notNull(),
    submittedAt: timestamp('submitted_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('challenge_submissions_user_challenge_idx').on(t.userId, t.challengeId),
    index('challenge_submissions_challenge_submitted_at_idx').on(t.challengeId, t.submittedAt),
  ],
)

export const challengeContributors = pgTable(
  'challenge_contributors',
  {
    id: serial('id').primaryKey(),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    githubLogin: text('github_login').notNull(),
    contributedAt: timestamp('contributed_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('challenge_contributors_challenge_idx').on(t.challengeId),
    uniqueIndex('challenge_contributors_unique').on(t.challengeId, t.githubLogin),
  ],
)

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
    index('submissions_user_problem_idx').on(t.userId, t.problemId),
    index('submissions_problem_submitted_at_idx').on(
      t.problemId,
      t.submittedAt,
    ),
  ],
)
