// 문제 디테일 분할 레이아웃 셸.
//
// LeetCode 스타일: 모바일/태블릿/데스크톱 모두 좌우 분할 유지 + 사용자가
// 직접 드래그해 비율을 조정. react-resizable-panels 사용.
// 우측은 위 에디터 + 아래 테스트케이스 세로 분할.
//
// 가로 스크롤은 헤더가 아니라 분할 콘텐츠 영역에만 걸리도록 둔다 — 425px
// 미만 뷰포트에서 분할 패널이 너무 좁아져 두 패널 모두 사용 불가능해지므로,
// 콘텐츠 wrapper에 min-w-[425px]를 두고 그 안에서만 가로 스크롤이 생긴다.
// 헤더(TopNav)는 디바이스 폭에 그대로 맞춰진다.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

import { TopNav } from '@/components/challenges/TopNav'
import { CodeEditor } from '@/components/problems/CodeEditor'
import { ProblemHeader } from '@/components/problems/ProblemHeader'
import { ProblemHtml } from '@/components/problems/ProblemHtml'
import { TestcasePanel, type UserCase } from '@/components/problems/TestcasePanel'
import { decryptString, type EncryptedPayload } from '@/lib/judge/cipher'
import type { TestCaseResult } from '@/lib/judge/types'
import type { ProblemDetail } from '@/lib/queries/problems'

interface Props {
  problem: ProblemDetail
}

