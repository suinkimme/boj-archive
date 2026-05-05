// R2 버킷에 CORS 룰 적용 — worker 의 fetch() / WebAssembly.compileStreaming
// 이 cross-origin 으로 wasm 을 받으려면 ACAO 헤더 필요. <img> 는 무관.
//
// 1회 실행: npx tsx scripts/configure-r2-cors.ts

import {
  PutBucketCorsCommand,
  S3Client,
  type CORSRule,
} from '@aws-sdk/client-s3'
import { config } from 'dotenv'

config({ path: '.env.local' })

const env = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
}
for (const [k, v] of Object.entries(env)) {
  if (!v) {
    console.error(`Missing env: ${k}`)
    process.exit(1)
  }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.accessKeyId!,
    secretAccessKey: env.secretAccessKey!,
  },
})

// 모든 origin 에서 GET/HEAD 허용 — 브라우저 워커가 wasm 을 다운로드할 수
// 있도록. 데이터가 모두 public 이라 origin 제한할 의미 없음.
const rules: CORSRule[] = [
  {
    AllowedOrigins: ['*'],
    AllowedMethods: ['GET', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag', 'Content-Length'],
    MaxAgeSeconds: 3600,
  },
]

async function main() {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: env.bucket!,
      CORSConfiguration: { CORSRules: rules },
    }),
  )
  console.log(`CORS applied to bucket "${env.bucket}":`)
  console.log(JSON.stringify(rules, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
