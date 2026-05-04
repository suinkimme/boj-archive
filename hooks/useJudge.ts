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
  problemId: number
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

export function useJudge(lang: Lang): UseJudgeReturn {
  const runtime: JudgeRuntime | undefined = getRuntime(lang)
  const supported = runtime !== undefined

  const [phase, setPhase] = useState<JudgePhase>(
    supported ? 'loading' : 'idle',
  )
  const [results, setResults] = useState<TestCaseResult[] | null>(null)

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
  // 현재 실행의 hidden 옵션. done 이후 verify API에 POST할 때 problemId 필요.
  const hiddenOptionsRef = useRef<HiddenJudgeOptions | undefined>(undefined)
  // visible(samples + userCases)의 길이. done 이후 hidden 결과만 추출할 때 사용.
  const visibleCountRef = useRef(0)

  const clearTleTimer = () => {
    if (tleTimerRef.current !== null) {
      clearTimeout(tleTimerRef.current)
      tleTimerRef.current = null
    }
  }

  // hidden 케이스의 actual outputs를 서버에 보내 verdict을 받아 results에 머지.
  // RE/TLE는 client-side에서 결정된 그대로 두고, AC placeholder만 서버 응답으로 덮는다.
  const verifyHiddenResults = useCallback(async () => {
    const hidden = hiddenOptionsRef.current
    if (!hidden) return

    setResults((prev) => {
      if (!prev) return prev

      // hidden 슬롯의 인덱스와 actual을 모은다 (RE/TLE는 서버 검증 스킵).
      const hiddenIndices: number[] = []
      const outputsToSend: string[] = []
      for (let i = visibleCountRef.current; i < prev.length; i++) {
        const r = prev[i]
        if (r.verdict === 'RE' || r.verdict === 'TLE') continue
        hiddenIndices.push(i)
        outputsToSend.push(r.actual ?? '')
      }

      // hidden 결과가 아예 없으면 (전부 RE/TLE이거나 hidden 자체가 0개) 호출 생략.
      if (hiddenIndices.length === 0) {
        return prev
      }

      // 서버 호출은 setResults 콜백 밖에서. 여기선 prev 그대로 반환.
      void postVerify(hidden.problemId, outputsToSend, hiddenIndices)
      return prev
    })

    async function postVerify(
      problemId: number,
      outputs: string[],
      indices: number[],
    ) {
      try {
        const res = await fetch(
          `/api/problems/${problemId}/judge/verify`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ outputs }),
          },
        )
        if (!res.ok) throw new Error(`verify failed: ${res.status}`)
        const data = (await res.json()) as { verdicts: ('AC' | 'WA')[] }
        if (
          !Array.isArray(data.verdicts) ||
          data.verdicts.length !== indices.length
        ) {
          throw new Error('verify response shape mismatch')
        }

        setResults((prev) => {
          if (!prev) return prev
          const next = [...prev]
          indices.forEach((idx, k) => {
            const v = data.verdicts[k]
            const r = next[idx]
            // AC/WA만 덮어쓰고 elapsed/actual/hidden은 그대로 유지.
            next[idx] = { ...r, verdict: v }
          })
          return next
        })
      } catch (e) {
        // verify 실패 시 hidden 슬롯들을 RE 처리 + 사용자에게 사유 노출.
        const message = e instanceof Error ? e.message : '서버 검증 실패'
        setResults((prev) => {
          if (!prev) return prev
          const next = [...prev]
          indices.forEach((idx) => {
            const r = next[idx]
            next[idx] = {
              ...r,
              verdict: 'RE',
              errorMessage: `채점 서버 오류: ${message}`,
              actual: undefined,
            }
          })
          return next
        })
      }
    }
  }, [])

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
          setResults((prev) => {
            // First result of the run: allocate the array prefilled with TLE
            // placeholders so that if the worker is killed mid-run, missing
            // slots already render as TLE.
            if (!prev) {
              const next = judgeCasesRef.current.map(tlePlaceholder)
              next[msg.caseIndex] = msg.result
              return next
            }
            const next = [...prev]
            next[msg.caseIndex] = msg.result
            return next
          })
          return
        }

        if (msg.type === 'done') {
          clearTleTimer()
          // hidden이 있으면 서버 verify를 비동기로 진행 (fire-and-forget; 응답이
          // 와서 setResults가 다시 일어남). phase는 즉시 ready로 돌려 버튼이
          // "채점 중"에서 풀리도록 한다.
          if (hiddenOptionsRef.current) {
            void verifyHiddenResults()
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
    [verifyHiddenResults],
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
        setResults([])
        return
      }

      const worker = ensureWorker(runtime)

      setPhase('running')
      setResults(null)
      judgeCasesRef.current = allCases
      hiddenOptionsRef.current = hiddenCases.length > 0 ? hidden : undefined
      visibleCountRef.current = visibleCases.length

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

        setResults((prev) => {
          if (!prev) {
            return judgeCasesRef.current.map(tlePlaceholder)
          }
          return prev
        })
        setPhase('loading')
        ensureWorker(runtime)
      }, TLE_TIMEOUT_MS)
    },
    [runtime, phase, ensureWorker, discardWorker],
  )

  const retry = useCallback(() => {
    if (!runtime) return
    discardWorker(runtime.id)
    setPhase('loading')
    ensureWorker(runtime)
  }, [runtime, ensureWorker, discardWorker])

  return { phase, results, supported, judge, retry }
}
