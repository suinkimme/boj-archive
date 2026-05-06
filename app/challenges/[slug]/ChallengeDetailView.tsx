'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { markdownComponents } from '@/components/notices/MarkdownRenderer'
import { Tooltip } from '@/components/ui/Tooltip'

import { TopNav } from '@/components/challenges/TopNav'
import { CodeEditor } from '@/components/problems/CodeEditor'
import {
  SubmissionHistory,
  type OptimisticSubmission,
} from '@/components/problems/SubmissionHistory'
import { TestcasePanel, type UserCase } from '@/components/problems/TestcasePanel'
import { decryptString, type EncryptedPayload } from '@/lib/judge/cipher'
import type { TestCaseResult } from '@/lib/judge/types'
import type { ChallengeDetail } from '@/lib/queries/challenges'

export type LeftTab = 'description' | 'history'

interface Props {
  challenge: ChallengeDetail
  initialTab: LeftTab
}

export default function ChallengeDetailView({ challenge, initialTab }: Props) {
  const [userCases, setUserCases] = useState<UserCase[]>([])
  const [judgeResults, setJudgeResults] = useState<TestCaseResult[] | null>(null)
  const [judging, setJudging] = useState(false)
  const [leftTab, setLeftTabState] = useState<LeftTab>(initialTab)
  const [judgedUserCases, setJudgedUserCases] = useState<UserCase[]>([])
  const [hiddenInputs, setHiddenInputs] = useState<string[]>([])
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [optimisticSubmissions, setOptimisticSubmissions] = useState<OptimisticSubmission[]>([])

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setLeftTab = useCallback(
    (next: LeftTab) => {
      setLeftTabState(next)
      const p = new URLSearchParams(searchParams.toString())
      if (next === 'description') p.delete('tab')
      else p.set('tab', next)
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/challenges/${challenge.slug}/judge/inputs`)
        if (!res.ok) return
        const json = (await res.json()) as { data: EncryptedPayload | null }
        if (cancelled || !json.data) return
        const plaintext = await decryptString(json.data)
        const inputs = JSON.parse(plaintext) as unknown
        if (cancelled) return
        if (Array.isArray(inputs) && inputs.every((x) => typeof x === 'string')) {
          setHiddenInputs(inputs as string[])
        }
      } catch {
        // hidden 채점 비활성화로 graceful degrade
      }
    })()
    return () => { cancelled = true }
  }, [challenge.slug])

  const judgeCases = useMemo(
    () => [
      ...challenge.samples,
      ...userCases.map((u) => ({ input: u.input, output: u.expected })),
    ],
    [challenge.samples, userCases],
  )

  return (
    <div className="h-screen bg-surface-card flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <TopNav variant="fullbleed" hideLinks />
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="h-full min-w-[425px]">
          <PanelGroup direction="horizontal" autoSaveId="challenge-detail:h" className="h-full">
            <Panel defaultSize={50} minSize={25} className="bg-surface-card">
              <div className="h-full flex flex-col">
                <LeftPanelTabBar active={leftTab} onChange={setLeftTab} />
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                  {leftTab === 'description' ? (
                    <DescriptionContent challenge={challenge} />
                  ) : (
                    <SubmissionHistory
                      submissionsUrl={`/api/challenges/${challenge.slug}/submissions`}
                      refreshKey={historyRefreshKey}
                      optimisticItems={optimisticSubmissions}
                      onRefreshed={() => {
                        setOptimisticSubmissions((prev) => prev.filter((o) => o.verdict === null))
                      }}
                    />
                  )}
                </div>
              </div>
            </Panel>

            <VerticalResizeHandle />

            <Panel defaultSize={50} minSize={25}>
              <PanelGroup direction="vertical" autoSaveId="challenge-detail:v">
                <Panel defaultSize={60} minSize={20}>
                  <CodeEditor
                    draftId={`challenge:${challenge.slug}`}
                    submissionsUrl={`/api/challenges/${challenge.slug}/submissions`}
                    verifyUrl={`/api/challenges/${challenge.slug}/judge/verify`}
                    langs={['python']}
                    samples={judgeCases}
                    hiddenInputs={hiddenInputs}
                    onJudgeResult={setJudgeResults}
                    onJudgingChange={(j) => {
                      setJudging(j)
                      if (j) {
                        setJudgeResults(null)
                        setJudgedUserCases(userCases)
                      }
                    }}
                    onSubmissionStart={(info) => {
                      setLeftTab('history')
                      setOptimisticSubmissions((prev) => [
                        {
                          tempId: info.tempId,
                          handle: info.handle,
                          language: info.language,
                          verdict: null,
                          submittedAt: info.submittedAt,
                        },
                        ...prev,
                      ])
                    }}
                    onSubmissionResolved={(info) => {
                      setOptimisticSubmissions((prev) =>
                        prev.map((o) =>
                          o.tempId === info.tempId ? { ...o, verdict: info.verdict } : o,
                        ),
                      )
                    }}
                    onSubmissionRecorded={() => setHistoryRefreshKey((k) => k + 1)}
                  />
                </Panel>

                <HorizontalResizeHandle />

                <Panel defaultSize={40} minSize={15}>
                  <TestcasePanel
                    samples={challenge.samples}
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

function DescriptionContent({ challenge }: { challenge: ChallengeDetail }) {
  return (
    <div className="max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        {challenge.done && (
          <div className="flex items-center gap-2 mb-2 text-[12px] text-text-muted">
            <span className="inline-flex items-center gap-1 text-brand-red font-bold">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              완료
            </span>
          </div>
        )}
        <h1 className="text-[22px] sm:text-[26px] font-extrabold text-text-primary tracking-tight m-0 mb-3">
          {challenge.title}
        </h1>
        {challenge.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 m-0 p-0 list-none">
            {challenge.tags.map((tag) => (
              <li key={tag} className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted bg-surface-page">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      {challenge.description && (
        <div className="mt-2">
          <Markdown text={challenge.description} />
        </div>
      )}

      {challenge.contributors.length > 0 && (
        <div className="mt-10 pt-6 border-t border-border-list">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted mb-3">
            기여자
          </p>
          <div className="flex flex-wrap gap-2">
            {challenge.contributors.map((login, i) => (
              <Tooltip key={login} content={i === 0 ? `${login} · Owner` : login}>
                <a
                  href={`https://github.com/${login}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:opacity-75 transition-opacity"
                >
                  <ContributorAvatar login={login} isFirst={i === 0} />
                </a>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContributorAvatar({ login, isFirst }: { login: string; isFirst?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  return (
    <div className="relative w-7 h-7">
      {!loaded && (
        <div className="absolute inset-0 rounded-full bg-border animate-pulse" />
      )}
      <img
        ref={imgRef}
        src={`https://github.com/${login}.png?size=48`}
        alt={login}
        width={28}
        height={28}
        className={`rounded-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${isFirst ? 'ring-2 ring-brand-red ring-offset-1' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  )
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={markdownComponents}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {text}
    </ReactMarkdown>
  )
}


function LeftPanelTabBar({ active, onChange }: { active: LeftTab; onChange: (next: LeftTab) => void }) {
  return (
    <div className="flex items-stretch px-3 border-b border-border-list flex-shrink-0">
      <TabButton label="문제 설명" isActive={active === 'description'} onClick={() => onChange('description')} />
      <TabButton label="제출 기록" isActive={active === 'history'} onClick={() => onChange('history')} />
    </div>
  )
}

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center px-3 py-3.5 text-[13px] font-bold transition-colors -mb-px border-b-2 ${
        isActive ? 'text-text-primary border-brand-red' : 'text-text-muted hover:text-text-secondary border-transparent'
      }`}
    >
      {label}
    </button>
  )
}

function VerticalResizeHandle() {
  return (
    <PanelResizeHandle className="group relative z-20 w-px bg-border data-[resize-handle-state=hover]:bg-brand-red data-[resize-handle-state=drag]:bg-brand-red transition-colors">
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-10 bg-border-key group-data-[resize-handle-state=hover]:bg-brand-red group-data-[resize-handle-state=drag]:bg-brand-red transition-colors" />
    </PanelResizeHandle>
  )
}

function HorizontalResizeHandle() {
  return (
    <PanelResizeHandle className="group relative z-10 h-px bg-border data-[resize-handle-state=hover]:bg-brand-red data-[resize-handle-state=drag]:bg-brand-red transition-colors">
      <div className="absolute inset-x-0 -top-1.5 -bottom-1.5" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1 w-10 bg-border-key group-data-[resize-handle-state=hover]:bg-brand-red group-data-[resize-handle-state=drag]:bg-brand-red transition-colors" />
    </PanelResizeHandle>
  )
}
