// C++ 채점 워커 — binji/wasm-clang 기반.
// 메시지 프로토콜과 공통 로직은 clang-worker-base.js 참고.

importScripts('./clang-shared.js', './clang-worker-base.js')

setupClangWorker({
  lang: 'c++',
  stdFlag: '-std=c++17',
  linkLibs: ['-lc', '-lc++', '-lc++abi'],
  sourceFile: 'prog.cc',
})
