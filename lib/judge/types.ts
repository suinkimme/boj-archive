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

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'result'; caseIndex: number; result: TestCaseResult }
  | { type: 'done' }
  | { type: 'error'; message: string }
