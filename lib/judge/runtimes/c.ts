import type { JudgeRuntime } from '../types'

// binji/wasm-clang 기반 (Apache-2.0 + Apache-2.0 with LLVM Exceptions).
// 첫 방문 시 ~60MB 다운로드:
//   memfs (345KB) + sysroot.tar (9.3MB) — public/judge-workers/clang/ same-origin
//   clang (31MB) + lld (19MB) — Vercel Blob (public/judge-workers/clang/config.json 으로 URL 주입)
// 이후 방문은 브라우저 + Vercel edge 캐시 → 사실상 0초.
//
// 워커 코드: public/judge-workers/c.js
export const cRuntime: JudgeRuntime = {
  id: 'c',
  label: 'C',
  workerPath: '/judge-workers/c.js',
  approxDownloadBytes: 60 * 1024 * 1024,
}
