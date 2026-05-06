// Bulk-load problems/<id>/problem.json files into the `problems` table.
//
// Repository keeps the canonical content; this script just mirrors it
// into the DB so we can query / filter / join. Run after problem.json
// changes have landed in the working tree:
//   npm run db:import-problems
//
// Idempotent: re-running upserts. Body columns are overwritten with
// fresh content; metadata fields (level, counts) are kept in sync with
// the JSON, since snapshots in problem.json supersede stale
// solved.ac lazy-cached values.

import { existsSync } from 'node:fs'
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
const IMAGE_CACHE_PATH = 'scripts/problem-image-urls.json'

type ImageCache = Record<string, string>

async function loadImageCache(): Promise<ImageCache> {
  if (!existsSync(IMAGE_CACHE_PATH)) return {}
  const raw = await readFile(IMAGE_CACHE_PATH, 'utf8')
  return JSON.parse(raw) as ImageCache
}

// 일부 문제 본문이 macOS case-insensitive 파일시스템 기준 케이스로 src 를
// 적어 둔 경우(예: 디스크는 fig1.png, HTML 은 Fig1.png) 케이스만 다른 매칭을
// 잡아주기 위해 lowercase 인덱스를 만들어 둔다.
function buildLowercaseIndex(cache: ImageCache): ImageCache {
  const idx: ImageCache = {}
  for (const [k, v] of Object.entries(cache)) idx[k.toLowerCase()] = v
  return idx
}

// 본문 HTML 의 <img src="1.png" /> 등 상대 경로를 cache 의 Blob URL 로 치환.
// 절대 URL(http/https/data:)은 그대로 둠. cache 에 없는 키는 그대로 둠 (경고
// 로그만 한 번 — 누락된 이미지는 운영자가 upload 스크립트를 다시 돌려야 한다).
function rewriteImageSrc(
  html: string | null | undefined,
  problemId: number,
  cache: ImageCache,
  cacheLower: ImageCache,
  missingRef: { count: number },
): string {
  if (!html) return ''
  return html.replace(
    /(<img\b[^>]*\bsrc=)(["'])([^"']+)\2/gi,
    (full, prefix, quote, src) => {
      if (
        src.startsWith('http://') ||
        src.startsWith('https://') ||
        src.startsWith('//') || // protocol-relative
        src.startsWith('data:') ||
        src.startsWith('file:') // 일부 본문에 남은 워드/오피스 잔여물 — 어차피 깨진 src
      ) {
        return full
      }
      const key = `${problemId}/${src}`
      const url = cache[key] ?? cacheLower[key.toLowerCase()]
      if (!url) {
        missingRef.count++
        return full
      }
      return `${prefix}${quote}${url}${quote}`
    },
  )
}

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
  // Use the direct (non-pooled) URL for bulk upserts — pgbouncer transaction
  // pooling forces `prepare: false` and adds round-trip overhead we don't want
  // for batched inserts.
  if (!process.env.POSTGRES_URL_NON_POOLING) {
    console.error('POSTGRES_URL_NON_POOLING is not set. Aborting.')
    process.exit(1)
  }

  const client = postgres(process.env.POSTGRES_URL_NON_POOLING)
  const db = drizzle(client, { schema })

  const imageCache = await loadImageCache()
  const imageCacheLower = buildLowercaseIndex(imageCache)
  console.log(`image cache: ${Object.keys(imageCache).length} entries`)

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
  const missingRef = { count: 0 } // cache 에 없는 src 의 누계
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

    const description = rewriteImageSrc(
      parsed.description,
      problemId,
      imageCache,
      imageCacheLower,
      missingRef,
    )
    const inputFormat = rewriteImageSrc(
      parsed.input,
      problemId,
      imageCache,
      imageCacheLower,
      missingRef,
    )
    const outputFormat = rewriteImageSrc(
      parsed.output,
      problemId,
      imageCache,
      imageCacheLower,
      missingRef,
    )
    const hint =
      parsed.hint != null
        ? rewriteImageSrc(
            parsed.hint,
            problemId,
            imageCache,
            imageCacheLower,
            missingRef,
          )
        : null

    buffer.push({
      problemId,
      titleKo: parsed.title,
      level,
      acceptedUserCount: parsed.accepted_user_count ?? null,
      averageTries: parsed.average_tries ?? null,
      description,
      inputFormat,
      outputFormat,
      samples: Array.isArray(parsed.samples) ? parsed.samples : [],
      hint,
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
  console.log(`imported:        ${imported}`)
  console.log(`missing:         ${missing}`)
  console.log(`parse errors:    ${parseErrors}`)
  console.log(`invalid:         ${invalid}`)
  console.log(`unmapped images: ${missingRef.count}`)
  if (missingRef.count > 0) {
    console.log(
      '  → cache 에 없는 src — npm run db:upload-problem-images 다시 돌려서 매핑 보강 후 재 import.',
    )
  }

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
