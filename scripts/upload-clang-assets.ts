// binji/wasm-clang 의 큰 바이너리(clang ~31MB, lld ~19MB)를 Vercel Blob 에 업로드.
// 업로드된 URL 을 public/judge-workers/clang/config.json 에 기록 — c.js / cpp.js
// 워커가 init 시 이 파일을 읽어 큰 자산을 어디서 받을지 결정한다.
//
// 실행:
//   1) git clone https://github.com/binji/wasm-clang.git /tmp/wasm-clang
//   2) .env.local 에 BLOB_READ_WRITE_TOKEN 추가
//      (Vercel 대시보드 → Project → Storage → Blob → Create Token)
//   3) pnpm judge:upload-clang   (또는 npm run / yarn 동일)
//
// 결과로 갱신된 config.json 은 git 에 commit. 워커 코드는 그대로.
//
// 참고: addRandomSuffix=true 이므로 재업로드 시 URL 이 바뀐다 → 캐시 무효화 자연스러움.

import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

import { put } from '@vercel/blob'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SOURCE_DIR = '/tmp/wasm-clang'
const TARGETS: ReadonlyArray<{
  filename: string
  blobKey: string
  configKey: 'clangUrl' | 'lldUrl'
}> = [
  { filename: 'clang', blobKey: 'judge/clang', configKey: 'clangUrl' },
  { filename: 'lld', blobKey: 'judge/lld', configKey: 'lldUrl' },
]

const CONFIG_DIR = 'public/judge-workers/clang'
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.error('BLOB_READ_WRITE_TOKEN missing.')
    console.error(
      'Add to .env.local — Vercel Dashboard → Project → Storage → Blob → Create Token',
    )
    process.exit(1)
  }

  for (const t of TARGETS) {
    if (!existsSync(join(SOURCE_DIR, t.filename))) {
      console.error(
        `Source binary missing: ${join(SOURCE_DIR, t.filename)}\n` +
          `Run: git clone https://github.com/binji/wasm-clang.git ${SOURCE_DIR}`,
      )
      process.exit(1)
    }
  }

  const result: Record<string, string> = {}

  for (const t of TARGETS) {
    const filePath = join(SOURCE_DIR, t.filename)
    const bytes = await readFile(filePath)
    process.stdout.write(`Uploading ${t.filename} (${bytes.length} bytes)... `)
    const blob = await put(t.blobKey, bytes, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/wasm',
      cacheControlMaxAge: 60 * 60 * 24 * 365, // 1 year — Apache-2.0 immutable
      token,
    })
    process.stdout.write(`done\n  → ${blob.url}\n`)
    result[t.configKey] = blob.url
  }

  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(result, null, 2) + '\n')
  console.log(`\nWrote ${CONFIG_PATH}`)
  console.log('Commit this file so the deployed worker uses the Blob URLs.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
