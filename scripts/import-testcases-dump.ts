// One-off import from a flat DB dump JSON file.
//
// Usage:
//   npx tsx scripts/import-testcases-dump.ts <path-to-dump.json>
//
// Input format (array of rows matching the testcases table schema):
//   [{ problem_id, case_index, stdin, expected_stdout, source, source_report_id }, ...]
//
// Uses POSTGRES_URL_NON_POOLING if available, else POSTGRES_URL.
// For pgbouncer (POSTGRES_URL), sets prepare:false to avoid prepared-statement issues.

import { readFile } from 'node:fs/promises'

import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../db/schema'
import { testcases, type TestcaseSource } from '../db/schema'

config({ path: '.env.local' })

const BATCH_SIZE = 500

interface DumpRow {
  problem_id: number
  case_index: number
  stdin: string
  expected_stdout: string
  source: string
  source_report_id: number | null
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-testcases-dump.ts <path>')
    process.exit(1)
  }

  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL
  if (!url) {
    console.error('No DB URL found. Set POSTGRES_URL_NON_POOLING or POSTGRES_URL.')
    process.exit(1)
  }

  const isPgBouncer = !process.env.POSTGRES_URL_NON_POOLING
  const client = postgres(url, { prepare: !isPgBouncer })
  const db = drizzle(client, { schema })

  const raw = await readFile(filePath, 'utf8')
  const rows: DumpRow[] = JSON.parse(raw)

  console.log(`Loaded ${rows.length} rows from ${filePath}`)

  let inserted = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const values = batch
      .filter((r) => typeof r.stdin === 'string' && typeof r.expected_stdout === 'string')
      .map((r) => ({
        problemId: r.problem_id,
        caseIndex: r.case_index,
        stdin: r.stdin,
        expectedStdout: r.expected_stdout,
        source: r.source as TestcaseSource,
        sourceReportId: r.source_report_id ?? undefined,
      }))

    skipped += batch.length - values.length

    if (values.length === 0) continue

    await db
      .insert(testcases)
      .values(values)
      .onConflictDoUpdate({
        target: [testcases.problemId, testcases.source, testcases.caseIndex],
        set: {
          stdin: sql`excluded.stdin`,
          expectedStdout: sql`excluded.expected_stdout`,
        },
      })

    inserted += values.length
    process.stdout.write(`\r${inserted} / ${rows.length} inserted...`)
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped}`)
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
