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
// 실행 결과 탭은 "입력" 탭과 같은 케이스 탭 바를 공유한다 — 활성 케이스 인덱스도
// 공유해서 입력 ↔ 실행 결과를 토글해도 같은 케이스를 보고 있게 한다.
// 결과 탭에서는 각 탭에 verdict 색상이 점으로 붙고, 활성 케이스 본문에는
// "출력"(actual) 영역이 추가로 그려진다. RE/TLE는 출력 대신 메시지 박스.

'use client'

import { useEffect, useState } from 'react'

import type { JudgeVerdict, TestCaseResult } from '@/lib/judge/types'
import { Tooltip } from '@/components/ui/Tooltip'

interface Sample {
  input: string
  output: string
}

export interface UserCase {
  id: string
  input: string
  expected: string
}

type TopTab = 'testcase' | 'result'

interface Props {
  samples: Sample[]
  // 입력 탭이 편집하는 라이브 user cases.
  userCases: UserCase[]
  // 채점 시작 시점의 user cases 스냅샷. 결과 탭은 항상 이 값을 기준으로
  // 그려서, 사용자가 채점 후 입력 탭에서 케이스를 수정/추가/삭제해도 결과
  // 탭은 흔들리지 않는다.
  judgedUserCases: UserCase[]
  onUserCasesChange: (next: UserCase[]) => void
  // 서버에서 받은 hidden testcase의 개수. 결과 탭 우측의 "숨겨진 테스트 통과/
  // 실패" 요약 표시 여부에 쓰인다. 케이스 탭에는 노출되지 않음.
  hiddenCount: number
  judgeResults: TestCaseResult[] | null
  // CodeEditor의 phase === 'running' 상태가 그대로 들어온다. 결과 탭에서
  // 실제 결과가 오기 전 스켈레톤을 그리는 데 쓴다.
  judging: boolean
}

