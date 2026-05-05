import type { JudgeRuntime } from '../types'

// C 워크와 동일한 binji/wasm-clang 자산을 공유 — 첫 채점 워커가 받아두면
// 다른 언어로 전환해도 브라우저 캐시에서 즉시 가져온다.
//
// 워커 코드: public/judge-workers/cpp.js
export const cppRuntime: JudgeRuntime = {
  id: 'cpp',
  label: 'C++',
  workerPath: '/judge-workers/cpp.js',
  approxDownloadBytes: 60 * 1024 * 1024,
}
