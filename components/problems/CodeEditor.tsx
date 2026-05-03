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

import { FilterDropdown } from '@/components/challenges/FilterDropdown'
import { usePendingFeature } from '@/components/ui/PendingFeatureProvider'

import { BOILERPLATE, draftKey, LANGUAGES, type Lang } from './codeBoilerplate'

const CodeMirrorEditor = dynamic(() => import('./CodeMirrorEditor'), {
  ssr: false,
  loading: () => <div className="h-full bg-surface-card" />,
})

interface Props {
  problemId: number
}

export function CodeEditor({ problemId }: Props) {
  const showPending = usePendingFeature()

  const [language, setLanguage] = useState<Lang>('python')
  const [code, setCode] = useState('')
  const [mounted, setMounted] = useState(false)
  const dirtyRef = useRef(false)

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

  return (
    <div className="flex flex-col h-full bg-surface-card">
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

        {/* 단일 제출 버튼 — '실행 == 제출' 정책상 곧장 서버에 기록되는
            제출 한 번으로 통합. 서버 채점 들어오기 전까지는 PendingFeatureProvider. */}
        <button
          type="button"
          onClick={() => showPending('제출하기')}
          className="px-3 py-1.5 text-[13px] font-bold bg-brand-red text-white hover:opacity-90 transition-opacity"
        >
          제출하기
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
