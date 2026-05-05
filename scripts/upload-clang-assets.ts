// binji/wasm-clang 의 큰 바이너리(clang ~31MB, lld ~19MB)를 Cloudflare R2 에
// 업로드하고 결과 URL 을 public/judge-workers/clang/config.json 에 기록한다.
// c.js / cpp.js 워커가 init 시 이 파일을 읽어 큰 자산 위치를 결정.
//
// 실행:
//   1) git clone https://github.com/binji/wasm-clang.git /tmp/wasm-clang
//   2) .env.local 에 R2_* 5개 추가 (db:upload-problem-images 와 동일한 자격)
//   3) pnpm judge:upload-clang
//
// 결과로 갱신된 config.json 은 git 에 commit. 워커 코드는 그대로.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SOURCE_DIR = '/tmp/wasm-clang'
const KEY_PREFIX = 'judge-binaries' // R2 버킷 안 폴더
const CONFIG_DIR = 'public/judge-workers/clang'
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

const TARGETS: ReadonlyArray<{
  filename: string
  configKey: 'clangUrl' | 'lldUrl'
}> = [
  { filename: 'clang', configKey: 'clangUrl' },
  { filename: 'lld', configKey: 'lldUrl' },
]

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
    process.exit(1)
  }

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

  for (const t of TARGETS) {
    if (!existsSync(join(SOURCE_DIR, t.filename))) {
      console.error(
        `Source binary missing: ${join(SOURCE_DIR, t.filename)}\n` +
          `Run: git clone https://github.com/binji/wasm-clang.git ${SOURCE_DIR}`,
      )
      process.exit(1)
    }
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  })

  const result: Record<string, string> = {}

  for (const t of TARGETS) {
    const filePath = join(SOURCE_DIR, t.filename)
    const bytes = await readFile(filePath)
    const objectKey = `${KEY_PREFIX}/${t.filename}.wasm`

    process.stdout.write(`Uploading ${t.filename} (${bytes.length} bytes)... `)
    await s3.send(
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: 'application/wasm',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    const url = `${env.publicUrl}/${objectKey}`
    process.stdout.write(`done\n  → ${url}\n`)
    result[t.configKey] = url
  }

  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(result, null, 2) + '\n')
  console.log(`\nWrote ${CONFIG_PATH}`)
  console.log('Commit this file so the deployed worker uses the new URLs.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
