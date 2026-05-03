// 문제 디테일 분할 레이아웃 셸.
//
// LeetCode 스타일: 모바일/태블릿/데스크톱 모두 좌우 50/50 가로 분할 유지.
// 우측은 위 에디터(flex-3) + 아래 테스트케이스(flex-2) 세로 분할.
// 좁은 뷰포트에서는 페이지 가로 스크롤로 우측 패널을 보게 한다 — 세로 스택
// 으로 폴백하지 않음.
//
// 컨테이너 min-w를 425px로 두어, 그보다 좁은 뷰포트에서 자연스럽게 가로
// 스크롤이 생긴다. 컨테이너 높이는 calc(100vh - 52px) — 슬림 헤더 제외.

'use client'

import Link from 'next/link'

import { CodeEditor } from '@/components/problems/CodeEditor'
import { ProblemHeader } from '@/components/problems/ProblemHeader'
import { ProblemHtml } from '@/components/problems/ProblemHtml'
import { TestcasePanel } from '@/components/problems/TestcasePanel'
import type { ProblemDetail } from '@/lib/queries/problems'

interface Props {
  problem: ProblemDetail
}

export default function ProblemDetailView({ problem }: Props) {
  return (
    <div className="min-h-screen bg-surface-card flex flex-col min-w-[425px]">
      <nav className="bg-brand-dark h-[52px] px-4 sm:px-6 flex items-center flex-shrink-0">
        <Link
          href="/"
          className="text-white text-lg font-bold tracking-[0.06em]"
        >
          NEXT JUDGE<span className="text-brand-red">.</span>
        </Link>
      </nav>

      <div className="flex flex-row h-[calc(100vh-52px)]">
        {/* 왼쪽: 본문 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-card border-r border-border">
          <div className="max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
            <ProblemHeader
              id={problem.id}
              title={problem.title}
              level={problem.level}
              timeLimit={problem.timeLimit}
              memoryLimit={problem.memoryLimit}
              tags={problem.tags}
              source={problem.source}
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
          </div>
        </div>

        {/* 오른쪽: 에디터 + 테스트케이스 */}
        <div className="flex-1 flex flex-col h-full min-h-0 min-w-0">
          <div className="flex-[3] min-h-0">
            <CodeEditor problemId={problem.id} />
          </div>
          <div className="flex-[2] border-t border-border overflow-y-auto">
            <TestcasePanel samples={problem.samples} />
          </div>
        </div>
      </div>
    </div>
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
