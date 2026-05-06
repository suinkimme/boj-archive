// 코드 에디터 컨테이너. 언어 셀렉트 + CodeMirror primitive +
// 실행/제출 툴바를 묶고, localStorage에 (problemId, language) 별로 드래프트를
// 디바운스 저장한다.
//
// hydration-safe 패턴:
//   - SSR 단계에선 localStorage가 없으므로 placeholder만 그린다.
//   - 첫 effect에서 mounted=true로 전환한 뒤에야 CM primitive를 mount한다.
//   - boilerplate가 자동으로 다시 저장되어 사용자의 옛 드래프트를 덮어쓰는
//     race를 막기 위해 dirtyRef 가드를 둔다 (사용자 입력이 한 번이라도
//     일어났을 때만 쓴다).

'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

import { FilterDropdown } from '@/components/challenges/FilterDropdown'
import { AlertDialog } from '@/components/ui/AlertDialog'
import { useJudge } from '@/hooks/useJudge'
import type { SubmissionVerdict } from '@/db/schema'
import type { JudgeVerdict, TestCaseResult } from '@/lib/judge/types'

import { BOILERPLATE, draftKey, LANGUAGES, type Lang } from './codeBoilerplate'

// 부모가 optimistic UI 를 구성할 수 있도록 제출 라이프사이클의 시작 / 결과 결정
// 시점을 알린다. tempId 로 같은 제출의 두 콜백을 매칭한다.
export interface SubmissionStartInfo {
  tempId: string
  language: Lang
  handle: string
  submittedAt: string
}
export interface SubmissionResolveInfo {
  tempId: string
  verdict: SubmissionVerdict
}

// 케이스별 verdict 배열 → 제출 1건의 최종 verdict.
// 우선순위 RE > TLE > WA > AC: 런타임 에러가 가장 critical(코드 결함),
// 그 다음 시간 초과, 그 다음 오답, 모두 통과면 AC.
function reduceVerdict(results: TestCaseResult[]): JudgeVerdict | null {
  if (results.length === 0) return null
  let hasTle = false
  let hasWa = false
  for (const r of results) {
    if (r.verdict === 'RE') return 'RE'
    if (r.verdict === 'TLE') hasTle = true
    else if (r.verdict === 'WA') hasWa = true
  }
  if (hasTle) return 'TLE'
  if (hasWa) return 'WA'
  return 'AC'
}

const CodeMirrorEditor = dynamic(() => import('./CodeMirrorEditor'), {
  ssr: false,
  loading: () => <div className="h-full bg-surface-card" />,
})

interface Props {
  problemId: number
  samples: { input: string; output: string }[]
  // hidden test cases (testcase_ac)의 stdin 배열. 부모가 mount 시 fetch해서
  // 내려준다. 비로그인이거나 문제에 hidden 케이스가 없으면 빈 배열.
  hiddenInputs: string[]
  onJudgeResult: (results: TestCaseResult[]) => void
  // 채점이 시작되면 true, 끝나거나 idle이면 false. 결과 탭이 스켈레톤을
  // 그릴지 결정하는 데 쓰인다.
  onJudgingChange?: (judging: boolean) => void
  // optimistic UI: 제출 즉시 호출 — 부모가 히스토리 상단에 pending 행을 깐다.
  onSubmissionStart?: (info: SubmissionStartInfo) => void
  // optimistic UI: 케이스별 verdict 가 결정된 시점 (POST 보내기 전). 부모가
  // 같은 tempId 의 pending 행에서 verdict 셀만 업데이트한다.
  onSubmissionResolved?: (info: SubmissionResolveInfo) => void
  // POST 까지 성공해 서버에 영구 저장된 시점. 부모가 백그라운드 refresh 를
  // 트리거해 optimistic 행을 서버 row 로 매끄럽게 교체한다.
  onSubmissionRecorded?: () => void
}

