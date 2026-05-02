'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'

import type { MyProblem, MyProblemsResponse } from '@/app/api/me/problems/route'
import { TierBadge } from '@/components/auth/TierBadge'
import { TopNav } from '@/components/challenges/TopNav'
import { usePendingFeature } from '@/components/ui/PendingFeatureProvider'

export default function MyProblemsPage() {
  const { status } = useSession()
  const [solved, setSolved] = useState<MyProblem[] | null>(null)
  const [failed, setFailed] = useState<MyProblem[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/me/problems')
      if (!res.ok || cancelled) return
      const data = (await res.json()) as MyProblemsResponse
      setSolved(data.solved ?? [])
      setFailed(data.failed ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  const filteredSolved = useMemo(
    () => filterByQuery(solved, query),
    [solved, query],
  )
  const filteredFailed = useMemo(
    () => filterByQuery(failed, query),
    [failed, query],
  )

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-card">
        <TopNav />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-surface-card">
        <TopNav />
        <main className="max-w-[440px] mx-auto px-6 sm:px-10 pt-20 text-center">
          <h1 className="text-[22px] font-extrabold text-text-primary mb-3">
            로그인이 필요해요
          </h1>
          <Link
            href="/"
            className="inline-block bg-brand-red text-white px-6 py-3 text-[14px] font-bold hover:opacity-90 transition-opacity mt-4"
          >
            홈으로 돌아가기
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-card">
      <TopNav />

      <main className="max-w-[1080px] mx-auto px-6 sm:px-10 pt-10 sm:pt-14 pb-16">
        <div className="mb-6">
          <Link
            href="/me"
            className="text-[12px] text-text-secondary hover:text-text-primary transition-colors"
          >
            ← 내 정보로
          </Link>
          <h1 className="mt-2 text-[22px] sm:text-[26px] font-extrabold text-text-primary tracking-tight">
            내 풀이 기록
          </h1>
        </div>

        <div className="mb-8">
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문제 번호 또는 제목으로 찾기"
            className="w-full max-w-[420px] border border-border-list bg-surface-card px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-colors"
          />
        </div>

        <ProblemSection
          title="푼 문제"
          total={solved?.length ?? null}
          problems={filteredSolved}
          loading={solved === null}
          emptyTitle="아직 푼 문제가 없어요"
          emptyHint="solved.ac에서 가져오는 동안 잠시만 기다려주세요."
          noMatchTitle="검색 결과 없음"
        />

        <ProblemSection
          title="실패한 문제"
          total={failed?.length ?? null}
          problems={filteredFailed}
          loading={failed === null}
          emptyTitle="아직 실패한 문제가 없어요"
          emptyHint="여기서 직접 풀어보신 다음, 못 푸신 문제만 모아드릴게요."
          noMatchTitle="검색 결과 없음"
        />
      </main>
    </div>
  )
}

function filterByQuery(
  problems: MyProblem[] | null,
  rawQuery: string,
): MyProblem[] | null {
  if (problems === null) return null
  const q = rawQuery.trim().toLowerCase()
  if (!q) return problems
  return problems.filter(
    (p) =>
      String(p.problemId).includes(q) ||
      p.titleKo.toLowerCase().includes(q),
  )
}

function ProblemSection({
  title,
  total,
  problems,
  loading,
  emptyTitle,
  emptyHint,
  noMatchTitle,
}: {
  title: string
  total: number | null
  problems: MyProblem[] | null
  loading: boolean
  emptyTitle: string
  emptyHint: string
  noMatchTitle: string
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="w-1 h-4 bg-brand-red flex-shrink-0" aria-hidden="true" />
        <h2 className="text-[15px] sm:text-[17px] font-bold tracking-tight text-text-primary m-0">
          {title}
        </h2>
        {total !== null && (
          <span className="text-[13px] text-text-muted tabular-nums">
            {total.toLocaleString()}
          </span>
        )}
      </div>

      {loading && <TileGridSkeleton count={24} />}

      {!loading && problems !== null && problems.length === 0 && total === 0 && (
        <div className="px-1 py-2">
          <p className="text-[13px] font-bold text-text-primary mb-1">{emptyTitle}</p>
          <p className="text-[12px] text-text-muted leading-relaxed">{emptyHint}</p>
        </div>
      )}

      {!loading && problems !== null && problems.length === 0 && total !== 0 && (
        <p className="text-[13px] text-text-muted px-1 py-2">{noMatchTitle}</p>
      )}

      {!loading && problems !== null && problems.length > 0 && (
        <TileGrid problems={problems} />
      )}
    </section>
  )
}

function TileGrid({ problems }: { problems: MyProblem[] }) {
  const showPending = usePendingFeature()
  return (
    <ul className="flex flex-wrap gap-1 sm:gap-1.5">
      {problems.map((p) => (
        <li key={p.problemId}>
          <button
            type="button"
            onClick={() => showPending('에디터')}
            title={`${p.problemId}번 · ${p.titleKo}`}
            className="h-7 sm:h-9 px-1.5 sm:px-2.5 inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-[12px] font-bold tabular-nums border border-border-list bg-surface-card text-text-primary hover:bg-surface-page transition-colors"
          >
            <TierBadge tier={p.level} className="text-[10px] sm:text-[11px]" />
            <span>{p.problemId}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function TileGridSkeleton({ count }: { count: number }) {
  return (
    <ul className="flex flex-wrap gap-1 sm:gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <span className="block w-[56px] sm:w-[64px] h-7 sm:h-9 bg-surface-page animate-pulse" />
        </li>
      ))}
    </ul>
  )
}
