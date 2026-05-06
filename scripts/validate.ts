// Validate challenge folders: schema check, duplicate title check, solution run.
//
// Two validation modes (can coexist):
//   Manual    — testcases/*.in + *.out: runs solution.py against each pair
//   Generator — gen.py + brute.py: generates 100 random inputs, cross-validates
//
// At least one mode must be present.
//
// Usage:
//   npx tsx scripts/validate.ts               # all challenges/
//   npx tsx scripts/validate.ts sum-two-numbers two-sum

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import matter from 'gray-matter'

import { ALL_TAGS } from '../components/challenges/tags'

const CHALLENGES_DIR = 'challenges'
const ALLOWED_TAGS = new Set(ALL_TAGS.map((t) => t.value))
const RANDOM_COUNT = 100

const REQUIRED_FRONTMATTER = [
  'title',
  'time_limit',
  'memory_limit',
  'tags',
  'samples',
] as const

interface ProblemFrontmatter {
  title: string
  time_limit: string
  memory_limit: string
  tags: string[]
  samples: { input: string; output: string }[]
}

function parseProblem(slug: string): { data: ProblemFrontmatter; content: string } | null {
  const mdPath = join(CHALLENGES_DIR, slug, 'problem.md')
  if (!existsSync(mdPath)) return null
  const { data, content } = matter(readFileSync(mdPath, 'utf8'))
  return { data: data as ProblemFrontmatter, content }
}

function runPython(scriptPath: string, stdin: string, args: string[] = []) {
  const result = spawnSync('python3', [scriptPath, ...args], {
    input: stdin,
    encoding: 'utf8',
    timeout: 10_000,
  })
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status }
}

