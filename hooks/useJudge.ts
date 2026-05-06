'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { Lang } from '@/components/problems/codeBoilerplate'
import { getRuntime } from '@/lib/judge/runtimes'
import type {
  JudgePhase,
  JudgeRuntime,
  TestCaseResult,
  WorkerOutMessage,
} from '@/lib/judge/types'

interface Sample {
  input: string
  output: string
}

// hidden 케이스를 함께 채점하기 위한 옵션. inputs는 expected가 없는 stdin 배열로,
// 워커는 비교 없이 actual만 캡처하고 hook이 done 이후 verify API에 POST한다.
interface HiddenJudgeOptions {
  verifyUrl: string
  inputs: string[]
}

const TLE_TIMEOUT_MS = 10_000

interface UseJudgeReturn {
  phase: JudgePhase
  results: TestCaseResult[] | null
  // 현재 언어에 채점 워커가 존재하는지. false면 judge() 호출은 noop.
  supported: boolean
  judge: (code: string, samples: Sample[], hidden?: HiddenJudgeOptions) => void
  retry: () => void
}

// 채점 1 사이클이 "완전히" 끝났을 때 한 번만 호출. hidden 케이스가 있으면
// 서버 verify 응답(또는 그 실패) 까지 끝난 시점, 없으면 worker done 시점.
// results는 그 시점의 최종 verdict 배열.
interface UseJudgeOptions {
  onComplete?: (results: TestCaseResult[]) => void
}

// 워커에 보내는 케이스 단위. hidden=true면 워커는 비교를 스킵.
interface InternalCase {
  input: string
  expected: string
  hidden: boolean
}

const tlePlaceholder = (c: InternalCase): TestCaseResult => ({
  verdict: 'TLE',
  elapsedMs: undefined,
  // 결과 탭이 채점 시점의 입력/기대 출력을 보여줘야 하므로 placeholder도 같이 담는다.
  // hidden은 expected를 갖고 있지 않으므로 ''.
  input: c.input,
  expected: c.expected,
  actual: undefined,
  errorMessage: undefined,
  hidden: c.hidden,
})

