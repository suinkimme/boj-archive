# 브라우저 채점기 (Judge)

사용자 코드를 **브라우저에서** 실행해 채점한다. 서버에는 코드 실행 인프라를
두지 않고, 정답 비교(hidden testcases)만 서버가 처리한다.

자세한 아키텍처 결정 배경은 `docs/judge-architecture.md` 참고.

## 디렉터리 구조

```
lib/judge/
  types.ts              모든 워커가 따라야 할 메시지 프로토콜과 결과 타입
  normalize.ts          BOJ 스타일 출력 정규화 (워커·서버 verify 라우트 공용)
  cipher.ts             hidden inputs 암호화/복호화 (Web Crypto API)
  runtimes/
    index.ts            Lang → JudgeRuntime 매핑 진입점
    python.ts           언어별 메타데이터 (워커 경로, 다운로드 크기 등)
    ...                 (새 언어 추가 시 여기에 파일을 둔다)
  README.md             ← 이 문서

public/judge-workers/
  python.js             Pyodide 기반 (단일 파일, 자체 완결)
  c.js                  C 채점기 — clang-worker-base 의 thin wrapper
  cpp.js                C++ 채점기 — 동일
  clang-worker-base.js  C/C++ 공통 컴파일·실행 로직 (importScripts)
  clang-shared.js       binji/wasm-clang 의 패치본 (hostWrite (fd,str) 시그니처)
  clang/                binji 정적 자산
    memfs                  가상 파일시스템 WASM
    sysroot.tar            stdio.h, iostream 등 표준 라이브러리
    LICENSE / LICENSE.llvm Apache-2.0 원문 (의무 배포)
    config.json            (선택) Vercel Blob 의 clang/lld URL — 없으면 same-origin 폴백

hooks/useJudge.ts       Lang 인자 받아 RUNTIMES 에서 워커를 띄우고
                        결과 라이프사이클을 관리하는 React 훅
```

## 새 언어 추가 절차

예: `rust` 채점기를 추가한다고 가정.

### 1. `public/judge-workers/rust.js` 작성

Web Worker 파일. 메시지 프로토콜은 `lib/judge/types.ts` 의
`WorkerCase` (입력) 와 `WorkerOutMessage` (출력) 를 따른다.

```js
// 1) 런타임 로드 (예: Rust → WASM 컴파일 도구를 importScripts)
importScripts('https://...')

self.postMessage({ type: 'ready' })

self.onmessage = async (event) => {
  if (event.data.type !== 'run') return
  const { code, cases } = event.data

  for (let i = 0; i < cases.length; i++) {
    const { input, expected, hidden } = cases[i]
    const start = performance.now()

    try {
      const actual = await runUserCode(code, input) // 정규화된 stdout
      const elapsedMs = Math.round(performance.now() - start)
      const verdict = hidden
        ? 'AC' // placeholder — 서버 verify가 덮어씀
        : actual === normalizeOutput(expected) ? 'AC' : 'WA'
      self.postMessage({
        type: 'result',
        caseIndex: i,
        result: {
          verdict, elapsedMs,
          input, expected, actual,
          errorMessage: undefined, hidden,
        },
      })
    } catch (e) {
      self.postMessage({
        type: 'result',
        caseIndex: i,
        result: {
          verdict: 'RE',
          elapsedMs: Math.round(performance.now() - start),
          input, expected,
          actual: undefined,
          errorMessage: String(e).split('\n').filter((l) => l.trim()).pop(),
          hidden,
        },
      })
    }
  }
  self.postMessage({ type: 'done' })
}
```

**주의:**
- 케이스 간 상태가 누수되지 않도록 격리해서 실행할 것 (전역 변수, 모듈 캐시 등).
- TLE 는 hook 이 wall-clock 으로 처리하므로 워커는 그냥 무한 루프에 빠져도 괜찮음
  (10초 후 hook 이 `worker.terminate()` 호출).
- 출력 정규화 규칙은 `normalize.ts` 와 동일하게 (각 줄 trailing 공백 제거 +
  trailing 빈 줄 제거).

### 2. `lib/judge/runtimes/rust.ts`

```ts
import type { JudgeRuntime } from '../types'

export const rustRuntime: JudgeRuntime = {
  id: 'rust',
  label: 'Rust',
  workerPath: '/judge-workers/rust.js',
  approxDownloadBytes: 50 * 1024 * 1024, // 첫 방문 다운로드 크기 추정
}
```

### 3. `lib/judge/runtimes/index.ts` 에 등록

```ts
import { rustRuntime } from './rust'

const ENTRIES: ReadonlyArray<readonly [Lang, JudgeRuntime]> = [
  ['python', pythonRuntime],
  ['rust', rustRuntime],   // ← 추가
]
```

