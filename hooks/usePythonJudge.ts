'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  JudgePhase,
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

interface UsePythonJudgeReturn {
  phase: JudgePhase
  results: TestCaseResult[] | null
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

export function usePythonJudge(): UsePythonJudgeReturn {
  const [phase, setPhase] = useState<JudgePhase>('loading')
  const [results, setResults] = useState<TestCaseResult[] | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const tleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 현재 실행 중인 케이스 스냅샷. 첫 결과 도착 시 placeholder를 만들거나
  // TLE termination 시 미수신 슬롯을 채울 때 입력/기대 출력을 담기 위해 보관.
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
        // 그래도 verify 호출은 안 함. fire-and-forget이 아니라 동기 분기로 끝.
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
        if (!Array.isArray(data.verdicts) || data.verdicts.length !== indices.length) {
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

  const createWorker = useCallback(() => {
    setPhase('loading')

    const worker = new Worker('/python-judge-worker.js')
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data

      if (msg.type === 'ready') {
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
        // hidden이 있으면 서버 verify를 비동기로 진행 (fire-and-forget; 응답이 와서
        // setResults가 다시 일어남). phase는 즉시 ready로 돌려 버튼이 "채점 중"에서
        // 풀리도록 한다 — verify 동안의 점멸은 verdict이 placeholder 'AC'였던 칸만
        // 살짝 늦게 확정될 뿐 큰 문제 없음.
        if (hiddenOptionsRef.current) {
          void verifyHiddenResults()
        }
        setPhase('ready')
      }
    }

    worker.onerror = () => {
      clearTleTimer()
      setPhase('error')
    }

    workerRef.current = worker
    return worker
  }, [verifyHiddenResults])

  // Preload Pyodide as soon as the editor mounts: by the time the user
  // finishes reading the problem and writing code, the worker is warm.
  useEffect(() => {
    createWorker()
    return () => {
      clearTleTimer()
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [createWorker])

  const judge = useCallback(
    (code: string, samples: Sample[], hidden?: HiddenJudgeOptions) => {
      if (phase === 'loading' || phase === 'running') return

      if (phase === 'error') {
        // Recreate the worker; user can retry submit once it's ready.
        workerRef.current?.terminate()
        createWorker()
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

      const worker = workerRef.current
      if (!worker) {
        createWorker()
        return
      }

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
        // Pyodide cannot be interrupted without SharedArrayBuffer + COOP/COEP
        // headers. Terminate the worker to break out of an infinite loop;
        // missing slots stay as TLE placeholders from the initial array.
        worker.terminate()
        workerRef.current = null

        setResults((prev) => {
          if (!prev) {
            return judgeCasesRef.current.map(tlePlaceholder)
          }
          return prev
        })
        setPhase('ready')
        createWorker()
      }, TLE_TIMEOUT_MS)
    },
    [phase, createWorker],
  )

  const retry = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    createWorker()
  }, [createWorker])

  return { phase, results, judge, retry }
}
