// 우측 하단 패널 — "입력 / 실행 결과" 두 상단 탭.
//
// 입력 탭 안에서:
//   - problem.samples가 read-only "케이스 1..N"으로 깔리고
//   - 사용자가 "+" 버튼으로 빈 케이스를 추가하면 그 뒤에 편집 가능한
//     케이스 N+1, N+2... 가 붙는다.
//   - 활성 사용자 케이스 옆에 ✕ 버튼이 떠서 삭제 가능.
//   - 1차 PR에서는 in-memory state만. 새로고침/페이지 이탈 시 사용자
//     케이스는 사라진다. (localStorage 영속화는 추후.)
//
// 실행 결과 탭은 채점 백엔드 연결 전까지 placeholder.

'use client'

import { useState } from 'react'

interface Sample {
  input: string
  output: string
}

interface UserCase {
  id: string
  input: string
  expected: string
}

type TopTab = 'testcase' | 'result'

interface Props {
  samples: Sample[]
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TestcasePanel({ samples }: Props) {
  const [tab, setTab] = useState<TopTab>('testcase')
  const [userCases, setUserCases] = useState<UserCase[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  const totalCount = samples.length + userCases.length
  const safeActive =
    totalCount === 0 ? 0 : Math.max(0, Math.min(activeIdx, totalCount - 1))

  const handleAdd = () => {
    // 첫 샘플이 있으면 그 값을 미리 채워줘서 사용자가 바로 변형해 시도할 수
    // 있게 한다. 샘플이 없으면 빈 케이스.
    //
    // problem.json의 sample I/O는 통상 "...\n"으로 끝나는데, textarea는
    // trailing \n을 빈 두 번째 줄로 그려 읽기전용 pre와 시각 높이가 어긋난다.
    // 한 개의 trailing newline은 제거해 시각 일관성 확보.
    const first = samples[0]
    const stripTrailingNl = (s: string) => s.replace(/\n$/, '')
    const next: UserCase = {
      id: newId(),
      input: stripTrailingNl(first?.input ?? ''),
      expected: stripTrailingNl(first?.output ?? ''),
    }
    const newAbsoluteIdx = samples.length + userCases.length
    setUserCases((prev) => [...prev, next])
    setActiveIdx(newAbsoluteIdx)
  }

  const handleDelete = (userIdx: number) => {
    setUserCases((prev) => prev.filter((_, i) => i !== userIdx))
    // 활성 케이스만 삭제 가능하도록 UI를 짰으므로 항상 active를 한 칸 앞으로.
    setActiveIdx((prev) => Math.max(0, prev - 1))
  }

  const handleUpdate = (
    userIdx: number,
    field: 'input' | 'expected',
    value: string,
  ) => {
    setUserCases((prev) =>
      prev.map((c, i) => (i === userIdx ? { ...c, [field]: value } : c)),
    )
  }

  const isSampleActive = safeActive < samples.length
  const userActiveIdx = isSampleActive ? -1 : safeActive - samples.length
  const activeSample = isSampleActive ? samples[safeActive] : null
  const activeUser = !isSampleActive ? userCases[userActiveIdx] : null

  return (
    <div className="flex flex-col h-full min-w-0 bg-surface-card">
      <div className="flex items-center gap-1 border-b border-border-list px-3 flex-shrink-0">
        <TopTabButton active={tab === 'testcase'} onClick={() => setTab('testcase')}>
          입력
        </TopTabButton>
        <TopTabButton active={tab === 'result'} onClick={() => setTab('result')}>
          실행 결과
        </TopTabButton>
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'testcase' ? (
          <div className="flex flex-col h-full">
            <div className="flex flex-wrap items-center gap-y-1 px-3 pt-2 pb-1 flex-shrink-0">
              {Array.from({ length: totalCount }).map((_, i) => {
                const isUser = i >= samples.length
                const isActive = safeActive === i
                return (
                  <div
                    key={i}
                    className={`inline-flex items-center flex-shrink-0 transition-colors ${
                      isActive ? 'bg-surface-page' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`pl-2.5 ${
                        isUser ? 'pr-1' : 'pr-2.5'
                      } py-1 text-[12px] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-text-primary'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      케이스 {i + 1}
                    </button>
                    {isUser && (
                      <button
                        type="button"
                        onClick={() => handleDelete(i - samples.length)}
                        aria-label={`케이스 ${i + 1} 삭제`}
                        className="pr-2 py-1 text-text-muted/60 hover:text-brand-red transition-colors"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
              <button
                type="button"
                onClick={handleAdd}
                aria-label="케이스 추가"
                className="ml-0.5 inline-flex items-center justify-center w-7 h-7 text-text-muted hover:text-text-primary hover:bg-surface-page transition-colors flex-shrink-0"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 2v8M2 6h8" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {totalCount === 0 && (
                <p className="text-[13px] text-text-muted">
                  + 버튼으로 케이스를 추가해보세요.
                </p>
              )}
              {activeSample && (
                <>
                  <ReadOnlyField label="입력" value={activeSample.input} />
                  <ReadOnlyField label="기대 출력" value={activeSample.output} />
                </>
              )}
              {activeUser && (
                <>
                  <EditableField
                    label="입력"
                    value={activeUser.input}
                    onChange={(v) => handleUpdate(userActiveIdx, 'input', v)}
                  />
                  <EditableField
                    label="기대 출력"
                    value={activeUser.expected}
                    onChange={(v) => handleUpdate(userActiveIdx, 'expected', v)}
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          <ResultView />
        )}
      </div>
    </div>
  )
}

function TopTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2.5 text-[13px] font-bold transition-colors border-b-2 -mb-px ${
        active
          ? 'border-brand-red text-text-primary'
          : 'border-transparent text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function ResultView() {
  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="text-[13px] text-text-muted">
        제출하면 실행 결과가 여기에 표시됩니다.
      </p>
    </div>
  )
}

function FieldHeader({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </span>
      <CopyButton label={label} value={value} />
    </div>
  )
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignored
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`${label} 복사`}
      className="text-text-muted hover:text-text-primary transition-colors"
    >
      {copied ? (
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 5" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <rect x="4.5" y="4.5" width="8" height="9" rx="1.2" />
          <path d="M3.5 11V3.5A1 1 0 0 1 4.5 2.5H10" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldHeader label={label} value={value} />
      <pre className="bg-surface-page text-[13px] leading-[1.5] font-mono whitespace-pre-wrap px-3 py-2 m-0 text-text-primary">
        {value || ' '}
      </pre>
    </div>
  )
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <FieldHeader label={label} value={value} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={1}
        spellCheck={false}
        // CSS field-sizing: content — 브라우저가 textarea 내용에 맞춰
        // 자동 높이 조정 (Chrome 123+, Safari 17.4+). 길어지면 부모
        // 섹션의 overflow-y-auto가 스크롤을 처리. 미지원 브라우저는
        // rows=1 한 줄 고정으로 폴백.
        style={{ fieldSizing: 'content' } as React.CSSProperties}
        className="block w-full bg-surface-page text-[13px] leading-[1.5] font-mono whitespace-pre-wrap px-3 py-2 m-0 text-text-primary resize-none overflow-hidden focus:outline-none focus:ring-1 focus:ring-text-primary"
      />
    </div>
  )
}
