import type { JudgeRuntime } from '../types'

// Pyodide v0.27.3 (CPython → WASM)을 Web Worker에서 로드. CDN에서 직접
// importScripts로 받아오므로 npm 의존성 없음. 첫 방문 시 ~15MB 다운로드,
// 이후 jsDelivr 캐시에 의존.
//
// 워커 코드: public/judge-workers/python.js
export const pythonRuntime: JudgeRuntime = {
  id: 'python',
  label: 'Python',
  workerPath: '/judge-workers/python.js',
  approxDownloadBytes: 15 * 1024 * 1024,
}
