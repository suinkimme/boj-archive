export type JudgeVerdict = 'AC' | 'WA' | 'RE' | 'TLE'

export interface TestCaseResult {
  verdict: JudgeVerdict
  elapsedMs: number | undefined
  // 채점 시점의 입력/기대 출력 스냅샷. 사용자가 입력 탭에서 user case를 수정해도
  // 결과 탭은 실제로 채점된 값을 그대로 보여주도록 항상 포함한다.
  // hidden 케이스는 expected가 서버에만 있으므로 ''(빈 문자열)이 들어온다.
  input: string
  expected: string
  // 실제 출력. 사용자 코드가 정상 종료한 케이스(AC/WA)에서만 의미 있다.
  actual: string | undefined
  errorMessage: string | undefined
  // true면 expected output이 서버에만 있는 hidden 케이스. 워커는 비교를 스킵하고
  // verdict는 서버 verify 응답으로 덮어써진다. UI에선 입력/기대 출력을 마스킹.
  hidden: boolean
}

// 워커에 보내는 케이스 단위. expected가 hidden일 땐 빈 문자열이고 비교는 스킵된다.
export interface WorkerCase {
  input: string
  expected: string
  hidden: boolean
}

export type JudgePhase = 'idle' | 'loading' | 'ready' | 'running' | 'error'

// 언어별 채점 워커의 런타임 메타데이터. lib/judge/runtimes/<lang>.ts 가
// 이 형태로 워커 위치/표시 라벨을 export하면 hooks/useJudge.ts 가
// language → runtime 매핑으로 적절한 워커를 띄운다.
//
// 새 언어 추가 절차는 lib/judge/README.md 참고.
export interface JudgeRuntime {
  // codeBoilerplate.ts 의 Lang 유니온과 일치해야 함.
  id: string
  // 사용자에게 노출되는 표시 라벨 (예: "Python", "C++").
  label: string
  // 정적 자산 경로. public/judge-workers/<file>.js 를 가리킨다.
  workerPath: string
  // 첫 방문 시 다운로드되는 대략적 크기 (UI에서 안내 시 사용). 0 또는 미지정이면
  // 안내 생략.
  approxDownloadBytes?: number
}

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'result'; caseIndex: number; result: TestCaseResult }
  | { type: 'done' }
  | { type: 'error'; message: string }
