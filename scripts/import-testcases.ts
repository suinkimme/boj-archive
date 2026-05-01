// Bulk-load problems/<id>/testcases.json files into the `testcases` table.
//
// Source files are not committed to this repo; obtain them from the
// feat/add-testcases branch (or regenerate via testcase-ac) before running:
//   git checkout origin/feat/add-testcases -- 'problems/**/testcases.json'
//   npm run db:import-testcases
//
// Idempotent: existing rows for (problem_id, source, case_index) are updated
// in place via ON CONFLICT.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'

import * as schema from '../db/schema'
import { testcases, type TestcaseSource } from '../db/schema'

config({ path: '.env.local' })

const PROBLEMS_DIR = 'problems'
const SOURCE: TestcaseSource = 'testcase_ac'
const BATCH_SIZE = 500

interface RawCase {
  input: string
  output: string
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Aborting.')
    process.exit(1)
  }

  const db = drizzle(neon(process.env.DATABASE_URL), { schema })

  const entries = await readdir(PROBLEMS_DIR, { withFileTypes: true })
  const problemDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => /^\d+$/.test(n))
    .sort((a, b) => Number(a) - Number(b))

  let totalProblems = 0
  let totalCases = 0
  let missing = 0
  let empty = 0
  let parseErrors = 0
  let buffer: (typeof testcases.$inferInsert)[] = []

  async function flush() {
    if (buffer.length === 0) return
    await db
      .insert(testcases)
      .values(buffer)
      .onConflictDoUpdate({
        target: [testcases.problemId, testcases.source, testcases.caseIndex],
        set: {
          stdin: sql`excluded.stdin`,
          expectedStdout: sql`excluded.expected_stdout`,
        },
      })
    buffer = []
  }

  for (const name of problemDirs) {
    const problemId = Number(name)
    const path = join(PROBLEMS_DIR, name, 'testcases.json')
    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch {
      missing++
      continue
    }
    if (!raw.trim()) {
      empty++
      continue
    }

    let cases: RawCase[]
    try {
      cases = JSON.parse(raw)
    } catch (e) {
      console.error(`parse error: ${path}`, (e as Error).message)
      parseErrors++
      continue
    }
    if (!Array.isArray(cases) || cases.length === 0) {
      empty++
      continue
    }

    totalProblems++
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]
      if (typeof c?.input !== 'string' || typeof c?.output !== 'string') continue
      buffer.push({
        problemId,
        caseIndex: i,
        stdin: c.input,
        expectedStdout: c.output,
        source: SOURCE,
      })
      totalCases++
      if (buffer.length >= BATCH_SIZE) await flush()
    }
  }
  await flush()

  console.log('---')
  console.log(`source:        ${SOURCE}`)
  console.log(`problems:      ${totalProblems}`)
  console.log(`cases:         ${totalCases}`)
  console.log(`missing files: ${missing}`)
  console.log(`empty/invalid: ${empty}`)
  console.log(`parse errors:  ${parseErrors}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
