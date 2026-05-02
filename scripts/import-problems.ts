// Bulk-load problems/<id>/problem.json files into the `problems` table.
//
// Repository keeps the canonical content; this script just mirrors it
// into the DB so we can query / filter / join. Run after problem.json
// changes have landed in the working tree:
//   npm run db:import-problems
//
// Idempotent: re-running upserts. Body columns are overwritten with
// fresh content; metadata fields (level, counts) are kept in sync with
// the JSON, since BOJ snapshots in problem.json supersede stale
// solved.ac lazy-cached values.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../db/schema'
import { problems } from '../db/schema'

config({ path: '.env.local' })

const PROBLEMS_DIR = 'problems'
const BATCH_SIZE = 200

interface ProblemFile {
  id: number
  title: string
  time_limit: string
  memory_limit: string
  description: string
  input: string
  output: string
  samples: { input: string; output: string }[]
  hint: string | null
  source: string | null
  level: number
  tags: string[]
  accepted_user_count: number | null
  submission_count: number | null
  average_tries: number | null
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Aborting.')
    process.exit(1)
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client, { schema })

  const entries = await readdir(PROBLEMS_DIR, { withFileTypes: true })
  const problemDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => /^\d+$/.test(n))
    .sort((a, b) => Number(a) - Number(b))

  let imported = 0
  let missing = 0
  let parseErrors = 0
  let invalid = 0
  let buffer: (typeof problems.$inferInsert)[] = []

  async function flush() {
    if (buffer.length === 0) return
    await db
      .insert(problems)
      .values(buffer)
      .onConflictDoUpdate({
        target: problems.problemId,
        set: {
          titleKo: sql`excluded.title_ko`,
          level: sql`excluded.level`,
          acceptedUserCount: sql`excluded.accepted_user_count`,
          averageTries: sql`excluded.average_tries`,
          description: sql`excluded.description`,
          inputFormat: sql`excluded.input_format`,
          outputFormat: sql`excluded.output_format`,
          samples: sql`excluded.samples`,
          hint: sql`excluded.hint`,
          source: sql`excluded.source`,
          tags: sql`excluded.tags`,
          timeLimit: sql`excluded.time_limit`,
          memoryLimit: sql`excluded.memory_limit`,
          submissionCount: sql`excluded.submission_count`,
          fetchedAt: sql`now()`,
        },
      })
    buffer = []
  }

  for (const name of problemDirs) {
    const problemId = Number(name)
    const path = join(PROBLEMS_DIR, name, 'problem.json')
    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch {
      missing++
      continue
    }

    let parsed: ProblemFile
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      console.error(`parse error: ${path}`, (e as Error).message)
      parseErrors++
      continue
    }

    if (typeof parsed.title !== 'string' || !Array.isArray(parsed.tags)) {
      invalid++
      continue
    }

    // solved.ac uses 0 to mean "Unrated"; map untiered (null) problems
    // to that bucket so they're queryable rather than dropped.
    const level = typeof parsed.level === 'number' ? parsed.level : 0

    buffer.push({
      problemId,
      titleKo: parsed.title,
      level,
      acceptedUserCount: parsed.accepted_user_count ?? null,
      averageTries: parsed.average_tries ?? null,
      description: parsed.description ?? '',
      inputFormat: parsed.input ?? '',
      outputFormat: parsed.output ?? '',
      samples: Array.isArray(parsed.samples) ? parsed.samples : [],
      hint: parsed.hint ?? null,
      source: parsed.source ?? null,
      tags: parsed.tags,
      timeLimit: parsed.time_limit ?? null,
      memoryLimit: parsed.memory_limit ?? null,
      submissionCount: parsed.submission_count ?? null,
    })
    imported++
    if (buffer.length >= BATCH_SIZE) await flush()
  }
  await flush()

  console.log('---')
  console.log(`imported:     ${imported}`)
  console.log(`missing:      ${missing}`)
  console.log(`parse errors: ${parseErrors}`)
  console.log(`invalid:      ${invalid}`)

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
