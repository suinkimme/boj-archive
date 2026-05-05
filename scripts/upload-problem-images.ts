// 문제 이미지(problems/<id>/<*.png|jpg|gif>)를 Cloudflare R2 (S3-compatible)
// 에 업로드하고 public URL 매핑을 scripts/problem-image-urls.json 에 저장한다.
//
// 실행:
//   1) .env.local 에 다음 키 추가:
//        R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//        R2_BUCKET, R2_PUBLIC_URL  (예: https://pub-xxxxxx.r2.dev)
//      Cloudflare 대시보드 → R2 → Manage API Tokens / 버킷 Settings 에서 발급.
//   2) npm run db:upload-problem-images
//
// idempotent — cache 에 이미 등록된 키는 건너뛴다. 매 batch 후 cache 를
// 디스크에 flush 하므로 중간에 끊겨도 다음 실행에서 이어 받음.
//
// R2 의 public r2.dev 엔드포인트는 immutable cache 가 기본 적용되므로
// 한 번 업로드된 URL 은 영구적이다 (CacheControl 헤더는 정보 제공용).

import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { config } from 'dotenv'

config({ path: '.env.local' })

const PROBLEMS_DIR = 'problems'
const CACHE_PATH = 'scripts/problem-image-urls.json'
const CONCURRENCY = 32
const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
])
// R2 버킷 안의 prefix — 대시보드에서 problems-images/ 폴더로 묶여 보임.
const KEY_PREFIX = 'problems-images'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

type Cache = Record<string, string>

interface Task {
  key: string // "<problemId>/<filename>" — DB 의 description HTML src 매칭에 사용
  path: string
  ext: string
}

interface R2Env {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

function loadR2Env(): R2Env {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.R2_PUBLIC_URL

  const missing: string[] = []
  if (!accountId) missing.push('R2_ACCOUNT_ID')
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID')
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY')
  if (!bucket) missing.push('R2_BUCKET')
  if (!publicUrl) missing.push('R2_PUBLIC_URL')
  if (missing.length > 0) {
    console.error(`Missing env: ${missing.join(', ')}`)
    console.error(
      'Cloudflare Dashboard → R2 → 버킷 Settings (R2_PUBLIC_URL) / Manage API Tokens (Access Key + Secret) 에서 발급.',
    )
    process.exit(1)
  }

  // 끝 슬래시 정규화 — public URL 끝에 / 가 있든 없든 동일하게 동작.
  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    publicUrl: publicUrl!.replace(/\/+$/, ''),
  }
}

async function main() {
  const env = loadR2Env()

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  })

  const cache: Cache = await loadCache()
  console.log(`existing cache: ${Object.keys(cache).length}`)

  const tasks = await collectTasks(cache)
  console.log(`new uploads: ${tasks.length}`)

  if (tasks.length === 0) {
    console.log('nothing to upload — cache already covers all images.')
    return
  }

  let uploaded = 0
  let failed = 0
  const start = Date.now()

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((t) => uploadOne(t, s3, env)),
    )
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled') {
        cache[r.value.key] = r.value.url
        uploaded++
      } else {
        failed++
        const msg =
          r.reason instanceof Error ? r.reason.message : String(r.reason)
        console.error(`failed: ${batch[j].key} — ${msg}`)
      }
    }
    await saveCache(cache)

    const done = Math.min(i + CONCURRENCY, tasks.length)
    const elapsed = (Date.now() - start) / 1000
    const rate = done / elapsed
    if (done % 160 === 0 || done === tasks.length) {
      console.log(
        `  ${done}/${tasks.length}  (${rate.toFixed(1)} img/s, eta ${Math.round((tasks.length - done) / Math.max(rate, 0.1))}s)`,
      )
    }
  }

  console.log('---')
  console.log(`uploaded:    ${uploaded}`)
  console.log(`failed:      ${failed}`)
  console.log(`total cache: ${Object.keys(cache).length}`)
  if (failed > 0) {
    console.log('\nrerun the script — failed uploads will be retried.')
    process.exit(1)
  }
}

async function collectTasks(cache: Cache): Promise<Task[]> {
  const tasks: Task[] = []
  const entries = await readdir(PROBLEMS_DIR, { withFileTypes: true })

  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (!/^\d+$/.test(e.name)) continue

    const dirPath = join(PROBLEMS_DIR, e.name)
    let files: string[]
    try {
      files = await readdir(dirPath)
    } catch {
      continue
    }

    for (const f of files) {
      const ext = extname(f).toLowerCase()
      if (!IMAGE_EXTS.has(ext)) continue

      const key = `${e.name}/${f}`
      if (cache[key]) continue

      tasks.push({ key, path: join(dirPath, f), ext })
    }
  }

  tasks.sort((a, b) => a.key.localeCompare(b.key))
  return tasks
}

async function uploadOne(
  t: Task,
  s3: S3Client,
  env: R2Env,
): Promise<{ key: string; url: string }> {
  const bytes = await readFile(t.path)
  const objectKey = `${KEY_PREFIX}/${t.key}` // R2 object key

  await s3.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: MIME[t.ext] ?? 'application/octet-stream',
      // 우리는 같은 path 에 같은 콘텐츠만 올림 → r2.dev 의 캐시가 영구적이어도 안전.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return { key: t.key, url: `${env.publicUrl}/${objectKey}` }
}

async function loadCache(): Promise<Cache> {
  if (!existsSync(CACHE_PATH)) return {}
  const raw = await readFile(CACHE_PATH, 'utf8')
  return JSON.parse(raw) as Cache
}

async function saveCache(cache: Cache): Promise<void> {
  const sorted = Object.fromEntries(
    Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)),
  )
  await writeFile(CACHE_PATH, JSON.stringify(sorted, null, 2) + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