export function CodeEditor({
  problemId,
  samples,
  hiddenInputs,
  onJudgeResult,
  onJudgingChange,
  onSubmissionStart,
  onSubmissionResolved,
  onSubmissionRecorded,
}: Props) {
  const [language, setLanguage] = useState<Lang>('python')
  const [code, setCode] = useState('')
  const [mounted, setMounted] = useState(false)
  const [loginDialog, setLoginDialog] = useState(false)
  const dirtyRef = useRef(false)

  const { data: session, status } = useSession()

  // 한 사이클의 두 콜백 (start ↔ resolved) 을 매칭하는 tempId. handleSubmit 에서
  // 발급해 ref 에 보관하고 handleComplete 에서 같은 ref 를 읽는다.
  const inflightTempIdRef = useRef<string | null>(null)

  // 비로그인 상태에선 제출 기록 API를 호출하지 않는다 (서버에서 401 떨어짐).
  // useJudge가 콜백을 ref로 안정화하므로 매 렌더 새 함수여도 안전.
  const handleComplete = useCallback(
    (finalResults: TestCaseResult[]) => {
      if (status !== 'authenticated') return
      const verdict = reduceVerdict(finalResults)
      if (!verdict) return

      // 1) optimistic 행의 verdict 셀을 업데이트
      const tempId = inflightTempIdRef.current
      inflightTempIdRef.current = null
      if (tempId) onSubmissionResolved?.({ tempId, verdict })

      // 2) 서버에 영구 저장 — 성공 시 부모가 background refresh 로 optimistic 정리
      void fetch(`/api/problems/${problemId}/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language, verdict }),
      })
        .then((res) => {
          if (!res.ok) return
          onSubmissionRecorded?.()
        })
        .catch(() => {
          // 네트워크 실패는 silent — 화면엔 optimistic 결과가 그대로 남는다.
        })
    },
    [
      status,
      problemId,
      language,
      onSubmissionResolved,
      onSubmissionRecorded,
    ],
  )

  const { phase, results, supported, judge, retry } = useJudge(language, {
    onComplete: handleComplete,
  })
  // 표시용 언어 라벨. 등록된 runtime 이 없는 언어도 셀렉트에 라벨이 보이도록
  // LANGUAGES 를 단일 진실 소스로 둔다.
  const langLabel =
    LANGUAGES.find((l) => l.id === language)?.label ?? language

  // 결과가 도착하고 phase가 다시 'ready'로 돌아왔을 때만 부모로 리프트한다.
  // 케이스가 한 건씩 들어올 때마다 호출되면 부모가 그 때마다 리렌더링되므로,
  // 'done' 신호와 동등한 'ready' 전환을 게이트로 사용.
  useEffect(() => {
    if (results !== null && phase === 'ready') {
      onJudgeResult(results)
    }
  }, [results, phase, onJudgeResult])

  // 부모(TestcasePanel)에서 스켈레톤 토글에 사용. running ↔ 그 외 전환만 알린다.
  useEffect(() => {
    onJudgingChange?.(phase === 'running')
  }, [phase, onJudgingChange])

  useEffect(() => {
    const stored = localStorage.getItem(draftKey(problemId, language))
    setCode(stored ?? BOILERPLATE[language])
    dirtyRef.current = false
    setMounted(true)
  }, [language, problemId])

  useEffect(() => {
    if (!mounted || !dirtyRef.current) return
    const t = window.setTimeout(() => {
      localStorage.setItem(draftKey(problemId, language), code)
    }, 300)
    return () => window.clearTimeout(t)
  }, [code, language, problemId, mounted])

  const handleChange = (next: string) => {
    dirtyRef.current = true
    setCode(next)
  }

  const langItems = useMemo(
    () => LANGUAGES.map((l) => ({ value: l.id, label: l.label })),
    [],
  )

  const handleSubmit = () => {
    if (status !== 'authenticated') {
      setLoginDialog(true)
      return
    }
    if (!supported) return
    if (phase === 'error') {
      retry()
      return
    }

    // optimistic 행을 위한 핸들 결정. 서버 GET 응답의 fallback (bojHandle ?? name
    // ?? login) 과 동일한 우선순위로 맞춰 refresh 후 시각적 차이를 최소화.
    const u = session?.user
    const handle = u?.name ?? u?.login ?? '나'
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    inflightTempIdRef.current = tempId
    onSubmissionStart?.({
      tempId,
      language,
      handle,
      submittedAt: new Date().toISOString(),
    })

    judge(
      code,
      samples,
      hiddenInputs.length > 0
        ? { problemId, inputs: hiddenInputs }
        : undefined,
    )
  }

  // 채점 워커가 등록 안 된 언어는 버튼을 비활성화하고 사용자에게 명확히 안내.
  // loading 은 워커 wasm 다운로드(~60MB) + 컴파일 중인 상태 — 사용자가 "지원 안 됨"
  // 으로 오해하지 않도록 진행 중임을 명확히 표시.
  const submitDisabled =
    !supported || phase === 'loading' || phase === 'running'
  const showSpinner = phase === 'loading' || phase === 'running'
  const submitLabel = !supported
    ? `${langLabel} 지원 예정`
    : phase === 'loading'
      ? `${langLabel} 런타임 받는 중`
      : phase === 'running'
        ? '채점 중'
        : phase === 'error'
          ? '로드 실패 · 다시 시도'
          : '제출하기'
  const submitClass = submitDisabled
    ? 'px-3 py-1.5 text-[13px] font-bold bg-surface-page text-text-muted cursor-not-allowed inline-flex items-center gap-1.5'
    : 'px-3 py-1.5 text-[13px] font-bold bg-brand-red text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1.5'

  return (
    <div className="flex flex-col h-full bg-surface-card">
      <AlertDialog
        open={loginDialog}
        onClose={() => setLoginDialog(false)}
        title="로그인이 필요합니다"
        description="문제를 제출하려면 로그인해주세요."
      />
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-list bg-surface-card">
        <div className="w-[104px]">
          <FilterDropdown<Lang>
            defaultLabel="언어"
            items={langItems}
            selected={[language]}
            onToggle={(v) => setLanguage(v)}
            single
            size="compact"
          />
        </div>

        <button
          type="button"
          disabled={submitDisabled}
          onClick={handleSubmit}
          className={submitClass}
        >
          {showSpinner && (
            <svg
              className="w-3 h-3 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="4"
              />
              <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          )}
          {submitLabel}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {mounted ? (
          <CodeMirrorEditor
            value={code}
            language={language}
            onChange={handleChange}
          />
        ) : (
          <div className="h-full bg-surface-card" />
        )}
      </div>
    </div>
  )
}