### 4. `components/problems/codeBoilerplate.ts` 의 Lang 유니온에 추가 + 보일러플레이트

```ts
export type Lang = 'python' | 'c' | 'cpp' | 'rust'

export const LANGUAGES = [
  ...,
  { id: 'rust', label: 'Rust' },
]

export const BOILERPLATE = {
  ...,
  rust: 'fn main() {\n    \n}\n',
}
```

이게 끝. UI(케이스 탭, 결과 탭, 스켈레톤) 와 hidden testcase 채점은 모든 언어가
공유하므로 추가로 손댈 게 없다.

## C / C++ 워커 (binji/wasm-clang 기반)

`c.js` / `cpp.js` 는 `clang-worker-base.js` 를 importScripts 한 후
언어별 컴파일 플래그(`-x`, `-std`, link libs)를 주입한다. 새 언어가 같은
clang 툴체인을 쓰면(예: Objective-C) `setupClangWorker({...})` 한 줄짜리
래퍼 파일만 추가하면 된다.

큰 바이너리(`clang` 31MB / `lld` 19MB)는 git 에 두지 않고 Vercel Blob 으로
서빙한다. 업로드 절차:

```bash
git clone https://github.com/binji/wasm-clang.git /tmp/wasm-clang
# .env.local 에 BLOB_READ_WRITE_TOKEN 추가 후
npm run judge:upload-clang
```

스크립트가 `public/judge-workers/clang/config.json` 을 만들고 거기에 URL 을
기록한다. 워커는 init 시 이 파일을 fetch 해서 큰 자산 위치를 결정.
config.json 부재 시 동일 origin (`/judge-workers/clang/clang` 등) 으로 폴백 —
로컬에서 Blob 없이 테스트하고 싶을 때만 두 바이너리를 직접 가져다 두면 된다.

라이선스: Apache-2.0 (main) + Apache-2.0 with LLVM Exceptions (clang, lld).
`public/judge-workers/clang/LICENSE` 와 `LICENSE.llvm` 을 같이 배포한다.

## 메시지 프로토콜

`lib/judge/types.ts` 정의:

**입력 (React → Worker)**
```ts
{ type: 'run', code: string, cases: WorkerCase[] }
```

**출력 (Worker → React)**
```ts
| { type: 'ready' }                                   // Pyodide/WASM 로드 완료
| { type: 'result', caseIndex: number, result }       // 케이스 1건 결과
| { type: 'done' }                                    // 마지막 케이스 끝
| { type: 'error', message: string }                  // 치명적 로드 실패
```

**`WorkerCase`**
```ts
{ input: string; expected: string; hidden: boolean }
```
`hidden: true` 면 워커는 비교를 스킵하고 `actual` 만 채워서 반환.
verdict 은 placeholder ('AC') 로 두고 hook 이 서버 verify 응답으로 덮어씀.

**`TestCaseResult`** (워커가 result 메시지로 보내는 한 건)
```ts
{
  verdict: 'AC' | 'WA' | 'RE' | 'TLE'
  elapsedMs: number | undefined
  input: string                  // 채점 시점 스냅샷
  expected: string               // 채점 시점 스냅샷
  actual: string | undefined
  errorMessage: string | undefined
  hidden: boolean
}
```

## 보안 모델 (요약)

- **샘플 / 사용자 추가 케이스**: 입력·기대 출력 모두 브라우저에서 보임. 비교도 브라우저.
- **숨겨진 테스트** (testcases.source = 'testcase_ac'):
  - inputs 는 AES-GCM 으로 암호화돼 브라우저로 옴 (`NEXT_PUBLIC_JUDGE_INPUT_KEY`).
    네트워크 탭만 봐서는 안 보이지만 **번들 분석으로 키 추출 가능 → 진짜 비밀 아님**.
  - expectedStdout 은 서버 외부로 절대 안 나감.
  - 브라우저가 actual outputs 를 `/api/problems/[id]/judge/verify` 로 POST →
    서버가 비교 후 verdicts 반환.

진짜 비공개를 원하면 서버 측 코드 실행 인프라가 필요한데 의도적으로 도입하지 않음.
사용자가 위변조한 outputs 를 verify 로 보내 AC 받을 수는 있고, 학습 플랫폼 신뢰
모델상 허용 범위.

## 검증

- `npx tsc --noEmit` 통과 확인
- 로그아웃 → 샘플만 채점되는지
- 로그인 → hidden testcase 도 채점에 포함되는지 (Network 탭에서 inputs 응답이
  암호문, verify 응답이 verdicts 만 있는지)
- 정답 / 오답 / 런타임 에러 / 무한 루프 코드 각각 시나리오 수동 확인