export function newUserCaseId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TestcasePanel({
  samples,
  userCases,
  judgedUserCases,
  onUserCasesChange,
  hiddenCount,
  judgeResults,
  judging,
}: Props) {
  const [tab, setTab] = useState<TopTab>('testcase')
  const [activeIdx, setActiveIdx] = useState(0)

  // 결과 탭에서는 채점 시점의 스냅샷을, 입력 탭에서는 라이브를 사용. 결과
  // 탭의 케이스 탭 / 본문이 입력 탭에서의 추가·삭제·수정에 영향받지 않게 함.
  const tabUserCases = tab === 'result' ? judgedUserCases : userCases

  // 채점이 시작되거나 결과가 도착하면 사용자 시선이 결과로 가도록 자동 전환.
  // judging은 클릭 직후 true가 되므로 사용자는 클릭하자마자 결과 탭으로 넘어가
  // 스켈레톤을 본다.
  useEffect(() => {
    if (judging || judgeResults !== null) setTab('result')
  }, [judging, judgeResults])

  // 케이스 인덱스: [샘플 0..S-1, 사용자 S..S+U-1]만 UI에 노출. 숨겨진 테스트는
  // judgeResults 배열 끝에 들어 있지만 탭으로 보이지 않고 본문에서도 접근 불가.
  // 결과 탭 상단의 "숨겨진 테스트 통과/실패" 요약 한 줄만 그 결과를 노출한다.
  // 입력 탭과 결과 탭의 user cases 소스가 다르므로 totalCount도 탭 따라 달라짐.
  const visibleCount = samples.length + tabUserCases.length
  const totalCount = visibleCount
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
      id: newUserCaseId(),
      input: stripTrailingNl(first?.input ?? ''),
      expected: stripTrailingNl(first?.output ?? ''),
    }
    const newAbsoluteIdx = samples.length + userCases.length
    onUserCasesChange([...userCases, next])
    setActiveIdx(newAbsoluteIdx)
  }

  const handleDelete = (userIdx: number) => {
    onUserCasesChange(userCases.filter((_, i) => i !== userIdx))
    // 활성 케이스만 삭제 가능하도록 UI를 짰으므로 항상 active를 한 칸 앞으로.
    setActiveIdx((prev) => Math.max(0, prev - 1))
  }

  const handleUpdate = (
    userIdx: number,
    field: 'input' | 'expected',
    value: string,
  ) => {
    onUserCasesChange(
      userCases.map((c, i) => (i === userIdx ? { ...c, [field]: value } : c)),
    )
  }

  const isSampleActive = safeActive < samples.length
  const userActiveIdx = isSampleActive ? -1 : safeActive - samples.length
  const activeSample = isSampleActive ? samples[safeActive] : null
  // 결과 탭에서는 스냅샷, 입력 탭에서는 라이브를 본다. 편집 핸들러는 입력
  // 탭에서만 동작하므로 handleUpdate/handleDelete는 그대로 라이브 userCases 기준.
  const activeUser = !isSampleActive ? tabUserCases[userActiveIdx] : null

  // 숨겨진 테스트 요약: judgeResults 배열에서 hidden=true 항목들을 추려 통과 여부
  // 결정. 모두 AC면 통과, 하나라도 다른 verdict면 실패. hiddenCount=0이면 표시 안 함.
  const hiddenSummary = computeHiddenSummary(judgeResults, hiddenCount)

  const activeResult =
    tab === 'result' && judgeResults ? (judgeResults[safeActive] ?? null) : null

  // 결과 탭에서 각 케이스 탭 옆에 verdict 점을 노출. judgeResults 길이가
  // 현재 케이스 수보다 짧을 수 있으므로 (예: 채점 후 케이스 추가) 인덱스
  // 검사로 안전하게 접근.
  const verdictFor = (i: number): JudgeVerdict | undefined => {
    if (tab !== 'result' || !judgeResults) return undefined
    return judgeResults[i]?.verdict
  }

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

      {/* 케이스 탭 바 + 본문이 한 스크롤 영역에 들어 있어 본문이 길어지면 케이스
          탭도 같이 위로 사라진다. (이전엔 케이스 탭이 고정 헤더라 스크롤 시 어색했음) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div>
          {/* 케이스 탭 바 — 케이스 / + 버튼 / 숨겨진 테스트 요약을 한 flex-wrap에
              인라인으로 나열. 추가 버튼은 입력 탭에서만, 요약 뱃지는 결과 탭에서만. */}
          <div className="flex flex-wrap items-center gap-y-1 px-3 pt-3 pb-1">
            {Array.from({ length: totalCount }).map((_, i) => {
              const isUser = i >= samples.length
              const isActive = safeActive === i
              const verdict = verdictFor(i)
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
                      isUser && tab === 'testcase' ? 'pr-1' : 'pr-2.5'
                    } py-1 text-[12px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
                      isActive
                        ? 'text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {verdict && <VerdictDot verdict={verdict} />}
                    케이스 {i + 1}
                  </button>
                  {isUser && tab === 'testcase' && (
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
            {tab === 'testcase' && (
              <button
                type="button"
                onClick={handleAdd}
                aria-label="케이스 추가"
                // 높이를 케이스 버튼(py-1 + 12px text ≈ 24px)에 맞춰 h-6로 둔다.
                // h-7(28px)이면 input 탭에서만 row가 28px로 늘어나 result 탭과 케이스
                // 버튼의 수직 위치가 달라진다 (items-center로 중앙 정렬되므로).
                className="ml-0.5 inline-flex items-center justify-center w-6 h-6 text-text-muted hover:text-text-primary hover:bg-surface-page transition-colors flex-shrink-0"
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
            )}

            {/* 숨겨진 테스트 요약 — 결과 탭에서만, hidden 케이스가 있고 채점 끝났을 때만.
                케이스 탭과 인라인으로 나열되는 비-인터랙티브 status badge. */}
            {tab === 'result' && !judging && hiddenSummary && (
              <HiddenSummary status={hiddenSummary} />
            )}
          </div>

          <div className="p-4 space-y-4">
            {totalCount === 0 && (
              <p className="text-[13px] text-text-muted">
                {tab === 'testcase'
                  ? '+ 버튼으로 케이스를 추가해보세요.'
                  : '테스트케이스가 없습니다.'}
              </p>
            )}

            {/* 결과 탭 헤더 — Wrong Answer / Accepted 같은 영문 verdict 큰 타이틀.
                채점 중이면 스켈레톤. (숨겨진 테스트 요약은 케이스 탭 바 우측에) */}
            {tab === 'result' && totalCount > 0 && (
              judging ? (
                <VerdictHeaderSkeleton />
              ) : (
                <VerdictHeader result={activeResult} judged={judgeResults !== null} />
              )
            )}

            {/* 채점 중이면 결과 탭의 본문 전체(입력/출력/기대 출력)를 스켈레톤으로
                덮어 결과가 도착하면 한 번에 노출되게 한다. */}
            {tab === 'result' && judging ? (
              <>
                <FieldSkeleton />
                <FieldSkeleton />
                <FieldSkeleton />
              </>
            ) : tab === 'result' ? (
              <>
                {/* 결과 탭은 채점 시점의 입력/기대 출력 스냅샷을 우선 사용한다 —
                    그래야 사용자가 입력 탭에서 user case를 수정해도 결과는 채점된
                    원본 그대로 보인다. activeResult가 없으면(채점 후 추가한 케이스
                    등) 라이브 값으로 폴백. */}
                <ReadOnlyField
                  label="입력"
                  value={
                    activeResult?.input ??
                    activeSample?.input ??
                    activeUser?.input ??
                    ''
                  }
                />
                <ResultBody result={activeResult} judged={judgeResults !== null} />
                <ReadOnlyField
                  label="기대 출력"
                  value={
                    activeResult?.expected ??
                    activeSample?.output ??
                    activeUser?.expected ??
                    ''
                  }
                />
              </>
            ) : (
              <>
                {/* 입력 탭: 샘플은 읽기 전용, 사용자 케이스는 편집 가능. */}
                {activeSample && <ReadOnlyField label="입력" value={activeSample.input} />}
                {activeUser && (
                  <EditableField
                    label="입력"
                    value={activeUser.input}
                    onChange={(v) => handleUpdate(userActiveIdx, 'input', v)}
                  />
                )}

                {activeSample && <ReadOnlyField label="기대 출력" value={activeSample.output} />}
                {activeUser && (
                  <EditableField
                    label="기대 출력"
                    value={activeUser.expected}
                    onChange={(v) => handleUpdate(userActiveIdx, 'expected', v)}
                  />
                )}
              </>
            )}
          </div>
        </div>
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

const VERDICT_EN_LABEL: Record<JudgeVerdict, string> = {
  AC: 'Accepted',
  WA: 'Wrong Answer',
  RE: 'Runtime Error',
  TLE: 'Time Limit Exceeded',
}

const VERDICT_TEXT_COLOR: Record<JudgeVerdict, string> = {
  AC: 'text-status-success',
  WA: 'text-status-danger',
  RE: 'text-status-danger',
  TLE: 'text-status-warning',
}

const VERDICT_DOT_BG: Record<JudgeVerdict, string> = {
  AC: 'bg-status-success',
  WA: 'bg-status-danger',
  RE: 'bg-status-danger',
  TLE: 'bg-status-warning',
}

function VerdictDot({ verdict }: { verdict: JudgeVerdict }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-1.5 h-1.5 rounded-full ${VERDICT_DOT_BG[verdict]}`}
    />
  )
}

// WA/RE는 출력 라벨/배경에 verdict 강조 색을 입힌다. AC/TLE는 라벨만 색을
// 입히고 배경은 기본을 유지 (AC는 이미 헤더가 초록이라 본문도 초록 배경이면
// 과하고, TLE는 본문 출력 자체를 안 보여준다).
const VERDICT_OUTPUT_BG: Partial<Record<JudgeVerdict, string>> = {
  WA: 'bg-status-danger-bg',
  RE: 'bg-status-danger-bg',
}

function formatElapsed(ms: number | undefined, verdict: JudgeVerdict): string {
  if (ms !== undefined) {
    return `${(ms / 1000).toFixed(3)}s`
  }
  if (verdict === 'TLE') return '>10.000s'
  return ''
}

function VerdictHeaderSkeleton() {
  // 원본 VerdictHeader: text-[26px] leading-tight (≈32.5px) + text-[12px] (≈18px),
  // flex items-baseline. 스켈레톤도 동일한 컨테이너에 박스 높이를 실제 라인박스
  // 높이에 맞춰 둔다.
  return (
    <div className="flex items-baseline gap-3 animate-pulse">
      <div className="h-8 w-56 bg-surface-page" />
      <div className="h-4 w-16 bg-surface-page" />
    </div>
  )
}

function FieldSkeleton() {
  // 원본 ReadOnlyField:
  //   FieldHeader (text-[10px] 라벨 + 14×14 CopyButton, items-center) ≈ 15px + mb-1.5
  //   pre (text-[13px] leading-[1.5] + py-2) = 19.5 + 16 ≈ 36px
  // 스켈레톤도 같은 높이/마진으로 맞춰 결과 도착 시 위치 점프가 없도록 한다.
  return (
    <div className="animate-pulse">
      <div className="h-4 w-12 bg-surface-page mb-1.5" />
      <div className="h-9 w-full bg-surface-page" />
    </div>
  )
}

function VerdictHeader({
  result,
  judged,
}: {
  result: TestCaseResult | null
  judged: boolean
}) {
  if (!judged) {
    return (
      <p className="text-[13px] text-text-muted m-0">
        제출하면 실행 결과가 여기에 표시됩니다.
      </p>
    )
  }

  if (!result) {
    return (
      <p className="text-[13px] text-text-muted m-0">
        이 케이스는 채점되지 않았습니다.
      </p>
    )
  }

  const elapsed = formatElapsed(result.elapsedMs, result.verdict)

  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <h2
        className={`m-0 text-[26px] font-extrabold leading-tight ${VERDICT_TEXT_COLOR[result.verdict]}`}
      >
        {VERDICT_EN_LABEL[result.verdict]}
      </h2>
      {elapsed && (
        <span className="inline-flex items-center gap-1 text-[12px] text-text-muted font-medium">
          {elapsed}
          <Tooltip content="브라우저 환경 측정값으로 실제 채점 기준과 다를 수 있습니다.">
            <svg
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-muted/50 cursor-default"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 7.5v4" />
              <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
            </svg>
          </Tooltip>
        </span>
      )}
    </div>
  )
}

function ResultBody({
  result,
  judged,
}: {
  result: TestCaseResult | null
  judged: boolean
}) {
  if (!judged || !result) return null

  if (result.verdict === 'RE' && result.errorMessage) {
    return (
      <ColoredField
        label="에러"
        value={result.errorMessage}
        labelColor={VERDICT_TEXT_COLOR.RE}
        bgClass={VERDICT_OUTPUT_BG.RE}
        valueColor="text-status-danger"
      />
    )
  }

  // TLE는 출력 자체가 의미가 없으므로 본문 생략. 헤더의 verdict와 ">10.000s"로
  // 충분히 정보 전달.
  if (result.verdict === 'TLE') return null

  // AC / WA: 실제 출력을 보여준다. WA에서만 라벨/배경에 verdict 색을 입힌다.
  return (
    <ColoredField
      label="출력"
      value={result.actual ?? ''}
      labelColor={result.verdict === 'WA' ? VERDICT_TEXT_COLOR.WA : undefined}
      bgClass={VERDICT_OUTPUT_BG[result.verdict]}
    />
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

// 숨겨진 테스트 통과/실패 요약. 케이스 수, 입력, 기대 출력 모두 비공개.
type HiddenStatus = 'pass' | 'fail'

function computeHiddenSummary(
  results: TestCaseResult[] | null,
  hiddenCount: number,
): HiddenStatus | null {
  if (hiddenCount === 0 || !results) return null
  const hiddenResults = results.filter((r) => r.hidden)
  if (hiddenResults.length === 0) return null
  const allAc = hiddenResults.every((r) => r.verdict === 'AC')
  return allAc ? 'pass' : 'fail'
}

function HiddenSummary({ status }: { status: HiddenStatus }) {
  const isPass = status === 'pass'
  const colorClass = isPass
    ? 'text-status-success bg-status-success-bg'
    : 'text-status-danger bg-status-danger-bg'
  const label = isPass ? '숨겨진 테스트 통과' : '숨겨진 테스트 실패'
  // 케이스 탭과 동일한 px-2.5 / py-1 / text-[12px]로 높이를 맞춘다.
  // font-medium은 케이스 탭과 동일하게 유지 — bold로 띄우면 같은 행에서
  // 시각적 무게가 너무 튐. 색만으로 강조.
  // ml-2는 마지막 케이스 탭과의 분리 간격.
  return (
    <div
      className={`ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium ${colorClass}`}
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
        <rect x="2.5" y="5.5" width="7" height="5" rx="0.6" />
        <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
      </svg>
      {label}
    </div>
  )
}

// 결과 탭의 "출력" / "에러" 처럼 verdict에 따라 라벨·배경 색을 바꿔야 하는
// 케이스용. ReadOnlyField와 시각 구조는 같지만 색상 토큰을 인자로 받는다.
function ColoredField({
  label,
  value,
  labelColor,
  bgClass,
  valueColor,
}: {
  label: string
  value: string
  labelColor?: string
  bgClass?: string
  valueColor?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.18em] ${labelColor ?? 'text-text-muted'}`}
        >
          {label}
        </span>
        <CopyButton label={label} value={value} />
      </div>
      <pre
        className={`text-[13px] leading-[1.5] font-mono whitespace-pre-wrap px-3 py-2 m-0 ${bgClass ?? 'bg-surface-page'} ${valueColor ?? 'text-text-primary'}`}
      >
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