async function main() {
  const allSlugs = readdirSync(CHALLENGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  // Duplicate title check across all challenges
  const titleMap = new Map<string, string>()
  for (const slug of allSlugs) {
    const parsed = parseProblem(slug)
    if (!parsed) continue
    const { title } = parsed.data
    if (typeof title === 'string') {
      if (titleMap.has(title)) {
        console.error(`[${slug}] Duplicate title "${title}" (also used by ${titleMap.get(title)})`)
        process.exit(1)
      }
      titleMap.set(title, slug)
    }
  }

  const targetSlugs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : allSlugs
  let failed = false

  for (const slug of targetSlugs) {
    const challengeDir = join(CHALLENGES_DIR, slug)
    let slugFailed = false

    // ── problem.md 파싱 ──────────────────────────────────────────────
    const mdPath = join(challengeDir, 'problem.md')
    if (!existsSync(mdPath)) {
      console.error(`[${slug}] Missing problem.md`)
      failed = true
      continue
    }

    let data: ProblemFrontmatter
    let content: string
    try {
      const parsed = matter(readFileSync(mdPath, 'utf8'))
      data = parsed.data as ProblemFrontmatter
      content = parsed.content
    } catch (e) {
      console.error(`[${slug}] Failed to parse problem.md: ${(e as Error).message}`)
      failed = true
      continue
    }

    // 본문이 비어있으면 경고
    if (!content.trim()) {
      console.error(`[${slug}] problem.md body is empty`)
      slugFailed = true
    }

    // 필수 frontmatter 필드
    for (const field of REQUIRED_FRONTMATTER) {
      if (!data[field]) {
        console.error(`[${slug}] Missing frontmatter field: ${field}`)
        slugFailed = true
      }
    }

    if (slugFailed) { failed = true; continue }

    if (!Array.isArray(data.tags) || data.tags.some((t) => typeof t !== 'string')) {
      console.error(`[${slug}] "tags" must be an array of strings`)
      slugFailed = true
    } else {
      const unknown = data.tags.filter((t) => !ALLOWED_TAGS.has(t))
      if (unknown.length > 0) {
        console.error(`[${slug}] Unknown tags: ${unknown.join(', ')}`)
        console.error(`  Allowed tags: ${[...ALLOWED_TAGS].join(', ')}`)
        slugFailed = true
      }
    }

    if (!Array.isArray(data.samples)) {
      console.error(`[${slug}] "samples" must be an array`)
      slugFailed = true
    } else {
      for (const [i, s] of data.samples.entries()) {
        if (typeof s.input !== 'string' || typeof s.output !== 'string') {
          console.error(`[${slug}] samples[${i}] must have string "input" and "output"`)
          slugFailed = true
        }
      }
    }

    if (slugFailed) { failed = true; continue }

    // ── solution.py ──────────────────────────────────────────────────
    const solutionPath = join(challengeDir, 'solution.py')
    if (!existsSync(solutionPath)) {
      console.error(`[${slug}] Missing solution.py`)
      failed = true
      continue
    }

    // ── 검증 모드 판별 ────────────────────────────────────────────────
    const testcasesDir = join(challengeDir, 'testcases')
    const genPath = join(challengeDir, 'gen.py')
    const brutePath = join(challengeDir, 'brute.py')

    const inFiles = existsSync(testcasesDir)
      ? readdirSync(testcasesDir).filter((f) => f.endsWith('.in')).sort()
      : []
    const hasManual = inFiles.length > 0
    const hasGenerator = existsSync(genPath) && existsSync(brutePath)

    if (!hasManual && !hasGenerator) {
      console.error(`[${slug}] Need testcases/*.in or gen.py + brute.py`)
      failed = true
      continue
    }

    // ── 수동 테스트케이스 ─────────────────────────────────────────────
    if (hasManual) {
      const files = readdirSync(testcasesDir).sort()
      const missingOut = inFiles.filter((f) => !files.includes(f.replace('.in', '.out')))
      if (missingOut.length > 0) {
        console.error(`[${slug}] Missing .out for: ${missingOut.join(', ')}`)
        failed = true
        continue
      }

      console.log(`[${slug}] Running ${inFiles.length} manual testcase(s)...`)
      for (const inFile of inFiles) {
        const stdin = readFileSync(join(testcasesDir, inFile), 'utf8')
        const expected = readFileSync(join(testcasesDir, inFile.replace('.in', '.out')), 'utf8').trimEnd()
        const { stdout, stderr, status } = runPython(solutionPath, stdin)

        if (status !== 0 || stderr) {
          console.error(`[${slug}/${inFile}] Runtime error (exit ${status}):\n${stderr}`)
          slugFailed = true
          continue
        }
        if (stdout.trimEnd() !== expected) {
          console.error(`[${slug}/${inFile}] Wrong: expected ${JSON.stringify(expected)}, got ${JSON.stringify(stdout.trimEnd())}`)
          slugFailed = true
        } else {
          console.log(`  ${inFile}: OK`)
        }
      }
    }

    // ── 생성기 모드 ───────────────────────────────────────────────────
    if (hasGenerator) {
      console.log(`[${slug}] Running ${RANDOM_COUNT} random tests (gen.py × brute.py)...`)
      for (let seed = 1; seed <= RANDOM_COUNT; seed++) {
        const gen = runPython(genPath, '', [String(seed)])
        if (gen.status !== 0 || gen.stderr) {
          console.error(`[${slug}] gen.py failed on seed ${seed}:\n${gen.stderr}`)
          slugFailed = true
          break
        }
        const sol = runPython(solutionPath, gen.stdout)
        if (sol.status !== 0 || sol.stderr) {
          console.error(`[${slug}] solution.py crashed on seed ${seed}:\n${sol.stderr}\n  Input: ${gen.stdout.trim()}`)
          slugFailed = true
          break
        }
        const brute = runPython(brutePath, gen.stdout)
        if (brute.status !== 0 || brute.stderr) {
          console.error(`[${slug}] brute.py crashed on seed ${seed}:\n${brute.stderr}`)
          slugFailed = true
          break
        }
        if (sol.stdout.trimEnd() !== brute.stdout.trimEnd()) {
          console.error(`[${slug}] Mismatch on seed ${seed}:\n  Input: ${gen.stdout.trim()}\n  solution: ${JSON.stringify(sol.stdout.trimEnd())}\n  brute:    ${JSON.stringify(brute.stdout.trimEnd())}`)
          slugFailed = true
          break
        }
      }
      if (!slugFailed) console.log(`  All ${RANDOM_COUNT} random tests passed`)
    }

    if (slugFailed) failed = true
    else console.log(`[${slug}] All checks passed ✓`)
  }

  if (failed) process.exit(1)
  console.log('\nAll challenges valid.')
}

main().catch((e) => { console.error(e); process.exit(1) })
