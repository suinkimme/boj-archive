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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

import { FilterDropdown } from '@/components/challenges/FilterDropdown'
import { AlertDialog } from '@/components/ui/AlertDialog'
import { useJudge } from '@/hooks/useJudge'
import type { TestCaseResult } from '@/lib/judge/types'

import { BOILERPLATE, draftKey, LANGUAGES, type Lang } from './codeBoilerplate'

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
}

export function CodeEditor({
  problemId,
  samples,
  hiddenInputs,
  onJudgeResult,
  onJudgingChange,
}: Props) {
  const [language, setLanguage] = useState<Lang>('python')
  const [code, setCode] = useState('')
  const [mounted, setMounted] = useState(false)
  const [loginDialog, setLoginDialog] = useState(false)
  const dirtyRef = useRef(false)

  const { status } = useSession()
  const { phase, results, supported, judge, retry } = useJudge(language)
  // 표시용 언어 라벨. 미지원 언어(아직 워커 없는 C/C++ 등)도 'C', 'C++' 대로
  // 노출되도록 LANGUAGES 의 label 을 우선 사용. runtime 도 동일 라벨을 쓰지만,
  // runtime 이 없을 때를 대비해 LANGUAGES 가 단일 진실 소스.
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
    judge(
      code,
      samples,
      hiddenInputs.length > 0
        ? { problemId, inputs: hiddenInputs }
        : undefined,
    )
  }

  // 채점 워커가 없는 언어(C/C++ 등 아직 미구현) 는 버튼을 비활성. 기여 받기 전까지
  // 사용자에게 명확히 안내.
  const submitDisabled =
    !supported || phase === 'loading' || phase === 'running'
  const submitLabel = !supported
    ? `${langLabel} 채점 준비 중`
    : phase === 'loading'
      ? `${langLabel} 준비 중...`
      : phase === 'running'
        ? '채점 중...'
        : phase === 'error'
          ? '로드 실패 · 다시 시도'
          : '제출하기'
  const submitClass = submitDisabled
    ? 'px-3 py-1.5 text-[13px] font-bold bg-surface-page text-text-muted cursor-not-allowed'
    : 'px-3 py-1.5 text-[13px] font-bold bg-brand-red text-white hover:opacity-90 transition-opacity'

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
