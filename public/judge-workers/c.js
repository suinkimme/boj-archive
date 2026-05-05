// C 채점 워커 — binji/wasm-clang 기반.
// 메시지 프로토콜과 공통 로직은 clang-worker-base.js 참고.
//
// 첫 방문 다운로드 ~60MB:
//   /judge-workers/clang/memfs       (345KB)
//   /judge-workers/clang/sysroot.tar (9.3MB)
//   clang  (31MB) — config.json 의 clangUrl 또는 SMALL_BASE+'clang'
//   lld    (19MB) — config.json 의 lldUrl   또는 SMALL_BASE+'lld'
// 이후 방문은 브라우저 + Vercel edge 캐시.

importScripts('./clang-shared.js', './clang-worker-base.js')

setupClangWorker({
  lang: 'c',
  stdFlag: '-std=c11',
  linkLibs: ['-lc'],
  sourceFile: 'prog.c',
})
