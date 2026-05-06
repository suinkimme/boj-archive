// PR 머지 시 GitHub Actions에서 호출.
// 변경된 challenge slug와 기여자 GitHub 로그인을 받아 DB에 upsert.
//
// Usage:
//   npx tsx scripts/record-contributor.ts <slug> <github_login>

import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { challengeContributors, challenges } from '../db/schema'

config({ path: '.env.local' })

const [slug, githubLogin] = process.argv.slice(2)
if (!slug || !githubLogin) {
  console.error('Usage: record-contributor.ts <slug> <github_login>')
  process.exit(1)
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('POSTGRES_URL_NON_POOLING (or DATABASE_URL) is not set.')
  process.exit(1)
}

const client = postgres(connectionString)
const db = drizzle(client)

async function main() {
  const challenge = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .limit(1)

  if (!challenge[0]) {
    console.error(`Challenge not found: ${slug}`)
    await client.end()
    process.exit(1)
  }

  await db
    .insert(challengeContributors)
    .values({ challengeId: challenge[0].id, githubLogin })
    .onConflictDoNothing()

  console.log(`Recorded contributor: ${githubLogin} → ${slug}`)
  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
