// 좌측 패널의 "기여하기" 탭 콘텐츠.
//
// 사용자가 입력 / 기대 출력 한 쌍을 제출하면 검토를 거쳐 은닉 테스트케이스로
// 등록되는 흐름. 1차 PR에서는 UI만 — 제출은 console.log stub이고
// /api/problems/[id]/reports 연결은 다음 PR.

'use client'

import { signIn, useSession } from 'next-auth/react'
import { useState } from 'react'

import { LANGUAGES, type Lang } from './codeBoilerplate'

interface Props {
  problemId: number
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

export function ContributePanel({ problemId }: Props) {
  const { status } = useSession()
  const [stdin, setStdin] = useState('')
  const [expected, setExpected] = useState('')
  const [code, setCode] = useState('')
  const [lang, setLang] = useState<Lang>('python')
  const [note, setNote] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' })

  if (status === 'loading') {
    return (
      <div className="max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
        <p className="text-[13px] text-text-muted">불러오는 중...</p>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div className="max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
        <Header />
        <div className="mt-6 border border-border-list bg-surface-page px-5 py-6">
          <p className="text-[14px] text-text-primary leading-[1.6]">
            테스트케이스를 기여하려면 로그인이 필요합니다.
          </p>
          <button
            type="button"
            onClick={() => void signIn('github')}
            className="mt-4 bg-brand-red text-white border-0 px-4 py-2 text-[13px] font-bold hover:opacity-90 transition-opacity"
          >
            GitHub로 로그인
          </button>
        </div>
      </div>
    )
  }

  const canSubmit =
    stdin.trim().length > 0 &&
    expected.trim().length > 0 &&
    submitState.kind !== 'submitting'

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitState({ kind: 'submitting' })
    // TODO: POST /api/problems/[id]/reports — 다음 PR에서 연결
    console.log('[contribute] submit', {
      problemId,
      stdin,
      expected,
      code: code.trim() ? { lang, code } : null,
      note: note.trim() || null,
    })
    await new Promise((r) => setTimeout(r, 400))
    setSubmitState({ kind: 'success' })
    setStdin('')
    setExpected('')
    setCode('')
    setNote('')
  }

  const handleReset = () => {
    setSubmitState({ kind: 'idle' })
  }

  return (
    <div className="max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
      <Header />

      {submitState.kind === 'success' ? (
        <div className="mt-6 border border-border-list bg-surface-page px-5 py-6">
          <p className="text-[14px] text-text-primary leading-[1.6]">
            제출이 완료되었습니다. 검토 후 은닉 테스트케이스로 등록됩니다.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 bg-brand-dark text-white border-0 px-4 py-2 text-[13px] font-bold hover:opacity-90 transition-opacity"
          >
            다른 케이스 제출하기
          </button>
        </div>
      ) : (
        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <Field
            label="입력"
            required
            value={stdin}
            onChange={setStdin}
            placeholder="문제에 입력될 값 (stdin)"
          />
          <Field
            label="기대 출력"
            required
            value={expected}
            onChange={setExpected}
            placeholder="해당 입력에 대해 정답 풀이가 출력해야 하는 값 (stdout)"
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                풀이 코드 <OptionalTag />
              </label>
              <LanguageTabs value={lang} onChange={setLang} />
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="기대 출력을 만들어낸 풀이 코드를 붙여넣어 주세요. 운영자가 직접 돌려 검증합니다."
              rows={8}
              spellCheck={false}
              className="block w-full bg-surface-page text-[13px] leading-[1.5] font-mono whitespace-pre px-3 py-2 m-0 text-text-primary resize-y focus:outline-none focus:ring-1 focus:ring-text-primary placeholder:text-text-muted/60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted mb-1.5">
              메모 <OptionalTag />
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="이 케이스가 노리는 엣지 (예: N=1 코너, 음수 입력)"
              maxLength={200}
              className="block w-full bg-surface-page text-[13px] leading-[1.5] px-3 py-2 m-0 text-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary placeholder:text-text-muted/60"
            />
          </div>

          {submitState.kind === 'error' && (
            <p className="text-[13px] text-brand-red">{submitState.message}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-brand-red text-white border-0 px-5 py-2.5 text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitState.kind === 'submitting' ? '제출 중...' : '제출하기'}
            </button>
            <p className="text-[12px] text-text-muted">
              제출 후 운영자가 검토하여 등록 여부를 결정합니다.
            </p>
          </div>
        </form>
      )}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h2 className="text-[20px] font-bold text-text-primary m-0">
        테스트케이스 기여하기
      </h2>
      <p className="mt-2 text-[13px] text-text-muted leading-[1.6]">
        이 문제의 풀이를 검증할 수 있는 입력과 기대 출력을 제출해 주세요.
        제출된 케이스는 운영자 검토를 거쳐 은닉 테스트케이스로 등록됩니다.
      </p>
    </div>
  )
}

function OptionalTag() {
  return (
    <span className="ml-1.5 text-[10px] font-medium normal-case tracking-normal text-text-muted/70">
      (선택)
    </span>
  )
}

function LanguageTabs({
  value,
  onChange,
}: {
  value: Lang
  onChange: (next: Lang) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          className={`px-2 py-0.5 text-[11px] font-bold transition-colors ${
            value === l.id
              ? 'bg-text-primary text-surface-card'
              : 'bg-surface-page text-text-muted hover:text-text-primary'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted mb-1.5">
        {label}
        {required && <span className="ml-1 text-brand-red">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        spellCheck={false}
        className="block w-full bg-surface-page text-[13px] leading-[1.5] font-mono whitespace-pre-wrap px-3 py-2 m-0 text-text-primary resize-y focus:outline-none focus:ring-1 focus:ring-text-primary placeholder:text-text-muted/60"
      />
    </div>
  )
}
