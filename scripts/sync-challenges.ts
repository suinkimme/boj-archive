// Sync challenges/ folder → DB.
//
// Reads every challenge folder, parses problem.md (frontmatter + markdown body),
// and upserts into `challenges` and `challenge_testcases` tables. Safe to re-run.
//
// Usage:
//   npx tsx scripts/sync-challenges.ts
//
// Requires POSTGRES_URL_NON_POOLING (or DATABASE_URL) in the environment.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { config } from 'dotenv'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import matter from 'gray-matter'
import postgres from 'postgres'

import { challengeTestcases, challenges } from '../db/schema'

config({ path: '.env.local' })

const CHALLENGES_DIR = 'challenges'

const connectionString = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('POSTGRES_URL_NON_POOLING (or DATABASE_URL) is not set.')
  process.exit(1)
}

const client = postgres(connectionString)
const db = drizzle(client)

interface ProblemFrontmatter {
  title: string
  time_limit: string
  memory_limit: string
  tags: string[]
  samples: { input: string; output: string }[]
}


async function main() {
  const slugs = readdirSync(CHALLENGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  let synced = 0
  let skipped = 0

  for (const slug of slugs) {
    const mdPath = join(CHALLENGES_DIR, slug, 'problem.md')
    if (!existsSync(mdPath)) {
      console.warn(`[${slug}] No problem.md, skipping`)
      skipped++
      continue
    }

    let fm: ProblemFrontmatter
    let body: string
    try {
      const { data, content } = matter(readFileSync(mdPath, 'utf8'))
      fm = data as ProblemFrontmatter
      body = content
    } catch (e) {
      console.error(`[${slug}] Parse error: ${(e as Error).message}`)
      skipped++
      continue
    }

    const [challenge] = await db
      .insert(challenges)
      .values({
        slug,
        title: fm.title,
        description: body.trim(),
        inputFormat: '',
        outputFormat: '',
        timeLimit: fm.time_limit,
        memoryLimit: fm.memory_limit,
        tags: fm.tags,
        samples: fm.samples,
      })
      .onConflictDoUpdate({
        target: challenges.slug,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          inputFormat: sql`excluded.input_format`,
          outputFormat: sql`excluded.output_format`,
          timeLimit: sql`excluded.time_limit`,
          memoryLimit: sql`excluded.memory_limit`,
          tags: sql`excluded.tags`,
          samples: sql`excluded.samples`,
        },
      })
      .returning({ id: challenges.id })

    await db.delete(challengeTestcases).where(eq(challengeTestcases.challengeId, challenge.id))

    const testcasesDir = join(CHALLENGES_DIR, slug, 'testcases')
    if (existsSync(testcasesDir)) {
      const inFiles = readdirSync(testcasesDir).filter((f) => f.endsWith('.in')).sort()
      for (const [i, inFile] of inFiles.entries()) {
        const stdin = readFileSync(join(testcasesDir, inFile), 'utf8')
        const expectedStdout = readFileSync(join(testcasesDir, inFile.replace('.in', '.out')), 'utf8')
        await db.insert(challengeTestcases).values({
          challengeId: challenge.id,
          caseIndex: i + 1,
          stdin,
          expectedStdout,
        })
      }
      console.log(`[${slug}] id=${challenge.id} testcases=${inFiles.length}`)
    } else {
      console.log(`[${slug}] id=${challenge.id} testcases=0`)
    }

    synced++
  }

  console.log(`\nsynced: ${synced}, skipped: ${skipped}`)
  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