export function useJudge(
  lang: Lang,
  options: UseJudgeOptions = {},
): UseJudgeReturn {
  const runtime: JudgeRuntime | undefined = getRuntime(lang)
  const supported = runtime !== undefined

  const [phase, setPhase] = useState<JudgePhase>(
    supported ? 'loading' : 'idle',
  )
  const [results, setResults] = useState<TestCaseResult[] | null>(null)

  // results 상태를 ref 로도 미러링한다. setState 의 functional updater 는
  // React 18 에서 다음 commit 에 실행되므로 reducer 안에서 캡처한 snapshot 을
  // 같은 task 안에서 즉시 읽을 수 없다. ref 로 동기 갱신해두면 worker.onmessage
  // 핸들러 내에서 최신 results 를 그 자리에서 읽고 onComplete 에 넘길 수 있다.
  const resultsRef = useRef<TestCaseResult[] | null>(null)
  const writeResults = useCallback((next: TestCaseResult[] | null) => {
    resultsRef.current = next
    setResults(next)
  }, [])

  // onComplete는 ref로 안정화. 사용자가 매 렌더에 새 함수를 넘겨도
  // verifyHiddenResults/done 핸들러가 stale 콜백을 잡지 않도록 한다.
  const onCompleteRef = useRef<UseJudgeOptions['onComplete']>(options.onComplete)
  onCompleteRef.current = options.onComplete

  // 언어별 워커 캐시. 한 번 만들어진 워커는 페이지 unmount 전까지 유지되어,
  // 사용자가 같은 언어로 돌아왔을 때 재초기화 비용을 다시 치르지 않는다.
  // Pyodide(15MB) 같은 무거운 런타임에서 특히 효과적.
  const workersRef = useRef<Map<string, Worker>>(new Map())
  // ready 메시지를 한 번이라도 받은 워커의 runtimeId 집합. 같은 언어로 다시
  // 들어왔을 때 즉시 phase='ready'로 갈 수 있게 함.
  const readyRef = useRef<Set<string>>(new Set())
  // 현재 활성 runtimeId — 메시지 핸들러가 자기 워커가 still active인지 판단해
  // 다른 언어로 전환된 후 도착한 stale 메시지를 무시하기 위해 사용.
  const activeRuntimeIdRef = useRef<string | undefined>(undefined)

  const tleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 현재 실행 중인 케이스 스냅샷.
  const judgeCasesRef = useRef<InternalCase[]>([])
  // 현재 실행의 hidden 옵션. done 이후 verify API에 POST할 때 사용.
  const hiddenOptionsRef = useRef<HiddenJudgeOptions | undefined>(undefined)
  // visible(samples + userCases)의 길이. done 이후 hidden 결과만 추출할 때 사용.
  const visibleCountRef = useRef(0)

  const clearTleTimer = () => {
    if (tleTimerRef.current !== null) {
      clearTimeout(tleTimerRef.current)
      tleTimerRef.current = null
    }
  }

  // 콜백을 한 번만 호출하기 위한 가드. judge() 진입 시 false로 리셋.
  const completedRef = useRef(false)
  const fireComplete = useCallback((finalResults: TestCaseResult[] | null) => {
    if (completedRef.current) return
    if (!finalResults) return
    completedRef.current = true
    onCompleteRef.current?.(finalResults)
  }, [])

  // hidden 케이스의 actual outputs를 서버에 보내 verdict을 받아 results에 머지.
  // RE/TLE는 client-side에서 결정된 그대로 두고, AC placeholder만 서버 응답으로 덮는다.
  // 성공/실패 어느 쪽으로 끝나든 마지막에 fireComplete으로 onComplete를 1회 호출.
  // 모든 results 변경은 writeResults 로 ref+state 동기 갱신해 직후 라인에서 최신
  // 값을 그대로 fireComplete 에 넘길 수 있게 한다.
  const verifyHiddenResults = useCallback(async () => {
    const hidden = hiddenOptionsRef.current
    if (!hidden) return

    const current = resultsRef.current
    if (!current) {
      fireComplete(null)
      return
    }

    // hidden 슬롯의 인덱스와 actual을 모은다 (RE/TLE는 서버 검증 스킵).
    const hiddenIndices: number[] = []
    const outputsToSend: string[] = []
    for (let i = visibleCountRef.current; i < current.length; i++) {
      const r = current[i]
      if (r.verdict === 'RE' || r.verdict === 'TLE') continue
      hiddenIndices.push(i)
      outputsToSend.push(r.actual ?? '')
    }

    // hidden 결과가 아예 없으면 (전부 RE/TLE이거나 hidden 자체가 0개) 호출 생략 +
    // 현재 results 그대로 onComplete.
    if (hiddenIndices.length === 0) {
      fireComplete(current)
      return
    }

    try {
      const res = await fetch(
        hidden.verifyUrl,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ outputs: outputsToSend }),
        },
      )
      if (!res.ok) throw new Error(`verify failed: ${res.status}`)
      const data = (await res.json()) as { verdicts: ('AC' | 'WA')[] }
      if (
        !Array.isArray(data.verdicts) ||
        data.verdicts.length !== hiddenIndices.length
      ) {
        throw new Error('verify response shape mismatch')
      }

      const prev = resultsRef.current
      if (!prev) {
        fireComplete(null)
        return
      }
      const next = [...prev]
      hiddenIndices.forEach((idx, k) => {
        const v = data.verdicts[k]
        const r = next[idx]
        // AC/WA만 덮어쓰고 elapsed/actual/hidden은 그대로 유지.
        next[idx] = { ...r, verdict: v }
      })
      writeResults(next)
      fireComplete(next)
    } catch (e) {
      // verify 실패 시 hidden 슬롯들을 RE 처리 + 사용자에게 사유 노출.
      const message = e instanceof Error ? e.message : '서버 검증 실패'
      const prev = resultsRef.current
      if (!prev) {
        fireComplete(null)
        return
      }
      const next = [...prev]
      hiddenIndices.forEach((idx) => {
        const r = next[idx]
        next[idx] = {
          ...r,
          verdict: 'RE',
          errorMessage: `채점 서버 오류: ${message}`,
          actual: undefined,
        }
      })
      writeResults(next)
      fireComplete(next)
    }
  }, [fireComplete, writeResults])

  // 워커에 메시지 핸들러 부착. 핸들러는 자기 runtimeId 가 active 인 동안만
  // React 상태를 갱신하므로, 사용자가 언어를 전환한 후에 도착한 stale 메시지는
  // 무시된다.
  const attachHandlers = useCallback(
    (worker: Worker, runtimeId: string) => {
      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        if (activeRuntimeIdRef.current !== runtimeId) return
        const msg = event.data

        if (msg.type === 'ready') {
          readyRef.current.add(runtimeId)
          setPhase('ready')
          return
        }

        if (msg.type === 'error') {
          setPhase('error')
          return
        }

        if (msg.type === 'result') {
          // First result of the run: allocate the array prefilled with TLE
          // placeholders so that if the worker is killed mid-run, missing
          // slots already render as TLE.
          const prev = resultsRef.current
          const next = prev
            ? [...prev]
            : judgeCasesRef.current.map(tlePlaceholder)
          next[msg.caseIndex] = msg.result
          writeResults(next)
          return
        }

        if (msg.type === 'done') {
          clearTleTimer()
          // hidden이 있으면 서버 verify를 비동기로 진행 (fire-and-forget; 응답이
          // 와서 setResults가 다시 일어남). phase는 즉시 ready로 돌려 버튼이
          // "채점 중"에서 풀리도록 한다.
          if (hiddenOptionsRef.current) {
            void verifyHiddenResults()
          } else {
            // hidden 없으면 done 시점이 곧 최종 결과. ref 가 이전 result 메시지들의
            // 누적값을 보존하고 있어 그 자리에서 onComplete 에 그대로 넘긴다.
            fireComplete(resultsRef.current)
          }
          setPhase('ready')
        }
      }

      worker.onerror = () => {
        if (activeRuntimeIdRef.current !== runtimeId) return
        clearTleTimer()
        setPhase('error')
      }
    },
    [verifyHiddenResults, fireComplete, writeResults],
  )

  // 캐시된 워커를 가져오거나 없으면 만든다. 새로 만든 경우 ready 메시지를
  // 받기 전까지 phase 가 'loading' 으로 머무름.
  const ensureWorker = useCallback(
    (rt: JudgeRuntime): Worker => {
      let worker = workersRef.current.get(rt.id)
      if (!worker) {
        worker = new Worker(rt.workerPath)
        attachHandlers(worker, rt.id)
        workersRef.current.set(rt.id, worker)
      }
      return worker
    },
    [attachHandlers],
  )

  // 워커 폐기 (캐시·ready 마크에서도 제거). TLE/error 후 깨끗한 새 워커가
  // 필요할 때 사용.
  const discardWorker = useCallback((runtimeId: string) => {
    const w = workersRef.current.get(runtimeId)
    if (w) {
      w.terminate()
      workersRef.current.delete(runtimeId)
    }
    readyRef.current.delete(runtimeId)
  }, [])

  // 언어 변경 시 활성 runtimeId 갱신 + 워커 보장. 미지원 언어는 phase='idle'.
  useEffect(() => {
    if (!runtime) {
      activeRuntimeIdRef.current = undefined
      setPhase('idle')
      return
    }
    activeRuntimeIdRef.current = runtime.id
    if (readyRef.current.has(runtime.id)) {
      // 이전에 ready 까지 갔던 워커가 캐시에 살아있으면 즉시 사용 가능.
      setPhase('ready')
    } else {
      setPhase('loading')
      ensureWorker(runtime)
    }
  }, [runtime, ensureWorker])

  // unmount 시 모든 캐시된 워커 종료.
  useEffect(() => {
    const workers = workersRef.current
    const ready = readyRef.current
    return () => {
      clearTleTimer()
      workers.forEach((w) => w.terminate())
      workers.clear()
      ready.clear()
    }
  }, [])

  const judge = useCallback(
    (code: string, samples: Sample[], hidden?: HiddenJudgeOptions) => {
      if (!runtime) return
      if (phase === 'loading' || phase === 'running') return

      if (phase === 'error') {
        // 에러 워커 폐기 후 새로 생성.
        discardWorker(runtime.id)
        setPhase('loading')
        ensureWorker(runtime)
        return
      }

      const visibleCases: InternalCase[] = samples.map((s) => ({
        input: s.input,
        expected: s.output,
        hidden: false,
      }))
      const hiddenCases: InternalCase[] = hidden
        ? hidden.inputs.map((input) => ({ input, expected: '', hidden: true }))
        : []
      const allCases = [...visibleCases, ...hiddenCases]

      if (allCases.length === 0) {
        writeResults([])
        return
      }

      const worker = ensureWorker(runtime)

      setPhase('running')
      writeResults(null)
      judgeCasesRef.current = allCases
      hiddenOptionsRef.current = hiddenCases.length > 0 ? hidden : undefined
      visibleCountRef.current = visibleCases.length
      // 새 채점 사이클 시작 — onComplete 가드 리셋.
      completedRef.current = false

      worker.postMessage({
        type: 'run',
        code,
        cases: allCases,
      })

      tleTimerRef.current = setTimeout(() => {
        tleTimerRef.current = null
        // Pyodide-style 워커는 SharedArrayBuffer + COOP/COEP 없이는 인터럽트가
        // 안 되므로, 무한 루프 코드는 worker.terminate()로 끊는다. 미수신 슬롯은
        // 초기 TLE placeholder가 그대로 남는다.
        discardWorker(runtime.id)

        const next =
          resultsRef.current ?? judgeCasesRef.current.map(tlePlaceholder)
        writeResults(next)
        // TLE로 강제 종료된 사이클도 사용자 입장에선 "제출 1건" — TLE verdict로
        // onComplete 호출.
        fireComplete(next)
        setPhase('loading')
        ensureWorker(runtime)
      }, TLE_TIMEOUT_MS)
    },
    [runtime, phase, ensureWorker, discardWorker, fireComplete, writeResults],
  )

  const retry = useCallback(() => {
    if (!runtime) return
    discardWorker(runtime.id)
    setPhase('loading')
    ensureWorker(runtime)
  }, [runtime, ensureWorker, discardWorker])

  return { phase, results, supported, judge, retry }
}
