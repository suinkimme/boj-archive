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
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'

export type SolvedSource = 'solvedac' | 'local'

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

// Global problem catalog. Populated lazily as we import users' solved
// problems; rows are upserted with the latest metadata seen.
export const problems = pgTable('problems', {
  problemId: integer('problem_id').primaryKey(),
  titleKo: text('title_ko').notNull(),
  level: integer('level').notNull(),
  acceptedUserCount: integer('accepted_user_count'),
  averageTries: real('average_tries'),
  raw: jsonb('raw'),
  fetchedAt: timestamp('fetched_at', { mode: 'date' }).notNull().defaultNow(),
})

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
