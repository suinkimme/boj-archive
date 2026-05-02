import { config } from 'dotenv'
import type { Config } from 'drizzle-kit'

config({ path: '.env.local' })

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations need a direct connection — the pooler doesn't allow some
    // statements (advisory locks, `CREATE TYPE`, etc.) drizzle-kit emits.
    url: process.env.POSTGRES_URL_NON_POOLING!,
  },
  strict: true,
  verbose: true,
} satisfies Config