export default function ProblemDetailView({ problem }: Props) {
  // 사용자 추가 케이스 + 채점 결과를 둘 다 여기서 보유.
  // CodeEditor는 samples + userCases를 합쳐 채점하고,
  // TestcasePanel은 userCases를 편집하고 judgeResults를 표시한다.
  const [userCases, setUserCases] = useState<UserCase[]>([])
  const [judgeResults, setJudgeResults] = useState<TestCaseResult[] | null>(null)
  const [judging, setJudging] = useState(false)

  // 채점 시점의 userCases 스냅샷. 결과 탭은 항상 이 스냅샷 기준으로 케이스 탭과
  // 본문을 그리므로, 사용자가 채점 후 입력 탭에서 케이스를 추가/삭제/수정해도
  // 결과 탭은 영향받지 않는다. 채점 시작 시점(onJudgingChange가 true로 전환될 때)에
  // 갱신.
  const [judgedUserCases, setJudgedUserCases] = useState<UserCase[]>([])

  // hidden test cases (testcase_ac)의 stdin을 AES-GCM 암호문으로 받아 복호화.
  // expectedStdout은 응답에 포함되지 않고, 채점 시 actual outputs를 verify에
  // POST해서 verdict만 받는다.
  // 비로그인(401), hidden 케이스 없음, 복호화 실패 등은 빈 배열로 graceful degrade.
  const [hiddenInputs, setHiddenInputs] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/problems/${problem.id}/judge/inputs`)
        if (!res.ok) return
        const json = (await res.json()) as { data: EncryptedPayload | null }
        if (cancelled || !json.data) return
        const plaintext = await decryptString(json.data)
        const inputs = JSON.parse(plaintext) as unknown
        if (cancelled) return
        if (
          Array.isArray(inputs) &&
          inputs.every((x) => typeof x === 'string')
        ) {
          setHiddenInputs(inputs as string[])
        }
      } catch {
        // 네트워크/JSON/복호화 오류 → hidden 채점 비활성화로 graceful degrade.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [problem.id])

  // 채점기는 {input, output} 페어만 보면 되므로 UserCase의 `expected`를
  // `output`으로 매핑해 합친다. 결과 배열의 인덱스는
  // [샘플 0..N-1, 사용자 0..M-1]로 일관되어 TestcasePanel의 activeIdx와 일치.
  const judgeCases = useMemo(
    () => [
      ...problem.samples,
      ...userCases.map((u) => ({ input: u.input, output: u.expected })),
    ],
    [problem.samples, userCases],
  )

  return (
    <div className="h-screen bg-surface-card flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <TopNav variant="fullbleed" hideLinks />
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="h-full min-w-[425px]">
          <PanelGroup
            direction="horizontal"
            autoSaveId="problem-detail:h"
            className="h-full"
          >
            {/* 왼쪽: 본문 */}
            <Panel defaultSize={50} minSize={25} className="bg-surface-card">
              <div className="h-full flex flex-col">
                <LeftPanelTabBar />
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                  <DescriptionContent problem={problem} />
                </div>
              </div>
            </Panel>

            <VerticalResizeHandle />

            {/* 오른쪽: 에디터 + 테스트케이스 */}
            <Panel defaultSize={50} minSize={25}>
              <PanelGroup direction="vertical" autoSaveId="problem-detail:v">
                <Panel defaultSize={60} minSize={20}>
                  <CodeEditor
                    problemId={problem.id}
                    samples={judgeCases}
                    hiddenInputs={hiddenInputs}
                    onJudgeResult={setJudgeResults}
                    onJudgingChange={(j) => {
                      setJudging(j)
                      if (j) {
                        // 채점 시작: 이전 결과를 비워 verdict 점을 사라지게 하고,
                        // 결과 탭이 채점 동안 보여줄 케이스 구조를 현 시점으로
                        // 스냅샷한다 (이후 입력 탭에서 추가/삭제해도 결과 탭에
                        // 반영되지 않도록).
                        setJudgeResults(null)
                        setJudgedUserCases(userCases)
                      }
                    }}
                  />
                </Panel>

                <HorizontalResizeHandle />

                <Panel defaultSize={40} minSize={15}>
                  <TestcasePanel
                    samples={problem.samples}
                    userCases={userCases}
                    judgedUserCases={judgedUserCases}
                    onUserCasesChange={setUserCases}
                    hiddenCount={hiddenInputs.length}
                    judgeResults={judgeResults}
                    judging={judging}
                  />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  )
}

// 좌측 패널 상단의 "문제 설명" 탭 헤더.
//
// 외곽엔 padding을 두지 않고 내부 span의 py-3.5로 바 높이를 결정한다 — 그래야
// span 하단의 `border-b-2 border-brand-red -mb-px`가 외곽 `border-b`와 정확히
// 1px 겹쳐 "선택된 탭"의 빨간 underline 인디케이터로 보인다 (분리되면 떠 보임).
// 우측 CodeEditor 툴바의 자연 높이(py-2 + 드롭다운 border 포함 ~47px)와 같은
// 픽셀이 되도록 py-3.5(28px)를 골랐다.
function LeftPanelTabBar() {
  return (
    <div className="flex items-stretch px-3 border-b border-border-list flex-shrink-0">
      <span className="flex items-center px-3 py-3.5 text-[13px] font-bold text-text-primary border-b-2 border-brand-red -mb-px">
        문제 설명
      </span>
    </div>
  )
}

function DescriptionContent({ problem }: { problem: ProblemDetail }) {
  return (
    <div className="max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
      <ProblemHeader
        id={problem.id}
        title={problem.title}
        level={problem.level}
        timeLimit={problem.timeLimit}
        memoryLimit={problem.memoryLimit}
        tags={problem.tags}
        done={problem.done}
      />

      <Section title="문제">
        {problem.description ? (
          <ProblemHtml html={problem.description} />
        ) : (
          <EmptyBody />
        )}
      </Section>

      <Section title="입력">
        {problem.inputFormat ? (
          <ProblemHtml html={problem.inputFormat} />
        ) : (
          <EmptyBody />
        )}
      </Section>

      <Section title="출력">
        {problem.outputFormat ? (
          <ProblemHtml html={problem.outputFormat} />
        ) : (
          <EmptyBody />
        )}
      </Section>

      {problem.hint && (
        <Section title="힌트">
          <ProblemHtml html={problem.hint} />
        </Section>
      )}

      {problem.source && <ProblemSource source={problem.source} />}
    </div>
  )
}

// 출처는 보조 정보라 기본은 접혀 있고, 사용자가 펼치면 보이게 한다.
// 제목/태그 영역에 같이 두면 시선이 분산되는 데다, 디테일 페이지 진입
// 직후엔 문제 본문이 우선이다.
function ProblemSource({ source }: { source: string }) {
  return (
    <details className="mt-10 border-t border-border-list group">
      <summary className="flex items-center justify-between cursor-pointer list-none py-3 text-[12px] font-bold uppercase tracking-[0.18em] text-text-muted hover:text-text-secondary transition-colors">
        <span>출처</span>
        <svg
          className="w-3 h-3 transition-transform group-open:rotate-180"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5l3 3 3-3" />
        </svg>
      </summary>
      <p className="pb-4 text-[13px] text-text-secondary leading-[1.6]">
        {source}
      </p>
    </details>
  )
}

// 좌우 패널 핸들. 1px 라인 + 가운데에 상시 노출되는 grip 바 (drag affordance).
// Grip은 4×40px 세로 바, 호버/드래그 시 brand-red로 강조.
//
// z-10: 핸들의 hit area와 grip이 좌우 패널 영역으로 ±6px 튀어나오는데,
// 인접 패널 헤더/툴바 배경이 그 위에 그려지면 가려져서 잡기/시인성이
// 모두 떨어진다. 핸들을 항상 위에 올린다.
function VerticalResizeHandle() {
  return (
    <PanelResizeHandle className="group relative z-20 w-px bg-border data-[resize-handle-state=hover]:bg-brand-red data-[resize-handle-state=drag]:bg-brand-red transition-colors">
      {/* 잡기 쉬운 hit area (보이지 않음) */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      {/* 항상 보이는 grip 인디케이터 */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-10 bg-border-key group-data-[resize-handle-state=hover]:bg-brand-red group-data-[resize-handle-state=drag]:bg-brand-red transition-colors" />
    </PanelResizeHandle>
  )
}

// 위/아래 패널 핸들.
function HorizontalResizeHandle() {
  return (
    <PanelResizeHandle className="group relative z-10 h-px bg-border data-[resize-handle-state=hover]:bg-brand-red data-[resize-handle-state=drag]:bg-brand-red transition-colors">
      <div className="absolute inset-x-0 -top-1.5 -bottom-1.5" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1 w-10 bg-border-key group-data-[resize-handle-state=hover]:bg-brand-red group-data-[resize-handle-state=drag]:bg-brand-red transition-colors" />
    </PanelResizeHandle>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-2">
      <h2 className="text-[15px] font-bold text-text-primary mb-2 m-0">
        {title}
      </h2>
      {children}
    </section>
  )
}

function EmptyBody() {
  return (
    <p className="text-[13px] text-text-muted">
      아직 본문이 준비되지 않았어요.
    </p>
  )
}
