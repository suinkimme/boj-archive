// 언어 → JudgeRuntime 단일 진입점. 새 언어 추가 시:
//   1) lib/judge/runtimes/<lang>.ts 작성
//   2) 여기서 import 해서 RUNTIMES 에 등록
//   3) components/problems/codeBoilerplate.ts 의 Lang 유니온 + LANGUAGES 추가
//   4) public/judge-workers/<lang>.js 워커 파일 추가
//
// 자세한 절차와 워커 메시지 프로토콜은 lib/judge/README.md 참고.

import type { Lang } from '@/components/problems/codeBoilerplate'

import type { JudgeRuntime } from '../types'

import { pythonRuntime } from './python'

// 현재 워커가 구현된 언어만 포함. 나머지는 Lang 에 등재돼 있어도 채점 시
// hasRuntime(lang) === false 가 된다.
const ENTRIES: ReadonlyArray<readonly [Lang, JudgeRuntime]> = [
  ['python', pythonRuntime],
]

export const RUNTIMES = Object.fromEntries(ENTRIES) as Partial<
  Record<Lang, JudgeRuntime>
>

export function getRuntime(lang: Lang): JudgeRuntime | undefined {
  return RUNTIMES[lang]
}

export function hasRuntime(lang: Lang): boolean {
  return RUNTIMES[lang] !== undefined
}
